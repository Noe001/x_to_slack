/**
 * テスト共通フィクスチャ
 *
 * TDDにおける仕様記述のためのテストデータ定義。
 * システム全体で共通利用されるモックデータとヘルパーを提供する。
 */

import type { TweetSearchResponse, Tweet, User, ProcessedTweet } from '../../src/types/x-api';
import type { KeywordConfig, GlobalSettings, KeywordEntry } from '../../src/types/config';
import type { NotificationSummary } from '../../src/types/slack';

// ============================================================
// ユーザーデータ
// ============================================================

export const users: Record<string, User> = {
  railsDev: { id: 'user1', name: 'Rails Developer', username: 'rails_dev' },
  rubyFan: { id: 'user2', name: 'Ruby Enthusiast', username: 'ruby_fan' },
  nextjsPro: { id: 'user3', name: 'Next.js Pro', username: 'nextjs_pro' },
  honoLover: { id: 'user4', name: 'Hono Lover', username: 'hono_lover' },
};

// ============================================================
// ツイートデータファクトリ
// ============================================================

let tweetIdCounter = 0;

export function createTweet(overrides: Partial<Tweet> & { author_id: string }): Tweet {
  tweetIdCounter++;
  return {
    id: `tweet_${tweetIdCounter}`,
    text: `Test tweet ${tweetIdCounter}`,
    created_at: '2026-02-10T08:00:00.000Z',
    public_metrics: {
      like_count: 10,
      retweet_count: 5,
      reply_count: 2,
      quote_count: 1,
      bookmark_count: 3,
      impression_count: 1000,
    },
    ...overrides,
  };
}

export function createProcessedTweet(overrides: Partial<ProcessedTweet> = {}): ProcessedTweet {
  tweetIdCounter++;
  return {
    id: `tweet_${tweetIdCounter}`,
    text: `Processed tweet ${tweetIdCounter}`,
    author: { name: 'Test User', username: 'test_user' },
    created_at: '2026-02-10T08:00:00.000Z',
    likes: 10,
    retweets: 5,
    url: `https://x.com/test_user/status/tweet_${tweetIdCounter}`,
    ...overrides,
  };
}

export function resetTweetIdCounter(): void {
  tweetIdCounter = 0;
}

// ============================================================
// X API レスポンスファクトリ
// ============================================================

export function createSearchResponse(
  tweets: Tweet[],
  responseUsers: User[]
): TweetSearchResponse {
  return {
    data: tweets,
    includes: { users: responseUsers },
    meta: {
      newest_id: tweets[0]?.id,
      oldest_id: tweets[tweets.length - 1]?.id,
      result_count: tweets.length,
    },
  };
}

export function createEmptyResponse(): TweetSearchResponse {
  return {
    data: [],
    meta: { result_count: 0 },
  };
}

// ============================================================
// 設定データファクトリ
// ============================================================

export function createGlobalSettings(
  overrides: Partial<GlobalSettings> = {}
): GlobalSettings {
  return {
    min_likes: 3,
    max_results: 50,
    lang: 'ja',
    ...overrides,
  };
}

export function createKeywordEntry(
  term: string,
  minLikes?: number
): KeywordEntry {
  const entry: KeywordEntry = { term };
  if (minLikes !== undefined) {
    entry.min_likes = minLikes;
  }
  return entry;
}

export function createKeywordConfig(
  overrides: Partial<KeywordConfig> = {}
): KeywordConfig {
  return {
    version: 1,
    global_settings: createGlobalSettings(),
    keywords: [
      createKeywordEntry('#Rails', 5),
      createKeywordEntry('#Ruby'),
      createKeywordEntry('Next.js'),
      createKeywordEntry('Hono Framework'),
    ],
    ...overrides,
  };
}

// ============================================================
// 通知サマリーファクトリ
// ============================================================

export function createNotificationSummary(
  overrides: Partial<NotificationSummary> = {}
): NotificationSummary {
  return {
    date: '2026/02/10',
    keywords: ['#Rails', '#Ruby', 'Next.js'],
    tweets: [
      {
        id: 'tweet_1',
        text: 'Rails 8の新機能が素晴らしい',
        author: 'Rails Developer',
        username: 'rails_dev',
        likes: 120,
        retweets: 45,
        url: 'https://x.com/rails_dev/status/tweet_1',
      },
      {
        id: 'tweet_2',
        text: 'Ruby 3.3のパフォーマンス改善',
        author: 'Ruby Enthusiast',
        username: 'ruby_fan',
        likes: 85,
        retweets: 20,
        url: 'https://x.com/ruby_fan/status/tweet_2',
      },
    ],
    stats: {
      fetched: 50,
      filtered: 15,
      displayed: 2,
    },
    ...overrides,
  };
}

// ============================================================
// 環境変数モック
// ============================================================

export function createMockEnv() {
  return {
    X_BEARER_TOKEN: 'test-bearer-token-12345',
    SLACK_WEBHOOK_URL: 'https://hooks.slack.com/services/T00/B00/XXXX',
    MANUAL_TRIGGER_KEY: 'test-trigger-key',
  };
}

// ============================================================
// fetch モックヘルパー
// ============================================================

export function createMockFetchResponse(
  body: any,
  status: number = 200,
  headers: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}
