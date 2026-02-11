/**
 * エントリーポイント
 * Cloudflare Workers + Hono で実装
 */

import { Hono } from 'hono';
import type { Env } from './types/config';
import { loadConfig } from './config';
import { buildSearchQueries, getStartTime } from './utils/query-builder';
import { XApiClient } from './services/x-client';
import { processTweets } from './services/tweet-processor';
import { SlackNotifier, buildNotificationSummary } from './services/slack-notifier';
import { logger } from './utils/logger';

const app = new Hono<{ Bindings: Env }>();

/**
 * メイン処理関数
 * @param env 環境変数
 */
async function executeDailyJob(env: Env): Promise<void> {
  const startTime = Date.now();
  logger.info('日次バッチ処理を開始します');

  try {
    // 1. 設定ファイルの読み込み
    const config = loadConfig();
    const { global_settings, keywords } = config;

    // 2. 検索クエリの構築
    const queries = buildSearchQueries(keywords, global_settings);
    const query = queries[0]; // Phase 1 では単一クエリのみサポート

    // 3. X API クライアントの初期化
    const xClient = new XApiClient(env.X_BEARER_TOKEN);

    // 4. ツイートの取得
    const startTimeISO = getStartTime(24); // 過去24時間
    const response = await xClient.searchRecentTweetsWithRetry({
      query,
      start_time: startTimeISO,
      max_results: global_settings.max_results,
      tweet_fields: 'created_at,public_metrics,author_id',
      user_fields: 'username,name',
      expansions: 'author_id',
    });

    const fetchedCount = response.meta.result_count;

    // 5. ツイートの処理（フィルタ・ソート・整形）
    const processedTweets = processTweets(response, global_settings.min_likes);

    // 6. 通知サマリーの構築
    const keywordTerms = keywords.map((k) => k.term);
    const summary = buildNotificationSummary(
      processedTweets,
      keywordTerms,
      fetchedCount,
      processedTweets.length
    );

    // 7. Slack への通知
    const slackNotifier = new SlackNotifier(env.SLACK_WEBHOOK_URL);
    await slackNotifier.sendDailySummary(summary);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info('日次バッチ処理が完了しました', {
      duration: `${duration}s`,
      fetchedCount,
      displayedCount: processedTweets.length,
    });
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.error('日次バッチ処理でエラーが発生しました', {
      duration: `${duration}s`,
      error: (error as Error).message,
      stack: (error as Error).stack,
    });

    // エラー通知を送信（Slack Webhook URLが設定されている場合のみ）
    if (env.SLACK_WEBHOOK_URL) {
      try {
        const slackNotifier = new SlackNotifier(env.SLACK_WEBHOOK_URL);
        await slackNotifier.sendErrorNotification((error as Error).message);
      } catch (notificationError) {
        logger.error('エラー通知の送信に失敗しました', {
          error: (notificationError as Error).message,
        });
      }
    }

    throw error;
  }
}

/**
 * Cron Trigger ハンドラ
 * 毎日 17:00 JST (08:00 UTC) に実行される
 */
export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    logger.info('Cron Trigger が起動しました', {
      scheduledTime: new Date(event.scheduledTime).toISOString(),
      cron: event.cron,
    });

    // waitUntil を使用して、Worker の実行時間制限を延長
    ctx.waitUntil(executeDailyJob(env));
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    return app.fetch(request, env);
  },
};

/**
 * ヘルスチェックエンドポイント
 */
app.get('/', (c) => {
  return c.json({
    service: 'x-to-slack',
    status: 'ok',
    version: '1.0.0',
  });
});

/**
 * 手動実行エンドポイント
 * GET /trigger?key={MANUAL_TRIGGER_KEY}
 */
app.get('/trigger', async (c) => {
  const env = c.env;
  const queryKey = c.req.query('key');

  // 認証チェック
  if (!env.MANUAL_TRIGGER_KEY || queryKey !== env.MANUAL_TRIGGER_KEY) {
    logger.warn('手動実行の認証に失敗しました', {
      hasKey: !!env.MANUAL_TRIGGER_KEY,
      providedKey: !!queryKey,
    });
    return c.json({ error: 'Unauthorized' }, 401);
  }

  logger.info('手動実行が開始されました');

  try {
    await executeDailyJob(env);
    return c.json({
      success: true,
      message: '処理が完了しました',
    });
  } catch (error) {
    logger.error('手動実行でエラーが発生しました', {
      error: (error as Error).message,
    });
    return c.json(
      {
        success: false,
        error: (error as Error).message,
      },
      500
    );
  }
});
