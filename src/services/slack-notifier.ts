/**
 * Slack 通知機能
 */

import type {
  SlackWebhookPayload,
  Block,
  HeaderBlock,
  SectionBlock,
  DividerBlock,
  ContextBlock,
  NotificationSummary,
} from '../types/slack';
import type { ProcessedTweet } from '../types/x-api';
import { logger } from '../utils/logger';

const POST_TIMEOUT = 15000; // 15秒
const MAX_RETRIES = 2; // 最大リトライ回数
const RETRY_DELAY = 5000; // リトライ間隔（5秒）

const MEDAL_EMOJIS = ['🥇', '🥈', '🥉']; // 上位3件にメダルを表示

/**
 * Slack Notifier クラス
 */
export class SlackNotifier {
  private webhookUrl: string;

  constructor(webhookUrl: string) {
    if (!webhookUrl) {
      throw new Error('SLACK_WEBHOOK_URL が設定されていません');
    }
    this.webhookUrl = webhookUrl;
  }

  /**
   * 日刊まとめを Slack に送信する
   * @param summary 通知サマリーデータ
   */
  async sendDailySummary(summary: NotificationSummary): Promise<void> {
    const payload = this.buildPayload(summary);

    logger.info('Slack 通知を送信します', {
      tweetCount: summary.tweets.length,
      keywords: summary.keywords,
      stats: summary.stats,
    });

    await this.sendWithRetry(payload);

    logger.info('Slack 通知を送信しました');
  }

  /**
   * エラー通知を Slack に送信する
   * @param errorMessage エラーメッセージ
   */
  async sendErrorNotification(errorMessage: string): Promise<void> {
    const payload: SlackWebhookPayload = {
      text: `🚨 エラーが発生しました`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🚨 X投稿収集システム エラー',
            emoji: true,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*エラー内容:*\n\`\`\`${errorMessage}\`\`\``,
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `発生日時: ${new Date().toISOString()}`,
            },
          ],
        },
      ],
    };

    logger.warn('エラー通知を Slack に送信します', { errorMessage });

    try {
      await this.sendWithRetry(payload);
      logger.info('エラー通知を送信しました');
    } catch (error) {
      // エラー通知の送信に失敗してもスローしない（無限ループを防ぐ）
      logger.error('エラー通知の送信に失敗しました', {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Slack Webhook へのペイロード送信（リトライ機能付き）
   * @param payload ペイロード
   * @param retries 残りリトライ回数
   */
  private async sendWithRetry(
    payload: SlackWebhookPayload,
    retries: number = MAX_RETRIES
  ): Promise<void> {
    try {
      await this.send(payload);
    } catch (error) {
      if (retries > 0) {
        logger.warn('Slack 通知の送信に失敗しました。リトライします', {
          retriesLeft: retries,
          retryDelay: RETRY_DELAY,
        });
        await this.sleep(RETRY_DELAY);
        await this.sendWithRetry(payload, retries - 1);
      } else {
        logger.error('Slack 通知の送信に失敗しました（リトライ上限）', {
          error: (error as Error).message,
        });
        throw error;
      }
    }
  }

  /**
   * Slack Webhook へのペイロード送信
   * @param payload ペイロード
   */
  private async send(payload: SlackWebhookPayload): Promise<void> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), POST_TIMEOUT);

    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Slack API エラー: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw new Error('Slack 通知がタイムアウトしました');
      }
      throw error;
    }
  }

  /**
   * 通知ペイロードを構築する
   * @param summary 通知サマリーデータ
   * @returns Slack Webhook ペイロード
   */
  private buildPayload(summary: NotificationSummary): SlackWebhookPayload {
    const blocks: Block[] = [];

    // ヘッダー
    blocks.push(this.buildHeaderBlock(summary.date));

    // キーワード情報
    blocks.push(this.buildKeywordsSection(summary.keywords));

    blocks.push({ type: 'divider' });

    // ツイートがない場合
    if (summary.tweets.length === 0) {
      blocks.push(this.buildNoTweetsSection());
    } else {
      // ツイート一覧
      summary.tweets.forEach((tweet, index) => {
        blocks.push(this.buildTweetSection(tweet, index));
        if (index < summary.tweets.length - 1) {
          blocks.push({ type: 'divider' });
        }
      });
    }

    blocks.push({ type: 'divider' });

    // 統計情報
    blocks.push(this.buildStatsSection(summary.stats));

    return {
      text: `📢 本日のトピックまとめ (${summary.date})`,
      blocks,
    };
  }

  /**
   * ヘッダーブロックを構築
   * @param date 日付
   * @returns ヘッダーブロック
   */
  private buildHeaderBlock(date: string): HeaderBlock {
    return {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `📢 本日のトピックまとめ (${date})`,
        emoji: true,
      },
    };
  }

  /**
   * キーワードセクションを構築
   * @param keywords キーワード配列
   * @returns セクションブロック
   */
  private buildKeywordsSection(keywords: string[]): SectionBlock {
    return {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Keywords:* ${keywords.join(', ')}`,
      },
    };
  }

  /**
   * ツイートなしセクションを構築
   * @returns セクションブロック
   */
  private buildNoTweetsSection(): SectionBlock {
    return {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '該当する投稿はありませんでした。',
      },
    };
  }

  /**
   * ツイートセクションを構築
   * @param tweet ツイート
   * @param index インデックス
   * @returns セクションブロック
   */
  private buildTweetSection(
    tweet: {
      text: string;
      author: string;
      username: string;
      likes: number;
      retweets: number;
      url: string;
    },
    index: number
  ): SectionBlock {
    // 上位3件にメダルを表示
    const medal = index < MEDAL_EMOJIS.length ? `${MEDAL_EMOJIS[index]} ` : '';

    // テキストの整形（長すぎる場合は省略）
    const maxTextLength = 200;
    const displayText =
      tweet.text.length > maxTextLength
        ? `${tweet.text.slice(0, maxTextLength)}...`
        : tweet.text;

    return {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text:
          `${medal}*❤️ ${tweet.likes} | 🔁 ${tweet.retweets}* | @${tweet.username}\n` +
          `${displayText}\n` +
          `<${tweet.url}|🔗 投稿を見る>`,
      },
    };
  }

  /**
   * 統計情報セクションを構築
   * @param stats 統計情報
   * @returns コンテキストブロック
   */
  private buildStatsSection(stats: {
    fetched: number;
    filtered: number;
    displayed: number;
  }): ContextBlock {
    return {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `ℹ️ 取得: ${stats.fetched}件 → フィルタ後: ${stats.filtered}件 → 表示: ${stats.displayed}件`,
        },
      ],
    };
  }

  /**
   * 指定時間待機する
   * @param ms 待機時間（ミリ秒）
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * 通知サマリーデータを構築するヘルパー関数
 * @param tweets 処理済みツイート配列
 * @param keywords キーワード配列
 * @param fetchedCount 取得件数
 * @param filteredCount フィルタ後件数
 * @returns 通知サマリーデータ
 */
export function buildNotificationSummary(
  tweets: ProcessedTweet[],
  keywords: string[],
  fetchedCount: number,
  filteredCount: number
): NotificationSummary {
  // 日本時間の日付を取得
  const now = new Date();
  const jstDate = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const dateStr = jstDate.toISOString().split('T')[0].replace(/-/g, '/');

  return {
    date: dateStr,
    keywords,
    tweets: tweets.map((tweet) => ({
      id: tweet.id,
      text: tweet.text,
      author: tweet.author.name,
      username: tweet.author.username,
      likes: tweet.likes,
      retweets: tweet.retweets,
      url: tweet.url,
    })),
    stats: {
      fetched: fetchedCount,
      filtered: filteredCount,
      displayed: tweets.length,
    },
  };
}
