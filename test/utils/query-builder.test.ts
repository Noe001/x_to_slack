/**
 * query-builder.ts のユニットテスト
 */

import { describe, it, expect } from 'vitest';
import { buildSearchQueries, getStartTime } from '../../src/utils/query-builder';
import type { KeywordEntry, GlobalSettings } from '../../src/types/config';

describe('query-builder', () => {
  const globalSettings: GlobalSettings = {
    min_likes: 3,
    max_results: 50,
    lang: 'ja',
  };

  describe('buildSearchQueries', () => {
    it('単一キーワードかつクエリを正しく構築する', () => {
      const keywords: KeywordEntry[] = [{ term: '#Rails' }];

      const queries = buildSearchQueries(keywords, globalSettings);

      expect(queries).toHaveLength(1);
      expect(queries[0]).toBe('(#Rails) -is:retweet lang:ja');
    });

    it('複数キーワードをOR結合してクエリを構築する', () => {
      const keywords: KeywordEntry[] = [
        { term: '#Rails' },
        { term: '#Ruby' },
        { term: 'Next.js' },
      ];

      const queries = buildSearchQueries(keywords, globalSettings);

      expect(queries).toHaveLength(1);
      expect(queries[0]).toBe('(#Rails OR #Ruby OR Next.js) -is:retweet lang:ja');
    });

    it('スペースを含むキーワードを引用符で囲む', () => {
      const keywords: KeywordEntry[] = [{ term: 'Hono Framework' }];

      const queries = buildSearchQueries(keywords, globalSettings);

      expect(queries).toHaveLength(1);
      expect(queries[0]).toBe('("Hono Framework") -is:retweet lang:ja');
    });

    it('キーワードが空の場合はエラーをスローする', () => {
      const keywords: KeywordEntry[] = [];

      expect(() => buildSearchQueries(keywords, globalSettings)).toThrow(
        'キーワードが指定されていません'
      );
    });

    it('クエリが1024文字を超える場合はエラーをスローする', () => {
      // 非常に長いキーワードを生成
      const keywords: KeywordEntry[] = Array.from({ length: 100 }, (_, i) => ({
        term: `VeryLongKeyword${i}`,
      }));

      expect(() => buildSearchQueries(keywords, globalSettings)).toThrow(
        '検索クエリが1024文字を超えています'
      );
    });
  });

  describe('getStartTime', () => {
    it('デフォルトで24時間前の ISO 8601 形式の日時を返す', () => {
      const startTime = getStartTime();
      const parsed = new Date(startTime);

      expect(parsed).toBeInstanceOf(Date);
      expect(parsed.getTime()).toBeLessThan(Date.now());
      expect(startTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('指定した時間数だけ過去の日時を返す', () => {
      const hours = 48;
      const startTime = getStartTime(hours);
      const parsed = new Date(startTime);

      const now = Date.now();
      const expected = now - hours * 60 * 60 * 1000;

      // 誤差を許容（テスト実行時間を考慮）
      expect(Math.abs(parsed.getTime() - expected)).toBeLessThan(1000);
    });
  });
});
