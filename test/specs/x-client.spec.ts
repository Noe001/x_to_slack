/**
 * ============================================================
 * X API クライアント仕様 (X API Client Specification)
 * ============================================================
 *
 * このテストファイルは X API v2 クライアントの仕様を定義する。
 *
 * ## システム要件
 * - Bearer Token による認証
 * - /tweets/search/recent エンドポイントへのリクエスト
 * - 10秒のリクエストタイムアウト
 * - ステータスコード別のエラー分類
 * - 5xx エラーのみリトライ（最大1回、30秒間隔）
 *
 * ## エラー分類
 * - 401/403: 認証エラー → リトライなし
 * - 402: クレジット枯渇 → リトライなし
 * - 429: レート制限 → リトライなし
 * - 5xx: サーバーエラー → リトライあり
 * - タイムアウト: AbortError → リトライあり
 *
 * ## リトライポリシー
 * - 最大リトライ回数: 1（デフォルト）
 * - リトライ間隔: 30秒（デフォルト）
 * - リトライ対象: 5xx エラーおよびタイムアウト
 * - リトライ対象外: 401, 402, 403, 429
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { XApiClient } from '../../src/services/x-client';
import { XApiClientError } from '../../src/types/x-api';
import type { SearchParams } from '../../src/services/x-client';

// fetch をグローバルモック
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('X API クライアント仕様', () => {
  const validToken = 'valid-bearer-token';
  const defaultParams: SearchParams = {
    query: '(#Rails OR #Ruby) -is:retweet lang:ja',
    start_time: '2026-02-09T08:00:00.000Z',
    max_results: 50,
    tweet_fields: 'created_at,public_metrics,author_id',
    user_fields: 'username,name',
    expansions: 'author_id',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================
  // 初期化仕様
  // ============================================================
  describe('クライアント初期化', () => {
    it('有効な Bearer Token でインスタンスを生成できること', () => {
      const client = new XApiClient(validToken);
      expect(client).toBeInstanceOf(XApiClient);
    });

    it('空の Bearer Token ではエラーをスローすること', () => {
      expect(() => new XApiClient('')).toThrow('X_BEARER_TOKEN が設定されていません');
    });
  });

  // ============================================================
  // リクエスト構築仕様
  // ============================================================
  describe('リクエスト構築', () => {
    it('X API v2 の /tweets/search/recent エンドポイントにリクエストすること', async () => {
      const client = new XApiClient(validToken);
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [],
            meta: { result_count: 0 },
          }),
          { status: 200 }
        )
      );

      await client.searchRecentTweets(defaultParams);

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('https://api.twitter.com/2/tweets/search/recent');
    });

    it('Authorization ヘッダーに Bearer Token を含むこと', async () => {
      const client = new XApiClient(validToken);
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [],
            meta: { result_count: 0 },
          }),
          { status: 200 }
        )
      );

      await client.searchRecentTweets(defaultParams);

      const options = mockFetch.mock.calls[0][1] as RequestInit;
      expect(options.headers).toHaveProperty('Authorization', `Bearer ${validToken}`);
    });

    it('クエリパラメータにすべての検索条件が含まれること', async () => {
      const client = new XApiClient(validToken);
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [],
            meta: { result_count: 0 },
          }),
          { status: 200 }
        )
      );

      await client.searchRecentTweets(defaultParams);

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      const url = new URL(calledUrl);
      expect(url.searchParams.get('query')).toBe(defaultParams.query);
      expect(url.searchParams.get('start_time')).toBe(defaultParams.start_time);
      expect(url.searchParams.get('max_results')).toBe(defaultParams.max_results.toString());
      expect(url.searchParams.get('tweet.fields')).toBe(defaultParams.tweet_fields);
      expect(url.searchParams.get('user.fields')).toBe(defaultParams.user_fields);
      expect(url.searchParams.get('expansions')).toBe(defaultParams.expansions);
    });

    it('HTTP メソッドは GET であること', async () => {
      const client = new XApiClient(validToken);
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [],
            meta: { result_count: 0 },
          }),
          { status: 200 }
        )
      );

      await client.searchRecentTweets(defaultParams);

      const options = mockFetch.mock.calls[0][1] as RequestInit;
      expect(options.method).toBe('GET');
    });
  });

  // ============================================================
  // レスポンス処理仕様
  // ============================================================
  describe('レスポンス処理', () => {
    it('正常なレスポンスを TweetSearchResponse 型で返すこと', async () => {
      const client = new XApiClient(validToken);
      const responseBody = {
        data: [
          {
            id: '123',
            text: 'Test tweet',
            author_id: 'user1',
            created_at: '2026-02-10T08:00:00.000Z',
            public_metrics: {
              like_count: 10,
              retweet_count: 5,
              reply_count: 2,
              quote_count: 1,
              bookmark_count: 0,
              impression_count: 100,
            },
          },
        ],
        includes: {
          users: [{ id: 'user1', name: 'Test User', username: 'test_user' }],
        },
        meta: { result_count: 1 },
      };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(responseBody), { status: 200 })
      );

      const result = await client.searchRecentTweets(defaultParams);

      expect(result.data).toHaveLength(1);
      expect(result.data![0].id).toBe('123');
      expect(result.meta.result_count).toBe(1);
      expect(result.includes?.users).toHaveLength(1);
    });
  });

  // ============================================================
  // エラー分類仕様
  // ============================================================
  describe('エラー分類', () => {
    it('401 エラー: 認証エラーとして XApiClientError をスローすること', async () => {
      const client = new XApiClient(validToken);
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ errors: [] }), { status: 401 })
      );

      await expect(client.searchRecentTweets(defaultParams)).rejects.toThrow(XApiClientError);
      await mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ errors: [] }), { status: 401 })
      );
      try {
        await client.searchRecentTweets(defaultParams);
      } catch (error) {
        expect((error as XApiClientError).statusCode).toBe(401);
        expect((error as XApiClientError).message).toContain('認証エラー');
      }
    });

    it('403 エラー: 認証エラーとして分類されること', async () => {
      const client = new XApiClient(validToken);
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ errors: [] }), { status: 403 })
      );

      try {
        await client.searchRecentTweets(defaultParams);
      } catch (error) {
        expect(error).toBeInstanceOf(XApiClientError);
        expect((error as XApiClientError).statusCode).toBe(403);
        expect((error as XApiClientError).message).toContain('認証エラー');
      }
    });

    it('402 エラー: クレジット枯渇エラーとして分類されること', async () => {
      const client = new XApiClient(validToken);
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ errors: [] }), { status: 402 })
      );

      try {
        await client.searchRecentTweets(defaultParams);
      } catch (error) {
        expect(error).toBeInstanceOf(XApiClientError);
        expect((error as XApiClientError).statusCode).toBe(402);
        expect((error as XApiClientError).message).toContain('クレジット枯渇');
      }
    });

    it('429 エラー: レート制限エラーとして分類されること', async () => {
      const client = new XApiClient(validToken);
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ errors: [] }), { status: 429 })
      );

      try {
        await client.searchRecentTweets(defaultParams);
      } catch (error) {
        expect(error).toBeInstanceOf(XApiClientError);
        expect((error as XApiClientError).statusCode).toBe(429);
        expect((error as XApiClientError).message).toContain('レート制限');
      }
    });

    it('500 エラー: サーバーエラーとして分類されること', async () => {
      const client = new XApiClient(validToken);
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ errors: [] }), { status: 500 })
      );

      try {
        await client.searchRecentTweets(defaultParams);
      } catch (error) {
        expect(error).toBeInstanceOf(XApiClientError);
        expect((error as XApiClientError).statusCode).toBe(500);
        expect((error as XApiClientError).message).toContain('サーバーエラー');
      }
    });

    it('502/503/504 エラー: サーバーエラーとして分類されること', async () => {
      const client = new XApiClient(validToken);

      for (const status of [502, 503, 504]) {
        mockFetch.mockResolvedValueOnce(
          new Response(JSON.stringify({ errors: [] }), { status })
        );

        try {
          await client.searchRecentTweets(defaultParams);
        } catch (error) {
          expect(error).toBeInstanceOf(XApiClientError);
          expect((error as XApiClientError).statusCode).toBe(status);
          expect((error as XApiClientError).message).toContain('サーバーエラー');
        }
      }
    });

    it('XApiClientError にはステータスコードが含まれること', async () => {
      const client = new XApiClient(validToken);
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ errors: [{ title: 'test', detail: 'detail', type: 'type' }] }), { status: 401 })
      );

      try {
        await client.searchRecentTweets(defaultParams);
      } catch (error) {
        expect(error).toBeInstanceOf(XApiClientError);
        expect((error as XApiClientError).statusCode).toBe(401);
        expect((error as XApiClientError).errors).toBeDefined();
      }
    });
  });

  // ============================================================
  // リトライ仕様
  // ============================================================
  describe('リトライポリシー', () => {
    it('5xx エラーの場合、リトライされること', async () => {
      vi.useRealTimers();
      const client = new XApiClient(validToken);

      // 1回目: 500 → 2回目: 成功
      mockFetch
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ errors: [] }), { status: 500 })
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ data: [], meta: { result_count: 0 } }),
            { status: 200 }
          )
        );

      // retryDelay を 10ms にして高速テスト
      const result = await client.searchRecentTweetsWithRetry(defaultParams, 1, 10);
      expect(result.meta.result_count).toBe(0);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('401 エラーの場合、リトライされないこと', async () => {
      vi.useRealTimers();
      const client = new XApiClient(validToken);
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ errors: [] }), { status: 401 })
      );

      await expect(
        client.searchRecentTweetsWithRetry(defaultParams, 1, 10)
      ).rejects.toThrow(XApiClientError);

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('402 エラーの場合、リトライされないこと', async () => {
      vi.useRealTimers();
      const client = new XApiClient(validToken);
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ errors: [] }), { status: 402 })
      );

      await expect(
        client.searchRecentTweetsWithRetry(defaultParams, 1, 10)
      ).rejects.toThrow(XApiClientError);

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('403 エラーの場合、リトライされないこと', async () => {
      vi.useRealTimers();
      const client = new XApiClient(validToken);
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ errors: [] }), { status: 403 })
      );

      await expect(
        client.searchRecentTweetsWithRetry(defaultParams, 1, 10)
      ).rejects.toThrow(XApiClientError);

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('429 エラーの場合、リトライされないこと', async () => {
      vi.useRealTimers();
      const client = new XApiClient(validToken);
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ errors: [] }), { status: 429 })
      );

      await expect(
        client.searchRecentTweetsWithRetry(defaultParams, 1, 10)
      ).rejects.toThrow(XApiClientError);

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('リトライ回数の上限を超えた場合、最後のエラーをスローすること', async () => {
      vi.useRealTimers();
      const client = new XApiClient(validToken);

      // 2回とも 500 エラー（maxRetries=1 なので初回+1回リトライ=2回）
      mockFetch
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ errors: [] }), { status: 500 })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ errors: [] }), { status: 500 })
        );

      await expect(
        client.searchRecentTweetsWithRetry(defaultParams, 1, 10)
      ).rejects.toThrow(XApiClientError);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  // ============================================================
  // タイムアウト仕様
  // ============================================================
  describe('リクエストタイムアウト', () => {
    it('AbortSignal がリクエストに含まれること（タイムアウト制御のため）', async () => {
      const client = new XApiClient(validToken);
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: [], meta: { result_count: 0 } }),
          { status: 200 }
        )
      );

      await client.searchRecentTweets(defaultParams);

      const options = mockFetch.mock.calls[0][1] as RequestInit;
      expect(options.signal).toBeDefined();
    });

    it('タイムアウト時は XApiClientError をスローすること', async () => {
      const client = new XApiClient(validToken);
      mockFetch.mockImplementationOnce(() => {
        const error = new Error('The operation was aborted');
        error.name = 'AbortError';
        return Promise.reject(error);
      });

      await expect(client.searchRecentTweets(defaultParams)).rejects.toThrow(
        XApiClientError
      );
    });

    it('タイムアウトエラーメッセージにタイムアウトの旨が含まれること', async () => {
      const client = new XApiClient(validToken);
      mockFetch.mockImplementationOnce(() => {
        const error = new Error('The operation was aborted');
        error.name = 'AbortError';
        return Promise.reject(error);
      });

      try {
        await client.searchRecentTweets(defaultParams);
      } catch (error) {
        expect((error as XApiClientError).message).toContain('タイムアウト');
      }
    });
  });
});
