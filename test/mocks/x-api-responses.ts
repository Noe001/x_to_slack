/**
 * X API レスポンスのモックデータ
 */

import type { TweetSearchResponse } from '../../src/types/x-api';

export const mockSuccessResponse: TweetSearchResponse = {
  data: [
    {
      id: '123456789',
      text: 'Rails 8の新しいデプロイツールが革命的すぎる件について...',
      author_id: 'user1',
      created_at: '2026-02-10T08:00:00.000Z',
      public_metrics: {
        like_count: 120,
        retweet_count: 45,
        reply_count: 10,
        quote_count: 5,
        bookmark_count: 30,
        impression_count: 5000,
      },
    },
    {
      id: '987654321',
      text: '初心者がハマりやすいN+1問題の解決策まとめ。',
      author_id: 'user2',
      created_at: '2026-02-10T07:30:00.000Z',
      public_metrics: {
        like_count: 85,
        retweet_count: 20,
        reply_count: 5,
        quote_count: 2,
        bookmark_count: 15,
        impression_count: 3000,
      },
    },
  ],
  includes: {
    users: [
      {
        id: 'user1',
        name: 'Rails Developer',
        username: 'rails_dev',
      },
      {
        id: 'user2',
        name: 'Ruby Enthusiast',
        username: 'ruby_fan',
      },
    ],
  },
  meta: {
    newest_id: '123456789',
    oldest_id: '987654321',
    result_count: 2,
  },
};

export const mockEmptyResponse: TweetSearchResponse = {
  data: [],
  meta: {
    result_count: 0,
  },
};

export const mockErrorResponse = {
  errors: [
    {
      title: 'Unauthorized',
      detail: 'Unauthorized',
      type: 'https://api.twitter.com/2/problems/unauthorized',
    },
  ],
};
