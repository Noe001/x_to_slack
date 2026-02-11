/**
 * tweet-processor.ts のユニットテスト
 */

import { describe, it, expect } from 'vitest';
import { processTweets } from '../../src/services/tweet-processor';
import type { TweetSearchResponse } from '../../src/types/x-api';

describe('tweet-processor', () => {
  describe('processTweets', () => {
    it('ツイートを正しく処理し、いいね数でフィルタリングする', () => {
      const response: TweetSearchResponse = {
        data: [
          {
            id: '1',
            text: 'Rails 8 is amazing!',
            author_id: 'user1',
            created_at: '2026-02-10T00:00:00.000Z',
            public_metrics: {
              like_count: 10,
              retweet_count: 5,
              reply_count: 2,
              quote_count: 1,
              bookmark_count: 0,
              impression_count: 100,
            },
          },
          {
            id: '2',
            text: 'Learning Ruby today',
            author_id: 'user2',
            created_at: '2026-02-10T01:00:00.000Z',
            public_metrics: {
              like_count: 2,
              retweet_count: 1,
              reply_count: 0,
              quote_count: 0,
              bookmark_count: 0,
              impression_count: 50,
            },
          },
        ],
        includes: {
          users: [
            { id: 'user1', name: 'User One', username: 'user_one' },
            { id: 'user2', name: 'User Two', username: 'user_two' },
          ],
        },
        meta: {
          result_count: 2,
        },
      };

      const processed = processTweets(response, 3, 10);

      // いいね数が3以上のツイートのみ残る
      expect(processed).toHaveLength(1);
      expect(processed[0].id).toBe('1');
      expect(processed[0].likes).toBe(10);
      expect(processed[0].author.username).toBe('user_one');
    });

    it('いいね数で降順にソートする', () => {
      const response: TweetSearchResponse = {
        data: [
          {
            id: '1',
            text: 'Tweet 1',
            author_id: 'user1',
            created_at: '2026-02-10T00:00:00.000Z',
            public_metrics: {
              like_count: 5,
              retweet_count: 0,
              reply_count: 0,
              quote_count: 0,
              bookmark_count: 0,
              impression_count: 0,
            },
          },
          {
            id: '2',
            text: 'Tweet 2',
            author_id: 'user1',
            created_at: '2026-02-10T01:00:00.000Z',
            public_metrics: {
              like_count: 20,
              retweet_count: 0,
              reply_count: 0,
              quote_count: 0,
              bookmark_count: 0,
              impression_count: 0,
            },
          },
          {
            id: '3',
            text: 'Tweet 3',
            author_id: 'user1',
            created_at: '2026-02-10T02:00:00.000Z',
            public_metrics: {
              like_count: 10,
              retweet_count: 0,
              reply_count: 0,
              quote_count: 0,
              bookmark_count: 0,
              impression_count: 0,
            },
          },
        ],
        includes: {
          users: [{ id: 'user1', name: 'User', username: 'user' }],
        },
        meta: {
          result_count: 3,
        },
      };

      const processed = processTweets(response, 0, 10);

      expect(processed).toHaveLength(3);
      expect(processed[0].likes).toBe(20);
      expect(processed[1].likes).toBe(10);
      expect(processed[2].likes).toBe(5);
    });

    it('重複するツイートを除外する', () => {
      const duplicateText = 'This is a duplicate tweet text that appears multiple times';

      const response: TweetSearchResponse = {
        data: [
          {
            id: '1',
            text: duplicateText,
            author_id: 'user1',
            created_at: '2026-02-10T00:00:00.000Z',
            public_metrics: {
              like_count: 10,
              retweet_count: 0,
              reply_count: 0,
              quote_count: 0,
              bookmark_count: 0,
              impression_count: 0,
            },
          },
          {
            id: '2',
            text: duplicateText,
            author_id: 'user2',
            created_at: '2026-02-10T01:00:00.000Z',
            public_metrics: {
              like_count: 15,
              retweet_count: 0,
              reply_count: 0,
              quote_count: 0,
              bookmark_count: 0,
              impression_count: 0,
            },
          },
          {
            id: '3',
            text: 'This is a unique tweet',
            author_id: 'user1',
            created_at: '2026-02-10T02:00:00.000Z',
            public_metrics: {
              like_count: 20,
              retweet_count: 0,
              reply_count: 0,
              quote_count: 0,
              bookmark_count: 0,
              impression_count: 0,
            },
          },
        ],
        includes: {
          users: [
            { id: 'user1', name: 'User One', username: 'user_one' },
            { id: 'user2', name: 'User Two', username: 'user_two' },
          ],
        },
        meta: {
          result_count: 3,
        },
      };

      const processed = processTweets(response, 0, 10);

      // 重複が除外され、2件のみ残る
      expect(processed).toHaveLength(2);
      expect(processed[0].id).toBe('3'); // 最もいいね数が多い
      expect(processed[1].id).toBe('1'); // 重複の最初
    });

    it('表示件数制限が正しく適用される', () => {
      const tweets = Array.from({ length: 20 }, (_, i) => ({
        id: `${i + 1}`,
        text: `Tweet ${i + 1}`,
        author_id: 'user1',
        created_at: '2026-02-10T00:00:00.000Z',
        public_metrics: {
          like_count: 20 - i, // 降順にいいね数を設定
          retweet_count: 0,
          reply_count: 0,
          quote_count: 0,
          bookmark_count: 0,
          impression_count: 0,
        },
      }));

      const response: TweetSearchResponse = {
        data: tweets,
        includes: {
          users: [{ id: 'user1', name: 'User', username: 'user' }],
        },
        meta: {
          result_count: 20,
        },
      };

      const processed = processTweets(response, 0, 5);

      // 上位5件のみ表示される
      expect(processed).toHaveLength(5);
      expect(processed[0].likes).toBe(20);
      expect(processed[4].likes).toBe(16);
    });

    it('データがない場合は空配列を返す', () => {
      const response: TweetSearchResponse = {
        data: [],
        meta: {
          result_count: 0,
        },
      };

      const processed = processTweets(response, 3, 10);

      expect(processed).toHaveLength(0);
    });

    it('ユーザー情報が見つからないツイートはスキップする', () => {
      const response: TweetSearchResponse = {
        data: [
          {
            id: '1',
            text: 'Tweet with valid user',
            author_id: 'user1',
            created_at: '2026-02-10T00:00:00.000Z',
            public_metrics: {
              like_count: 10,
              retweet_count: 0,
              reply_count: 0,
              quote_count: 0,
              bookmark_count: 0,
              impression_count: 0,
            },
          },
          {
            id: '2',
            text: 'Tweet with missing user',
            author_id: 'user_missing',
            created_at: '2026-02-10T01:00:00.000Z',
            public_metrics: {
              like_count: 20,
              retweet_count: 0,
              reply_count: 0,
              quote_count: 0,
              bookmark_count: 0,
              impression_count: 0,
            },
          },
        ],
        includes: {
          users: [{ id: 'user1', name: 'User One', username: 'user_one' }],
        },
        meta: {
          result_count: 2,
        },
      };

      const processed = processTweets(response, 0, 10);

      // ユーザー情報が見つからないツイートは除外される
      expect(processed).toHaveLength(1);
      expect(processed[0].id).toBe('1');
    });
  });
});
