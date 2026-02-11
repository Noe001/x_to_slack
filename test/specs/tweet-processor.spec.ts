/**
 * ============================================================
 * ツイート処理パイプライン仕様 (Tweet Processing Pipeline Specification)
 * ============================================================
 *
 * このテストファイルはツイート処理パイプラインの仕様を定義する。
 *
 * ## 処理パイプライン（順序が重要）
 * 1. X API レスポンスからツイートとユーザー情報を抽出
 * 2. ユーザーIDマップを構築しツイートと紐付け
 * 3. ProcessedTweet 形式に変換
 * 4. いいね数による品質フィルタ（>= minLikes）
 * 5. コンテンツ重複排除（先頭100文字比較）
 * 6. いいね数による降順ソート
 * 7. 表示件数制限の適用（デフォルト10件）
 *
 * ## 重複判定ルール
 * - ツイート本文の先頭100文字をtrimした文字列で比較
 * - 同一テキストの場合、先に出現したものを残す
 * - Bot投稿や定型ツイートのスパム除去を目的とする
 *
 * ## ProcessedTweet 構造
 * - id: ツイートID
 * - text: 本文
 * - author: { name, username }
 * - created_at: 作成日時
 * - likes: いいね数
 * - retweets: リツイート数
 * - url: `https://x.com/{username}/status/{id}`
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { processTweets } from '../../src/services/tweet-processor';
import type { TweetSearchResponse } from '../../src/types/x-api';
import {
  createTweet,
  createSearchResponse,
  createEmptyResponse,
  users,
  resetTweetIdCounter,
} from './fixtures';

describe('ツイート処理パイプライン仕様', () => {
  beforeEach(() => {
    resetTweetIdCounter();
  });

  // ============================================================
  // パイプライン全体の動作仕様
  // ============================================================
  describe('パイプライン全体の動作', () => {
    it('正常なレスポンスから ProcessedTweet 配列を返すこと', () => {
      const tweets = [
        createTweet({
          author_id: users.railsDev.id,
          text: 'Rails 8 is amazing!',
          public_metrics: {
            like_count: 50, retweet_count: 10,
            reply_count: 5, quote_count: 2,
            bookmark_count: 3, impression_count: 1000,
          },
        }),
      ];
      const response = createSearchResponse(tweets, [users.railsDev]);

      const result = processTweets(response, 0);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('text');
      expect(result[0]).toHaveProperty('author');
      expect(result[0]).toHaveProperty('created_at');
      expect(result[0]).toHaveProperty('likes');
      expect(result[0]).toHaveProperty('retweets');
      expect(result[0]).toHaveProperty('url');
    });

    it('パイプラインの処理順序: フィルタ → 重複排除 → ソート → 制限', () => {
      // いいね数: tweet1=2(フィルタ除外), tweet2=10, tweet3=10(重複), tweet4=5
      const tweets = [
        createTweet({
          author_id: users.railsDev.id,
          text: 'Low likes tweet',
          public_metrics: {
            like_count: 2, retweet_count: 0,
            reply_count: 0, quote_count: 0,
            bookmark_count: 0, impression_count: 0,
          },
        }),
        createTweet({
          author_id: users.rubyFan.id,
          text: 'Popular unique tweet with enough characters to be properly identified as unique content',
          public_metrics: {
            like_count: 10, retweet_count: 5,
            reply_count: 0, quote_count: 0,
            bookmark_count: 0, impression_count: 0,
          },
        }),
        createTweet({
          author_id: users.nextjsPro.id,
          text: 'Popular unique tweet with enough characters to be properly identified as unique content',
          public_metrics: {
            like_count: 10, retweet_count: 3,
            reply_count: 0, quote_count: 0,
            bookmark_count: 0, impression_count: 0,
          },
        }),
        createTweet({
          author_id: users.honoLover.id,
          text: 'Medium popularity tweet',
          public_metrics: {
            like_count: 5, retweet_count: 1,
            reply_count: 0, quote_count: 0,
            bookmark_count: 0, impression_count: 0,
          },
        }),
      ];
      const response = createSearchResponse(tweets, Object.values(users));

      const result = processTweets(response, 3, 10);

      // フィルタ: likes<3のtweet1除外 → 3件
      // 重複排除: tweet2とtweet3は同一テキスト → 2件（tweet2が残る）
      // ソート: likes降順 → tweet2(10), tweet4(5)
      expect(result).toHaveLength(2);
      expect(result[0].likes).toBe(10);
      expect(result[1].likes).toBe(5);
    });
  });

  // ============================================================
  // いいね数フィルタ仕様
  // ============================================================
  describe('品質フィルタ（いいね数ベース）', () => {
    it('minLikes 以上のツイートのみ残すこと', () => {
      const tweets = [
        createTweet({
          author_id: users.railsDev.id,
          text: 'High likes',
          public_metrics: {
            like_count: 10, retweet_count: 0,
            reply_count: 0, quote_count: 0,
            bookmark_count: 0, impression_count: 0,
          },
        }),
        createTweet({
          author_id: users.rubyFan.id,
          text: 'Low likes',
          public_metrics: {
            like_count: 2, retweet_count: 0,
            reply_count: 0, quote_count: 0,
            bookmark_count: 0, impression_count: 0,
          },
        }),
      ];
      const response = createSearchResponse(tweets, [users.railsDev, users.rubyFan]);

      const result = processTweets(response, 5);

      expect(result).toHaveLength(1);
      expect(result[0].likes).toBe(10);
    });

    it('minLikes と同じいいね数のツイートは残ること（>=）', () => {
      const tweets = [
        createTweet({
          author_id: users.railsDev.id,
          text: 'Exactly 5 likes',
          public_metrics: {
            like_count: 5, retweet_count: 0,
            reply_count: 0, quote_count: 0,
            bookmark_count: 0, impression_count: 0,
          },
        }),
      ];
      const response = createSearchResponse(tweets, [users.railsDev]);

      const result = processTweets(response, 5);

      expect(result).toHaveLength(1);
      expect(result[0].likes).toBe(5);
    });

    it('minLikes が 0 の場合、いいね数 0 のツイートも含まれること', () => {
      const tweets = [
        createTweet({
          author_id: users.railsDev.id,
          text: 'Zero likes tweet',
          public_metrics: {
            like_count: 0, retweet_count: 0,
            reply_count: 0, quote_count: 0,
            bookmark_count: 0, impression_count: 0,
          },
        }),
      ];
      const response = createSearchResponse(tweets, [users.railsDev]);

      const result = processTweets(response, 0);

      expect(result).toHaveLength(1);
    });

    it('全てのツイートがフィルタ条件を満たさない場合、空配列を返すこと', () => {
      const tweets = [
        createTweet({
          author_id: users.railsDev.id,
          text: 'Only 1 like',
          public_metrics: {
            like_count: 1, retweet_count: 0,
            reply_count: 0, quote_count: 0,
            bookmark_count: 0, impression_count: 0,
          },
        }),
        createTweet({
          author_id: users.rubyFan.id,
          text: 'Only 2 likes',
          public_metrics: {
            like_count: 2, retweet_count: 0,
            reply_count: 0, quote_count: 0,
            bookmark_count: 0, impression_count: 0,
          },
        }),
      ];
      const response = createSearchResponse(tweets, [users.railsDev, users.rubyFan]);

      const result = processTweets(response, 100);

      expect(result).toHaveLength(0);
    });
  });

  // ============================================================
  // 重複排除仕様
  // ============================================================
  describe('コンテンツ重複排除（先頭100文字比較）', () => {
    it('先頭100文字が同一のツイートは重複とみなされること', () => {
      const duplicateText = 'A'.repeat(100) + ' - different ending 1';
      const duplicateText2 = 'A'.repeat(100) + ' - different ending 2';

      const tweets = [
        createTweet({
          author_id: users.railsDev.id,
          text: duplicateText,
          public_metrics: {
            like_count: 10, retweet_count: 0,
            reply_count: 0, quote_count: 0,
            bookmark_count: 0, impression_count: 0,
          },
        }),
        createTweet({
          author_id: users.rubyFan.id,
          text: duplicateText2,
          public_metrics: {
            like_count: 20, retweet_count: 0,
            reply_count: 0, quote_count: 0,
            bookmark_count: 0, impression_count: 0,
          },
        }),
      ];
      const response = createSearchResponse(tweets, [users.railsDev, users.rubyFan]);

      const result = processTweets(response, 0);

      // 重複排除はフィルタ後に行われるため、先に出現したものが残る
      expect(result).toHaveLength(1);
    });

    it('先頭100文字が異なるツイートは別物として扱われること', () => {
      const tweets = [
        createTweet({
          author_id: users.railsDev.id,
          text: 'Unique tweet about Rails framework development in production',
          public_metrics: {
            like_count: 10, retweet_count: 0,
            reply_count: 0, quote_count: 0,
            bookmark_count: 0, impression_count: 0,
          },
        }),
        createTweet({
          author_id: users.rubyFan.id,
          text: 'Another unique tweet about Ruby programming language',
          public_metrics: {
            like_count: 15, retweet_count: 0,
            reply_count: 0, quote_count: 0,
            bookmark_count: 0, impression_count: 0,
          },
        }),
      ];
      const response = createSearchResponse(tweets, [users.railsDev, users.rubyFan]);

      const result = processTweets(response, 0);

      expect(result).toHaveLength(2);
    });

    it('完全に同一のテキストは重複として排除されること', () => {
      const sameText = 'This is the exact same tweet posted by a bot';

      const tweets = [
        createTweet({
          author_id: users.railsDev.id,
          text: sameText,
          public_metrics: {
            like_count: 10, retweet_count: 0,
            reply_count: 0, quote_count: 0,
            bookmark_count: 0, impression_count: 0,
          },
        }),
        createTweet({
          author_id: users.rubyFan.id,
          text: sameText,
          public_metrics: {
            like_count: 20, retweet_count: 0,
            reply_count: 0, quote_count: 0,
            bookmark_count: 0, impression_count: 0,
          },
        }),
        createTweet({
          author_id: users.nextjsPro.id,
          text: sameText,
          public_metrics: {
            like_count: 5, retweet_count: 0,
            reply_count: 0, quote_count: 0,
            bookmark_count: 0, impression_count: 0,
          },
        }),
      ];
      const response = createSearchResponse(
        tweets,
        [users.railsDev, users.rubyFan, users.nextjsPro]
      );

      const result = processTweets(response, 0);

      // 3件の重複から1件のみ残る
      expect(result).toHaveLength(1);
    });

    it('重複排除では先に出現したツイートが保持されること', () => {
      const sameText = 'Duplicate tweet content for testing';

      const tweets = [
        createTweet({
          id: 'first',
          author_id: users.railsDev.id,
          text: sameText,
          public_metrics: {
            like_count: 5, retweet_count: 0,
            reply_count: 0, quote_count: 0,
            bookmark_count: 0, impression_count: 0,
          },
        }),
        createTweet({
          id: 'second',
          author_id: users.rubyFan.id,
          text: sameText,
          public_metrics: {
            like_count: 100, retweet_count: 0,
            reply_count: 0, quote_count: 0,
            bookmark_count: 0, impression_count: 0,
          },
        }),
      ];
      const response = createSearchResponse(tweets, [users.railsDev, users.rubyFan]);

      const result = processTweets(response, 0);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('first');
    });
  });

  // ============================================================
  // ソート仕様
  // ============================================================
  describe('いいね数降順ソート', () => {
    it('いいね数の多い順にソートされること', () => {
      const tweets = [
        createTweet({
          author_id: users.railsDev.id,
          text: 'Low popularity tweet',
          public_metrics: {
            like_count: 5, retweet_count: 0,
            reply_count: 0, quote_count: 0,
            bookmark_count: 0, impression_count: 0,
          },
        }),
        createTweet({
          author_id: users.rubyFan.id,
          text: 'High popularity tweet',
          public_metrics: {
            like_count: 50, retweet_count: 0,
            reply_count: 0, quote_count: 0,
            bookmark_count: 0, impression_count: 0,
          },
        }),
        createTweet({
          author_id: users.nextjsPro.id,
          text: 'Medium popularity tweet',
          public_metrics: {
            like_count: 20, retweet_count: 0,
            reply_count: 0, quote_count: 0,
            bookmark_count: 0, impression_count: 0,
          },
        }),
      ];
      const response = createSearchResponse(
        tweets,
        [users.railsDev, users.rubyFan, users.nextjsPro]
      );

      const result = processTweets(response, 0);

      expect(result[0].likes).toBe(50);
      expect(result[1].likes).toBe(20);
      expect(result[2].likes).toBe(5);
    });

    it('いいね数が同じ場合でもエラーなくソートされること', () => {
      const tweets = [
        createTweet({
          author_id: users.railsDev.id,
          text: 'Same likes tweet A',
          public_metrics: {
            like_count: 10, retweet_count: 0,
            reply_count: 0, quote_count: 0,
            bookmark_count: 0, impression_count: 0,
          },
        }),
        createTweet({
          author_id: users.rubyFan.id,
          text: 'Same likes tweet B',
          public_metrics: {
            like_count: 10, retweet_count: 0,
            reply_count: 0, quote_count: 0,
            bookmark_count: 0, impression_count: 0,
          },
        }),
      ];
      const response = createSearchResponse(tweets, [users.railsDev, users.rubyFan]);

      const result = processTweets(response, 0);

      expect(result).toHaveLength(2);
      expect(result[0].likes).toBe(10);
      expect(result[1].likes).toBe(10);
    });
  });

  // ============================================================
  // 表示件数制限仕様
  // ============================================================
  describe('表示件数制限', () => {
    it('デフォルトの表示件数制限は10件であること', () => {
      const tweets = Array.from({ length: 15 }, (_, i) =>
        createTweet({
          author_id: users.railsDev.id,
          text: `Tweet number ${i + 1} with unique content`,
          public_metrics: {
            like_count: 100 - i, retweet_count: 0,
            reply_count: 0, quote_count: 0,
            bookmark_count: 0, impression_count: 0,
          },
        })
      );
      const response = createSearchResponse(tweets, [users.railsDev]);

      // displayLimit を省略してデフォルト値のテスト
      const result = processTweets(response, 0);

      expect(result).toHaveLength(10);
    });

    it('displayLimit で指定した件数に制限されること', () => {
      const tweets = Array.from({ length: 20 }, (_, i) =>
        createTweet({
          author_id: users.railsDev.id,
          text: `Unique tweet ${i + 1} for limit test`,
          public_metrics: {
            like_count: 20 - i, retweet_count: 0,
            reply_count: 0, quote_count: 0,
            bookmark_count: 0, impression_count: 0,
          },
        })
      );
      const response = createSearchResponse(tweets, [users.railsDev]);

      const result = processTweets(response, 0, 5);

      expect(result).toHaveLength(5);
    });

    it('件数制限はソート後に適用されること（上位N件が残る）', () => {
      const tweets = Array.from({ length: 10 }, (_, i) =>
        createTweet({
          author_id: users.railsDev.id,
          text: `Sorted tweet ${i + 1} for top-n test`,
          public_metrics: {
            like_count: (i + 1) * 10, retweet_count: 0,
            reply_count: 0, quote_count: 0,
            bookmark_count: 0, impression_count: 0,
          },
        })
      );
      const response = createSearchResponse(tweets, [users.railsDev]);

      const result = processTweets(response, 0, 3);

      // ソート後の上位3件（likes: 100, 90, 80）
      expect(result).toHaveLength(3);
      expect(result[0].likes).toBe(100);
      expect(result[1].likes).toBe(90);
      expect(result[2].likes).toBe(80);
    });

    it('ツイート数が制限値未満の場合、全件を返すこと', () => {
      const tweets = [
        createTweet({
          author_id: users.railsDev.id,
          text: 'Only tweet',
          public_metrics: {
            like_count: 10, retweet_count: 0,
            reply_count: 0, quote_count: 0,
            bookmark_count: 0, impression_count: 0,
          },
        }),
      ];
      const response = createSearchResponse(tweets, [users.railsDev]);

      const result = processTweets(response, 0, 10);

      expect(result).toHaveLength(1);
    });
  });

  // ============================================================
  // ユーザー情報解決仕様
  // ============================================================
  describe('ユーザー情報の解決', () => {
    it('author_id からユーザー情報を正しく解決すること', () => {
      const tweets = [
        createTweet({
          author_id: users.railsDev.id,
          text: 'Tweet by Rails dev',
          public_metrics: {
            like_count: 10, retweet_count: 5,
            reply_count: 0, quote_count: 0,
            bookmark_count: 0, impression_count: 0,
          },
        }),
      ];
      const response = createSearchResponse(tweets, [users.railsDev]);

      const result = processTweets(response, 0);

      expect(result[0].author.name).toBe('Rails Developer');
      expect(result[0].author.username).toBe('rails_dev');
    });

    it('対応するユーザー情報がないツイートはスキップされること', () => {
      const tweets = [
        createTweet({
          author_id: 'nonexistent_user',
          text: 'Tweet with missing user',
          public_metrics: {
            like_count: 100, retweet_count: 0,
            reply_count: 0, quote_count: 0,
            bookmark_count: 0, impression_count: 0,
          },
        }),
        createTweet({
          author_id: users.railsDev.id,
          text: 'Tweet with valid user',
          public_metrics: {
            like_count: 10, retweet_count: 0,
            reply_count: 0, quote_count: 0,
            bookmark_count: 0, impression_count: 0,
          },
        }),
      ];
      const response = createSearchResponse(tweets, [users.railsDev]);

      const result = processTweets(response, 0);

      // ユーザー情報なしのツイートは除外される
      expect(result).toHaveLength(1);
      expect(result[0].author.username).toBe('rails_dev');
    });

    it('ツイートURLは https://x.com/{username}/status/{id} 形式であること', () => {
      const tweet = createTweet({
        id: 'tweet_123',
        author_id: users.railsDev.id,
        text: 'URL test tweet',
        public_metrics: {
          like_count: 10, retweet_count: 0,
          reply_count: 0, quote_count: 0,
          bookmark_count: 0, impression_count: 0,
        },
      });
      const response = createSearchResponse([tweet], [users.railsDev]);

      const result = processTweets(response, 0);

      expect(result[0].url).toBe('https://x.com/rails_dev/status/tweet_123');
    });
  });

  // ============================================================
  // エッジケース仕様
  // ============================================================
  describe('エッジケース', () => {
    it('data が空配列の場合、空配列を返すこと', () => {
      const response = createEmptyResponse();
      const result = processTweets(response, 0);

      expect(result).toHaveLength(0);
    });

    it('data が undefined の場合、空配列を返すこと', () => {
      const response: TweetSearchResponse = {
        meta: { result_count: 0 },
      };
      const result = processTweets(response, 0);

      expect(result).toHaveLength(0);
    });

    it('includes.users が undefined の場合、空配列を返すこと', () => {
      const tweets = [
        createTweet({
          author_id: users.railsDev.id,
          text: 'No user info available',
          public_metrics: {
            like_count: 10, retweet_count: 0,
            reply_count: 0, quote_count: 0,
            bookmark_count: 0, impression_count: 0,
          },
        }),
      ];
      const response: TweetSearchResponse = {
        data: tweets,
        meta: { result_count: 1 },
      };

      const result = processTweets(response, 0);

      // ユーザー情報がないため全て除外される
      expect(result).toHaveLength(0);
    });

    it('ProcessedTweet にはリツイート数が含まれること', () => {
      const tweets = [
        createTweet({
          author_id: users.railsDev.id,
          text: 'Retweet count test',
          public_metrics: {
            like_count: 10, retweet_count: 25,
            reply_count: 0, quote_count: 0,
            bookmark_count: 0, impression_count: 0,
          },
        }),
      ];
      const response = createSearchResponse(tweets, [users.railsDev]);

      const result = processTweets(response, 0);

      expect(result[0].retweets).toBe(25);
    });
  });
});
