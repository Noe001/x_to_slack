/**
 * X API v2 のレスポンス型定義
 */

// ツイート検索レスポンス
export interface TweetSearchResponse {
  data?: Tweet[];
  includes?: {
    users?: User[];
  };
  meta: {
    newest_id?: string;
    oldest_id?: string;
    result_count: number;
    next_token?: string;
  };
  errors?: XApiError[];
}

// ツイート
export interface Tweet {
  id: string;
  text: string;
  author_id: string;
  created_at: string;
  public_metrics: PublicMetrics;
}

// ユーザー情報
export interface User {
  id: string;
  name: string;
  username: string;
}

// パブリックメトリクス
export interface PublicMetrics {
  retweet_count: number;
  reply_count: number;
  like_count: number;
  quote_count: number;
  bookmark_count: number;
  impression_count: number;
}

// エラーレスポンス
export interface XApiError {
  title: string;
  detail: string;
  type: string;
  value?: string;
}

// X API エラークラス
export class XApiClientError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public errors?: XApiError[]
  ) {
    super(message);
    this.name = 'XApiClientError';
  }
}

// 処理済みツイート（ビジネスロジック用）
export interface ProcessedTweet {
  id: string;
  text: string;
  author: {
    name: string;
    username: string;
  };
  created_at: string;
  likes: number;
  retweets: number;
  url: string;
}
