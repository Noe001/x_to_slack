/**
 * ============================================================
 * システム統合仕様 (System Integration Specification)
 * ============================================================
 *
 * このテストファイルはシステム全体の統合動作の仕様を定義する。
 *
 * ## システム概要
 * X（旧Twitter）から特定キーワードのツイートを日次収集し、
 * Slack に通知するバッチシステム。
 *
 * ## エントリーポイント
 * 1. Cron Trigger: 毎日 17:00 JST (08:00 UTC) に自動実行
 * 2. HTTP GET /: ヘルスチェック
 * 3. HTTP GET /trigger?key={KEY}: 手動実行（認証付き）
 *
 * ## 日次バッチ処理フロー
 * 1. keywords.json から設定を読み込み
 * 2. 検索クエリを構築
 * 3. X API で過去24時間のツイートを取得
 * 4. フィルタ・重複排除・ソート・件数制限
 * 5. Slack 通知サマリーを構築
 * 6. Slack に送信
 *
 * ## エラーハンドリング
 * - バッチ処理中のエラーは Slack にエラー通知を送信
 * - エラー通知の送信失敗はログに記録するのみ
 * - 手動実行時のエラーは HTTP 500 で返却
 *
 * ## 手動トリガー認証
 * - MANUAL_TRIGGER_KEY が設定されている場合のみ認証可能
 * - クエリパラメータ key が MANUAL_TRIGGER_KEY と一致すること
 */

import { describe, it, expect } from 'vitest';
import { loadConfig } from '../../src/config';
import { buildSearchQueries } from '../../src/utils/query-builder';
import { processTweets } from '../../src/services/tweet-processor';
import { buildNotificationSummary } from '../../src/services/slack-notifier';
import { XApiClientError } from '../../src/types/x-api';
import { mockSuccessResponse } from '../mocks/x-api-responses';

describe('システム統合仕様', () => {
  // ============================================================
  // ヘルスチェックエンドポイント仕様
  // ============================================================
  describe('ヘルスチェック (GET /)', () => {
    it('サービス名を含むJSONレスポンスを返すこと', async () => {
      const module = await import('../../src/index');
      const app = module.default;

      const response = await app.fetch(
        new Request('http://localhost/'),
        { X_BEARER_TOKEN: 'test', SLACK_WEBHOOK_URL: 'https://hooks.slack.com/test' }
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.service).toBe('x-to-slack');
      expect(body.status).toBe('ok');
    });

    it('バージョン情報を含むこと', async () => {
      const module = await import('../../src/index');
      const app = module.default;

      const response = await app.fetch(
        new Request('http://localhost/'),
        { X_BEARER_TOKEN: 'test', SLACK_WEBHOOK_URL: 'https://hooks.slack.com/test' }
      );

      const body = await response.json();
      expect(body.version).toBe('1.0.0');
    });
  });

  // ============================================================
  // 手動トリガー認証仕様
  // ============================================================
  describe('手動トリガー認証 (GET /trigger)', () => {
    it('key パラメータなしの場合は 401 を返すこと', async () => {
      const module = await import('../../src/index');
      const app = module.default;

      const response = await app.fetch(
        new Request('http://localhost/trigger'),
        {
          X_BEARER_TOKEN: 'test',
          SLACK_WEBHOOK_URL: 'https://hooks.slack.com/test',
          MANUAL_TRIGGER_KEY: 'valid-key',
        }
      );

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Unauthorized');
    });

    it('不正な key パラメータの場合は 401 を返すこと', async () => {
      const module = await import('../../src/index');
      const app = module.default;

      const response = await app.fetch(
        new Request('http://localhost/trigger?key=wrong-key'),
        {
          X_BEARER_TOKEN: 'test',
          SLACK_WEBHOOK_URL: 'https://hooks.slack.com/test',
          MANUAL_TRIGGER_KEY: 'valid-key',
        }
      );

      expect(response.status).toBe(401);
    });

    it('MANUAL_TRIGGER_KEY が未設定の場合は 401 を返すこと', async () => {
      const module = await import('../../src/index');
      const app = module.default;

      const response = await app.fetch(
        new Request('http://localhost/trigger?key=any-key'),
        {
          X_BEARER_TOKEN: 'test',
          SLACK_WEBHOOK_URL: 'https://hooks.slack.com/test',
        }
      );

      expect(response.status).toBe(401);
    });
  });

  // ============================================================
  // 設定 → クエリ → 処理の連携仕様
  // ============================================================
  describe('設定からクエリ構築までの連携', () => {
    it('loadConfig の結果から buildSearchQueries が呼び出せること', () => {
      const config = loadConfig();
      const queries = buildSearchQueries(config.keywords, config.global_settings);

      expect(queries).toHaveLength(1);
      expect(queries[0]).toContain('-is:retweet');
      expect(queries[0]).toContain(`lang:${config.global_settings.lang}`);
    });

    it('設定ファイルのキーワードが全てクエリに含まれること', () => {
      const config = loadConfig();
      const queries = buildSearchQueries(config.keywords, config.global_settings);
      const query = queries[0];

      config.keywords.forEach((keyword) => {
        // スペースを含むキーワードは引用符で囲まれる
        if (keyword.term.includes(' ')) {
          expect(query).toContain(`"${keyword.term}"`);
        } else {
          expect(query).toContain(keyword.term);
        }
      });
    });
  });

  // ============================================================
  // ツイート処理 → 通知サマリーの連携仕様
  // ============================================================
  describe('ツイート処理から通知サマリーへの連携', () => {
    it('processTweets の結果から buildNotificationSummary が呼び出せること', () => {
      const processedTweets = processTweets(mockSuccessResponse, 0);
      const summary = buildNotificationSummary(
        processedTweets,
        ['#Rails', '#Ruby'],
        mockSuccessResponse.meta.result_count,
        processedTweets.length
      );

      expect(summary.tweets.length).toBe(processedTweets.length);
      expect(summary.stats.fetched).toBe(mockSuccessResponse.meta.result_count);
      expect(summary.stats.displayed).toBe(processedTweets.length);
    });

    it('処理済みツイートの情報がサマリーに正しくマッピングされること', () => {
      const processedTweets = processTweets(mockSuccessResponse, 0);
      const summary = buildNotificationSummary(
        processedTweets,
        ['#Rails'],
        2,
        processedTweets.length
      );

      if (summary.tweets.length > 0) {
        const tweet = summary.tweets[0];
        expect(tweet).toHaveProperty('id');
        expect(tweet).toHaveProperty('text');
        expect(tweet).toHaveProperty('author');
        expect(tweet).toHaveProperty('username');
        expect(tweet).toHaveProperty('likes');
        expect(tweet).toHaveProperty('retweets');
        expect(tweet).toHaveProperty('url');
      }
    });
  });

  // ============================================================
  // エラーハンドリング連携仕様
  // ============================================================
  describe('エラーハンドリング', () => {
    it('XApiClientError クラスは Error を継承していること', () => {
      const error = new XApiClientError('test', 500);
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('XApiClientError');
      expect(error.statusCode).toBe(500);
    });

    it('XApiClientError に errors 配列を含めることができること', () => {
      const apiErrors = [
        { title: 'Unauthorized', detail: 'Invalid token', type: 'auth' },
      ];
      const error = new XApiClientError('Auth failed', 401, apiErrors);

      expect(error.errors).toEqual(apiErrors);
    });
  });

  // ============================================================
  // 型の一貫性仕様
  // ============================================================
  describe('型システムの一貫性', () => {
    it('ProcessedTweet の url は x.com ドメインであること', () => {
      const processedTweets = processTweets(mockSuccessResponse, 0);

      processedTweets.forEach((tweet) => {
        expect(tweet.url).toMatch(/^https:\/\/x\.com\//);
      });
    });

    it('NotificationSummary の date は YYYY/MM/DD 形式であること', () => {
      const summary = buildNotificationSummary([], [], 0, 0);
      expect(summary.date).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);
    });
  });
});
