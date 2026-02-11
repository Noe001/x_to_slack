/**
 * ツイート処理ロジック（フィルタ・ソート・整形）
 */

import type { TweetSearchResponse, Tweet, User, ProcessedTweet } from '../types/x-api';
import { logger } from '../utils/logger';

const DUPLICATE_CHECK_LENGTH = 100; // 先頭100文字で重複判定
const DEFAULT_DISPLAY_LIMIT = 10; // デフォルトの表示件数

/**
 * ツイートを処理する
 * @param response X API レスポンス
 * @param minLikes 最小いいね数
 * @param displayLimit 表示件数制限
 * @returns 処理済みツイートの配列
 */
export function processTweets(
  response: TweetSearchResponse,
  minLikes: number,
  displayLimit: number = DEFAULT_DISPLAY_LIMIT
): ProcessedTweet[] {
  const tweets = response.data || [];
  const users = response.includes?.users || [];

  logger.info('ツイート処理を開始します', {
    fetchedCount: tweets.length,
    minLikes,
    displayLimit,
  });

  if (tweets.length === 0) {
    logger.info('取得したツイートが0件です');
    return [];
  }

  // ユーザー情報のマップを作成（高速検索用）
  const userMap = createUserMap(users);

  // ツイートを処理済み形式に変換
  const processedTweets = tweets
    .map((tweet) => convertToProcessedTweet(tweet, userMap))
    .filter((tweet): tweet is ProcessedTweet => tweet !== null);

  // 1. 品質フィルタ（いいね数）
  const filteredByLikes = filterByLikes(processedTweets, minLikes);

  // 2. 重複排除
  const deduplicated = removeDuplicates(filteredByLikes);

  // 3. ソート（いいね数降順）
  const sorted = sortByLikes(deduplicated);

  // 4. 件数制限
  const limited = sorted.slice(0, displayLimit);

  logger.info('ツイート処理が完了しました', {
    fetchedCount: tweets.length,
    afterFilter: filteredByLikes.length,
    afterDedup: deduplicated.length,
    displayed: limited.length,
  });

  return limited;
}

/**
 * ユーザーIDからユーザー情報を検索するためのマップを作成
 * @param users ユーザー配列
 * @returns ユーザーマップ
 */
function createUserMap(users: User[]): Map<string, User> {
  const map = new Map<string, User>();
  users.forEach((user) => {
    map.set(user.id, user);
  });
  return map;
}

/**
 * ツイートを処理済み形式に変換
 * @param tweet ツイート
 * @param userMap ユーザーマップ
 * @returns 処理済みツイート（変換失敗時はnull）
 */
function convertToProcessedTweet(
  tweet: Tweet,
  userMap: Map<string, User>
): ProcessedTweet | null {
  const user = userMap.get(tweet.author_id);

  if (!user) {
    logger.warn('ツイートの作成者情報が見つかりません', {
      tweetId: tweet.id,
      authorId: tweet.author_id,
    });
    return null;
  }

  return {
    id: tweet.id,
    text: tweet.text,
    author: {
      name: user.name,
      username: user.username,
    },
    created_at: tweet.created_at,
    likes: tweet.public_metrics.like_count,
    retweets: tweet.public_metrics.retweet_count,
    url: `https://x.com/${user.username}/status/${tweet.id}`,
  };
}

/**
 * いいね数でフィルタリング
 * @param tweets ツイート配列
 * @param minLikes 最小いいね数
 * @returns フィルタ後のツイート配列
 */
function filterByLikes(tweets: ProcessedTweet[], minLikes: number): ProcessedTweet[] {
  const filtered = tweets.filter((tweet) => tweet.likes >= minLikes);

  logger.info('いいね数フィルタを適用しました', {
    before: tweets.length,
    after: filtered.length,
    minLikes,
  });

  return filtered;
}

/**
 * 重複ツイートを除外
 * @param tweets ツイート配列
 * @returns 重複排除後のツイート配列
 */
function removeDuplicates(tweets: ProcessedTweet[]): ProcessedTweet[] {
  const seen = new Set<string>();
  const deduplicated: ProcessedTweet[] = [];

  for (const tweet of tweets) {
    // 先頭N文字で重複判定（定型ツイートやBot投稿を排除）
    const key = tweet.text.slice(0, DUPLICATE_CHECK_LENGTH).trim();

    if (!seen.has(key)) {
      seen.add(key);
      deduplicated.push(tweet);
    }
  }

  if (tweets.length !== deduplicated.length) {
    logger.info('重複ツイートを除外しました', {
      before: tweets.length,
      after: deduplicated.length,
      removed: tweets.length - deduplicated.length,
    });
  }

  return deduplicated;
}

/**
 * いいね数降順にソート
 * @param tweets ツイート配列
 * @returns ソート後のツイート配列
 */
function sortByLikes(tweets: ProcessedTweet[]): ProcessedTweet[] {
  return [...tweets].sort((a, b) => b.likes - a.likes);
}
