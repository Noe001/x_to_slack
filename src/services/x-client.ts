/**
 * X API v2 クライアント
 */

import type { TweetSearchResponse, XApiError } from '../types/x-api';
import { XApiClientError } from '../types/x-api';
import { logger } from '../utils/logger';

const X_API_BASE_URL = 'https://api.twitter.com/2';
const SEARCH_RECENT_ENDPOINT = '/tweets/search/recent';
const REQUEST_TIMEOUT = 10000; // 10秒

export interface SearchParams {
  query: string;
  start_time: string;
  max_results: number;
  tweet_fields: string;
  user_fields: string;
  expansions: string;
}

/**
 * X API クライアントクラス
 */
export class XApiClient {
  private bearerToken: string;

  constructor(bearerToken: string) {
    if (!bearerToken) {
      throw new Error('X_BEARER_TOKEN が設定されていません');
    }
    this.bearerToken = bearerToken;
  }

  /**
   * 最近のツイートを検索する
   * @param params 検索パラメータ
   * @returns ツイート検索レスポンス
   * @throws XApiClientError
   */
  async searchRecentTweets(params: SearchParams): Promise<TweetSearchResponse> {
    const url = this.buildSearchUrl(params);

    logger.info('X API リクエストを送信します', {
      endpoint: SEARCH_RECENT_ENDPOINT,
      query: params.query,
      maxResults: params.max_results,
    });

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.bearerToken}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      await this.handleErrorResponse(response);

      const data: TweetSearchResponse = await response.json();

      logger.info('X API レスポンスを受信しました', {
        resultCount: data.meta.result_count,
        hasData: !!data.data,
      });

      return data;
    } catch (error) {
      if (error instanceof XApiClientError) {
        throw error;
      }

      // タイムアウトまたはネットワークエラー
      if ((error as Error).name === 'AbortError') {
        logger.error('X API リクエストがタイムアウトしました', {
          timeout: REQUEST_TIMEOUT,
        });
        throw new XApiClientError('X API リクエストがタイムアウトしました', 0);
      }

      logger.error('X API リクエストに失敗しました', {
        error: (error as Error).message,
      });
      throw new XApiClientError(
        `X API リクエストに失敗しました: ${(error as Error).message}`,
        0
      );
    }
  }

  /**
   * エラーレスポンスの処理
   * @param response Fetchレスポンス
   * @throws XApiClientError
   */
  private async handleErrorResponse(response: Response): Promise<void> {
    if (response.ok) {
      return;
    }

    const statusCode = response.status;
    let errorData: { errors?: XApiError[] } = {};

    try {
      errorData = await response.json();
    } catch {
      // JSON パースエラーは無視
    }

    const errors = errorData.errors || [];

    // ステータスコードに応じたエラーメッセージ
    let message = 'X API エラーが発生しました';

    switch (statusCode) {
      case 401:
      case 403:
        message = 'X API 認証エラー: トークンが無効です';
        logger.error(message, { statusCode, errors });
        break;
      case 402:
        message = 'X API クレジット枯渇: クレジットをチャージしてください';
        logger.error(message, { statusCode, errors });
        break;
      case 429:
        message = 'X API レート制限: しばらく待ってから再試行してください';
        const retryAfter = response.headers.get('Retry-After');
        logger.error(message, { statusCode, retryAfter, errors });
        break;
      case 500:
      case 502:
      case 503:
      case 504:
        message = `X API サーバーエラー: ${statusCode}`;
        logger.error(message, { statusCode, errors });
        break;
      default:
        message = `X API エラー: ${statusCode}`;
        logger.error(message, { statusCode, errors });
    }

    throw new XApiClientError(message, statusCode, errors);
  }

  /**
   * 検索URLを構築する
   * @param params 検索パラメータ
   * @returns 完全な検索URL
   */
  private buildSearchUrl(params: SearchParams): string {
    const url = new URL(`${X_API_BASE_URL}${SEARCH_RECENT_ENDPOINT}`);

    url.searchParams.append('query', params.query);
    url.searchParams.append('start_time', params.start_time);
    url.searchParams.append('max_results', params.max_results.toString());
    url.searchParams.append('tweet.fields', params.tweet_fields);
    url.searchParams.append('user.fields', params.user_fields);
    url.searchParams.append('expansions', params.expansions);

    return url.toString();
  }

  /**
   * リトライ付きで最近のツイートを検索する
   * @param params 検索パラメータ
   * @param maxRetries 最大リトライ回数（デフォルト: 1）
   * @param retryDelay リトライまでの待機時間（ミリ秒、デフォルト: 30000）
   * @returns ツイート検索レスポンス
   * @throws XApiClientError
   */
  async searchRecentTweetsWithRetry(
    params: SearchParams,
    maxRetries: number = 1,
    retryDelay: number = 30000
  ): Promise<TweetSearchResponse> {
    let lastError: XApiClientError | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.searchRecentTweets(params);
      } catch (error) {
        if (!(error instanceof XApiClientError)) {
          throw error;
        }

        lastError = error;

        // リトライしないエラー: 認証エラー、クレジット枯渇、レート制限
        if ([401, 402, 403, 429].includes(error.statusCode)) {
          logger.warn('リトライ不可能なエラーが発生しました', {
            statusCode: error.statusCode,
          });
          throw error;
        }

        // 5xx エラーの場合のみリトライ
        if (error.statusCode >= 500 && error.statusCode < 600 && attempt < maxRetries) {
          logger.warn('X API サーバーエラー。リトライします', {
            attempt: attempt + 1,
            maxRetries,
            retryDelay,
          });
          await this.sleep(retryDelay);
          continue;
        }

        throw error;
      }
    }

    throw lastError!;
  }

  /**
   * 指定時間待機する
   * @param ms 待機時間（ミリ秒）
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
