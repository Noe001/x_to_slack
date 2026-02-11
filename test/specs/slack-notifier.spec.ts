/**
 * ============================================================
 * Slack 通知仕様 (Slack Notification Specification)
 * ============================================================
 *
 * このテストファイルは Slack 通知機能の仕様を定義する。
 *
 * ## システム要件
 * - Incoming Webhook URL への POST リクエスト
 * - Block Kit フォーマットによるリッチ通知
 * - 日次サマリー通知とエラー通知の2種類
 * - 15秒のタイムアウト
 * - 最大2回のリトライ（5秒間隔）
 *
 * ## 日次サマリーの構成
 * 1. ヘッダー: "📢 本日のトピックまとめ (YYYY/MM/DD)"
 * 2. キーワードセクション: "Keywords: keyword1, keyword2, ..."
 * 3. ツイート一覧: 上位3件にメダル絵文字（🥇🥈🥉）
 * 4. 統計情報: "取得: X件 → フィルタ後: Y件 → 表示: Z件"
 *
 * ## ツイート表示ルール
 * - 200文字を超えるテキストは省略（...付き）
 * - いいね数・リツイート数・ユーザー名を表示
 * - 投稿へのリンクを含む
 *
 * ## エラー通知
 * - エラーメッセージをコードブロックで表示
 * - 発生日時を含む
 * - エラー通知自体の送信失敗ではスローしない（無限ループ防止）
 *
 * ## 通知サマリー構築
 * - ProcessedTweet[] → NotificationSummary への変換
 * - 日本時間（JST/UTC+9）での日付生成
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SlackNotifier, buildNotificationSummary } from '../../src/services/slack-notifier';
import type { ProcessedTweet } from '../../src/types/x-api';
import { createNotificationSummary, createProcessedTweet, resetTweetIdCounter } from './fixtures';

// fetch をグローバルモック
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('Slack 通知仕様', () => {
  const webhookUrl = 'https://hooks.slack.com/services/T00/B00/XXXX';

  beforeEach(() => {
    vi.clearAllMocks();
    resetTweetIdCounter();
  });

  // ============================================================
  // 初期化仕様
  // ============================================================
  describe('Notifier 初期化', () => {
    it('有効な Webhook URL でインスタンスを生成できること', () => {
      const notifier = new SlackNotifier(webhookUrl);
      expect(notifier).toBeInstanceOf(SlackNotifier);
    });

    it('空の Webhook URL ではエラーをスローすること', () => {
      expect(() => new SlackNotifier('')).toThrow(
        'SLACK_WEBHOOK_URL が設定されていません'
      );
    });
  });

  // ============================================================
  // 日次サマリー送信仕様
  // ============================================================
  describe('日次サマリー送信 (sendDailySummary)', () => {
    it('Webhook URL に POST リクエストを送信すること', async () => {
      const notifier = new SlackNotifier(webhookUrl);
      mockFetch.mockResolvedValueOnce(new Response('ok', { status: 200 }));

      const summary = createNotificationSummary();
      await notifier.sendDailySummary(summary);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe(webhookUrl);
      expect(options.method).toBe('POST');
    });

    it('Content-Type は application/json であること', async () => {
      const notifier = new SlackNotifier(webhookUrl);
      mockFetch.mockResolvedValueOnce(new Response('ok', { status: 200 }));

      await notifier.sendDailySummary(createNotificationSummary());

      const options = mockFetch.mock.calls[0][1] as RequestInit;
      expect(options.headers).toHaveProperty('Content-Type', 'application/json');
    });

    it('ペイロードに blocks 配列が含まれること', async () => {
      const notifier = new SlackNotifier(webhookUrl);
      mockFetch.mockResolvedValueOnce(new Response('ok', { status: 200 }));

      await notifier.sendDailySummary(createNotificationSummary());

      const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
      expect(body).toHaveProperty('blocks');
      expect(Array.isArray(body.blocks)).toBe(true);
    });

    it('ペイロードにフォールバックテキストが含まれること', async () => {
      const notifier = new SlackNotifier(webhookUrl);
      mockFetch.mockResolvedValueOnce(new Response('ok', { status: 200 }));

      const summary = createNotificationSummary({ date: '2026/02/10' });
      await notifier.sendDailySummary(summary);

      const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
      expect(body.text).toContain('本日のトピックまとめ');
      expect(body.text).toContain('2026/02/10');
    });
  });

  // ============================================================
  // Block Kit フォーマット仕様
  // ============================================================
  describe('Block Kit フォーマット', () => {
    it('ヘッダーブロックに日付入りタイトルが含まれること', async () => {
      const notifier = new SlackNotifier(webhookUrl);
      mockFetch.mockResolvedValueOnce(new Response('ok', { status: 200 }));

      const summary = createNotificationSummary({ date: '2026/02/10' });
      await notifier.sendDailySummary(summary);

      const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
      const headerBlock = body.blocks.find((b: any) => b.type === 'header');
      expect(headerBlock).toBeDefined();
      expect(headerBlock.text.text).toContain('本日のトピックまとめ');
      expect(headerBlock.text.text).toContain('2026/02/10');
    });

    it('キーワードセクションに全キーワードがカンマ区切りで表示されること', async () => {
      const notifier = new SlackNotifier(webhookUrl);
      mockFetch.mockResolvedValueOnce(new Response('ok', { status: 200 }));

      const summary = createNotificationSummary({
        keywords: ['#Rails', '#Ruby', 'Next.js'],
      });
      await notifier.sendDailySummary(summary);

      const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
      const sections = body.blocks.filter((b: any) => b.type === 'section');
      const keywordSection = sections.find((s: any) =>
        s.text?.text?.includes('Keywords')
      );
      expect(keywordSection).toBeDefined();
      expect(keywordSection.text.text).toContain('#Rails');
      expect(keywordSection.text.text).toContain('#Ruby');
      expect(keywordSection.text.text).toContain('Next.js');
    });

    it('上位3件のツイートにメダル絵文字が表示されること', async () => {
      const notifier = new SlackNotifier(webhookUrl);
      mockFetch.mockResolvedValueOnce(new Response('ok', { status: 200 }));

      const summary = createNotificationSummary({
        tweets: [
          { id: '1', text: 'First', author: 'A', username: 'a', likes: 100, retweets: 10, url: 'https://x.com/a/status/1' },
          { id: '2', text: 'Second', author: 'B', username: 'b', likes: 80, retweets: 8, url: 'https://x.com/b/status/2' },
          { id: '3', text: 'Third', author: 'C', username: 'c', likes: 60, retweets: 6, url: 'https://x.com/c/status/3' },
          { id: '4', text: 'Fourth', author: 'D', username: 'd', likes: 40, retweets: 4, url: 'https://x.com/d/status/4' },
        ],
      });
      await notifier.sendDailySummary(summary);

      const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
      const sections = body.blocks.filter((b: any) => b.type === 'section');
      const tweetSections = sections.filter((s: any) => s.text?.text?.includes('❤️'));

      // 上位3件にはメダル
      expect(tweetSections[0].text.text).toContain('🥇');
      expect(tweetSections[1].text.text).toContain('🥈');
      expect(tweetSections[2].text.text).toContain('🥉');
      // 4件目にはメダルなし
      expect(tweetSections[3].text.text).not.toMatch(/🥇|🥈|🥉/);
    });

    it('ツイートセクションにいいね数・リツイート数・ユーザー名が表示されること', async () => {
      const notifier = new SlackNotifier(webhookUrl);
      mockFetch.mockResolvedValueOnce(new Response('ok', { status: 200 }));

      const summary = createNotificationSummary({
        tweets: [
          { id: '1', text: 'Test tweet', author: 'Test Author', username: 'test_author', likes: 42, retweets: 15, url: 'https://x.com/test_author/status/1' },
        ],
      });
      await notifier.sendDailySummary(summary);

      const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
      const tweetSection = body.blocks.find(
        (b: any) => b.type === 'section' && b.text?.text?.includes('❤️')
      );
      expect(tweetSection.text.text).toContain('❤️ 42');
      expect(tweetSection.text.text).toContain('🔁 15');
      expect(tweetSection.text.text).toContain('@test_author');
    });

    it('ツイートテキストが200文字を超える場合は省略されること', async () => {
      const notifier = new SlackNotifier(webhookUrl);
      mockFetch.mockResolvedValueOnce(new Response('ok', { status: 200 }));

      const longText = 'A'.repeat(250);
      const summary = createNotificationSummary({
        tweets: [
          { id: '1', text: longText, author: 'A', username: 'a', likes: 10, retweets: 1, url: 'https://x.com/a/status/1' },
        ],
      });
      await notifier.sendDailySummary(summary);

      const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
      const tweetSection = body.blocks.find(
        (b: any) => b.type === 'section' && b.text?.text?.includes('❤️')
      );
      // 200文字+省略記号
      expect(tweetSection.text.text).toContain('...');
      expect(tweetSection.text.text).not.toContain('A'.repeat(250));
    });

    it('ツイートテキストが200文字以下の場合はそのまま表示されること', async () => {
      const notifier = new SlackNotifier(webhookUrl);
      mockFetch.mockResolvedValueOnce(new Response('ok', { status: 200 }));

      const shortText = 'Short tweet text';
      const summary = createNotificationSummary({
        tweets: [
          { id: '1', text: shortText, author: 'A', username: 'a', likes: 10, retweets: 1, url: 'https://x.com/a/status/1' },
        ],
      });
      await notifier.sendDailySummary(summary);

      const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
      const tweetSection = body.blocks.find(
        (b: any) => b.type === 'section' && b.text?.text?.includes('Short tweet text')
      );
      expect(tweetSection).toBeDefined();
    });

    it('ツイートへのリンクが含まれること', async () => {
      const notifier = new SlackNotifier(webhookUrl);
      mockFetch.mockResolvedValueOnce(new Response('ok', { status: 200 }));

      const summary = createNotificationSummary({
        tweets: [
          { id: '1', text: 'Test', author: 'A', username: 'a', likes: 10, retweets: 1, url: 'https://x.com/a/status/1' },
        ],
      });
      await notifier.sendDailySummary(summary);

      const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
      const tweetSection = body.blocks.find(
        (b: any) => b.type === 'section' && b.text?.text?.includes('❤️')
      );
      expect(tweetSection.text.text).toContain('<https://x.com/a/status/1|');
      expect(tweetSection.text.text).toContain('投稿を見る');
    });

    it('統計情報セクションに取得件数・フィルタ後件数・表示件数が含まれること', async () => {
      const notifier = new SlackNotifier(webhookUrl);
      mockFetch.mockResolvedValueOnce(new Response('ok', { status: 200 }));

      const summary = createNotificationSummary({
        stats: { fetched: 50, filtered: 15, displayed: 10 },
      });
      await notifier.sendDailySummary(summary);

      const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
      const contextBlock = body.blocks.find((b: any) => b.type === 'context');
      expect(contextBlock).toBeDefined();
      const text = contextBlock.elements[0].text;
      expect(text).toContain('取得: 50件');
      expect(text).toContain('フィルタ後: 15件');
      expect(text).toContain('表示: 10件');
    });

    it('ツイートがない場合は「該当する投稿はありませんでした」と表示されること', async () => {
      const notifier = new SlackNotifier(webhookUrl);
      mockFetch.mockResolvedValueOnce(new Response('ok', { status: 200 }));

      const summary = createNotificationSummary({ tweets: [] });
      await notifier.sendDailySummary(summary);

      const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
      const noTweetSection = body.blocks.find(
        (b: any) => b.type === 'section' && b.text?.text?.includes('該当する投稿はありませんでした')
      );
      expect(noTweetSection).toBeDefined();
    });

    it('ブロック間にdividerが挿入されること', async () => {
      const notifier = new SlackNotifier(webhookUrl);
      mockFetch.mockResolvedValueOnce(new Response('ok', { status: 200 }));

      await notifier.sendDailySummary(createNotificationSummary());

      const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
      const dividers = body.blocks.filter((b: any) => b.type === 'divider');
      expect(dividers.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ============================================================
  // エラー通知仕様
  // ============================================================
  describe('エラー通知 (sendErrorNotification)', () => {
    it('エラーメッセージを含む通知を送信すること', async () => {
      const notifier = new SlackNotifier(webhookUrl);
      mockFetch.mockResolvedValueOnce(new Response('ok', { status: 200 }));

      await notifier.sendErrorNotification('テストエラーメッセージ');

      const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
      const errorSection = body.blocks.find(
        (b: any) => b.type === 'section' && b.text?.text?.includes('テストエラーメッセージ')
      );
      expect(errorSection).toBeDefined();
    });

    it('エラーヘッダーに「エラー」の文言が含まれること', async () => {
      const notifier = new SlackNotifier(webhookUrl);
      mockFetch.mockResolvedValueOnce(new Response('ok', { status: 200 }));

      await notifier.sendErrorNotification('test error');

      const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
      const header = body.blocks.find((b: any) => b.type === 'header');
      expect(header.text.text).toContain('エラー');
    });

    it('発生日時が含まれること', async () => {
      const notifier = new SlackNotifier(webhookUrl);
      mockFetch.mockResolvedValueOnce(new Response('ok', { status: 200 }));

      await notifier.sendErrorNotification('test error');

      const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
      const contextBlock = body.blocks.find((b: any) => b.type === 'context');
      expect(contextBlock).toBeDefined();
      expect(contextBlock.elements[0].text).toContain('発生日時');
    });

    it('エラー通知の送信自体が失敗してもスローしないこと（無限ループ防止）', async () => {
      const notifier = new SlackNotifier(webhookUrl);
      (notifier as any).sleep = vi.fn().mockResolvedValue(undefined);

      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'));

      // エラーがスローされないことを確認
      await expect(
        notifier.sendErrorNotification('test error')
      ).resolves.toBeUndefined();
    });
  });

  // ============================================================
  // リトライ仕様
  // ============================================================
  describe('送信リトライポリシー', () => {
    it('送信失敗時にリトライされること', async () => {
      // sleep をモックして即座に解決させる
      const notifier = new SlackNotifier(webhookUrl);
      (notifier as any).sleep = vi.fn().mockResolvedValue(undefined);

      // 1回目: 失敗 → 2回目: 成功
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(new Response('ok', { status: 200 }));

      await notifier.sendDailySummary(createNotificationSummary());

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('最大リトライ回数（2回）を超えた場合はエラーをスローすること', async () => {
      const notifier = new SlackNotifier(webhookUrl);
      (notifier as any).sleep = vi.fn().mockResolvedValue(undefined);

      // 3回全て失敗（初回 + 2回リトライ）
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'));

      await expect(
        notifier.sendDailySummary(createNotificationSummary())
      ).rejects.toThrow();
    });

    it('HTTPエラーレスポンス（4xx/5xx）でもリトライされること', async () => {
      const notifier = new SlackNotifier(webhookUrl);
      (notifier as any).sleep = vi.fn().mockResolvedValue(undefined);

      // 1回目: 500 → 2回目: 成功
      mockFetch
        .mockResolvedValueOnce(new Response('Server Error', { status: 500, statusText: 'Internal Server Error' }))
        .mockResolvedValueOnce(new Response('ok', { status: 200 }));

      await notifier.sendDailySummary(createNotificationSummary());

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  // ============================================================
  // 通知サマリー構築仕様
  // ============================================================
  describe('通知サマリー構築 (buildNotificationSummary)', () => {
    it('ProcessedTweet 配列から NotificationSummary を生成すること', () => {
      const tweets: ProcessedTweet[] = [
        createProcessedTweet({
          id: 'tweet_1',
          text: 'Rails is great',
          author: { name: 'Rails Dev', username: 'rails_dev' },
          likes: 100,
          retweets: 50,
          url: 'https://x.com/rails_dev/status/tweet_1',
        }),
      ];

      const summary = buildNotificationSummary(tweets, ['#Rails'], 10, 5);

      expect(summary.keywords).toEqual(['#Rails']);
      expect(summary.tweets).toHaveLength(1);
      expect(summary.tweets[0].id).toBe('tweet_1');
      expect(summary.tweets[0].author).toBe('Rails Dev');
      expect(summary.tweets[0].username).toBe('rails_dev');
      expect(summary.tweets[0].likes).toBe(100);
      expect(summary.tweets[0].retweets).toBe(50);
    });

    it('日付は JST（UTC+9）形式 YYYY/MM/DD であること', () => {
      // UTCでの特定の日時を設定 (JSTでは 2026-02-10 09:00:00)
      vi.useFakeTimers();
      try {
        vi.setSystemTime(new Date('2026-02-10T00:00:00.000Z'));

        const tweets: ProcessedTweet[] = [];
        const summary = buildNotificationSummary(tweets, [], 0, 0);

        expect(summary.date).toBe('2026/02/10');
      } finally {
        vi.useRealTimers();
      }
    });

    it('UTC深夜でもJST換算で正しい日付になること', () => {
      // UTC 2026-02-09 20:00 = JST 2026-02-10 05:00 → 日付は 2026/02/10
      vi.useFakeTimers();
      try {
        vi.setSystemTime(new Date('2026-02-09T20:00:00.000Z'));

        const summary = buildNotificationSummary([], [], 0, 0);

        expect(summary.date).toBe('2026/02/10');
      } finally {
        vi.useRealTimers();
      }
    });

    it('統計情報に fetched, filtered, displayed が含まれること', () => {
      const tweets: ProcessedTweet[] = [];
      const summary = buildNotificationSummary(tweets, [], 50, 15);

      expect(summary.stats.fetched).toBe(50);
      expect(summary.stats.filtered).toBe(15);
      expect(summary.stats.displayed).toBe(0); // tweets.length
    });

    it('ツイートが空の場合でも正常にサマリーを生成すること', () => {
      const summary = buildNotificationSummary([], ['#Rails'], 0, 0);

      expect(summary.tweets).toHaveLength(0);
      expect(summary.stats.displayed).toBe(0);
    });

    it('ProcessedTweet の author.name が summary の author にマッピングされること', () => {
      const tweets: ProcessedTweet[] = [
        createProcessedTweet({
          author: { name: 'Display Name', username: 'handle' },
        }),
      ];

      const summary = buildNotificationSummary(tweets, [], 1, 1);

      expect(summary.tweets[0].author).toBe('Display Name');
      expect(summary.tweets[0].username).toBe('handle');
    });
  });
});
