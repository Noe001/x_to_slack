/**
 * ============================================================
 * 検索クエリ構築仕様 (Search Query Construction Specification)
 * ============================================================
 *
 * このテストファイルは X API v2 の検索クエリ構築機能の仕様を定義する。
 *
 * ## システム要件
 * - キーワード配列からX API v2検索クエリを生成する
 * - クエリはOR演算子でキーワードを結合する
 * - リツイートを除外するフィルタを含む
 * - 言語フィルタを含む
 * - スペースを含むキーワードは引用符で囲む
 * - クエリ長は1024文字以内に制限される
 *
 * ## クエリフォーマット
 * ```
 * (keyword1 OR keyword2 OR "keyword with space") -is:retweet lang:{lang}
 * ```
 *
 * ## 時間範囲
 * - ISO 8601形式で過去N時間の開始時刻を返す
 * - デフォルトは24時間
 */

import { describe, it, expect } from 'vitest';
import { buildSearchQueries, getStartTime } from '../../src/utils/query-builder';
import { createGlobalSettings, createKeywordEntry } from './fixtures';

describe('検索クエリ構築仕様', () => {
  const globalSettings = createGlobalSettings();

  // ============================================================
  // クエリ基本フォーマット仕様
  // ============================================================
  describe('クエリ基本フォーマット', () => {
    it('クエリは配列として返却されること（将来の分割対応のため）', () => {
      const keywords = [createKeywordEntry('#Rails')];
      const queries = buildSearchQueries(keywords, globalSettings);

      expect(Array.isArray(queries)).toBe(true);
      expect(queries.length).toBeGreaterThanOrEqual(1);
    });

    it('現行フェーズ(Phase 1)では常に単一クエリを返す', () => {
      const keywords = [
        createKeywordEntry('#Rails'),
        createKeywordEntry('#Ruby'),
        createKeywordEntry('Next.js'),
      ];
      const queries = buildSearchQueries(keywords, globalSettings);

      expect(queries).toHaveLength(1);
    });

    it('クエリに -is:retweet フィルタが含まれること（リツイート除外）', () => {
      const keywords = [createKeywordEntry('#Rails')];
      const queries = buildSearchQueries(keywords, globalSettings);

      expect(queries[0]).toContain('-is:retweet');
    });

    it('クエリに言語フィルタが含まれること', () => {
      const keywords = [createKeywordEntry('#Rails')];
      const queries = buildSearchQueries(keywords, globalSettings);

      expect(queries[0]).toContain('lang:ja');
    });

    it('言語設定に応じたフィルタが適用されること', () => {
      const enSettings = createGlobalSettings({ lang: 'en' });
      const keywords = [createKeywordEntry('React')];
      const queries = buildSearchQueries(keywords, enSettings);

      expect(queries[0]).toContain('lang:en');
      expect(queries[0]).not.toContain('lang:ja');
    });
  });

  // ============================================================
  // キーワード結合仕様
  // ============================================================
  describe('キーワード結合ルール', () => {
    it('単一キーワードの場合、括弧で囲まれた単独の値となること', () => {
      const keywords = [createKeywordEntry('#Rails')];
      const queries = buildSearchQueries(keywords, globalSettings);

      expect(queries[0]).toBe('(#Rails) -is:retweet lang:ja');
    });

    it('複数キーワードは OR 演算子で結合されること', () => {
      const keywords = [
        createKeywordEntry('#Rails'),
        createKeywordEntry('#Ruby'),
        createKeywordEntry('Next.js'),
      ];
      const queries = buildSearchQueries(keywords, globalSettings);

      expect(queries[0]).toBe('(#Rails OR #Ruby OR Next.js) -is:retweet lang:ja');
    });

    it('キーワード全体は括弧でグルーピングされること', () => {
      const keywords = [
        createKeywordEntry('#Rails'),
        createKeywordEntry('#Ruby'),
      ];
      const queries = buildSearchQueries(keywords, globalSettings);

      expect(queries[0]).toMatch(/^\(.+\)\s+-is:retweet/);
    });
  });

  // ============================================================
  // スペース含有キーワード仕様
  // ============================================================
  describe('スペースを含むキーワードの処理', () => {
    it('スペースを含むキーワードは引用符で囲まれること', () => {
      const keywords = [createKeywordEntry('Hono Framework')];
      const queries = buildSearchQueries(keywords, globalSettings);

      expect(queries[0]).toContain('"Hono Framework"');
    });

    it('スペースを含まないキーワードは引用符で囲まれないこと', () => {
      const keywords = [createKeywordEntry('#Rails')];
      const queries = buildSearchQueries(keywords, globalSettings);

      expect(queries[0]).not.toContain('"#Rails"');
      expect(queries[0]).toContain('#Rails');
    });

    it('スペースありとなしが混在するケース', () => {
      const keywords = [
        createKeywordEntry('#Rails'),
        createKeywordEntry('Hono Framework'),
      ];
      const queries = buildSearchQueries(keywords, globalSettings);

      expect(queries[0]).toBe('(#Rails OR "Hono Framework") -is:retweet lang:ja');
    });
  });

  // ============================================================
  // エラーハンドリング仕様
  // ============================================================
  describe('エラーハンドリング', () => {
    it('キーワードが空配列の場合はエラーをスローすること', () => {
      expect(() => buildSearchQueries([], globalSettings)).toThrow(
        'キーワードが指定されていません'
      );
    });

    it('クエリが1024文字を超える場合はエラーをスローすること', () => {
      // 100個の長いキーワードで1024文字超えを再現
      const keywords = Array.from({ length: 100 }, (_, i) =>
        createKeywordEntry(`VeryLongKeyword${i}`)
      );

      expect(() => buildSearchQueries(keywords, globalSettings)).toThrow(
        '検索クエリが1024文字を超えています'
      );
    });

    it('1024文字エラーメッセージには実際のクエリ長が含まれること', () => {
      const keywords = Array.from({ length: 100 }, (_, i) =>
        createKeywordEntry(`VeryLongKeyword${i}`)
      );

      expect(() => buildSearchQueries(keywords, globalSettings)).toThrow(/\d+文字/);
    });
  });

  // ============================================================
  // 時間範囲仕様
  // ============================================================
  describe('検索時間範囲 (getStartTime)', () => {
    it('ISO 8601 形式の日時文字列を返すこと', () => {
      const startTime = getStartTime();

      expect(startTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('デフォルトでは24時間前の日時を返すこと', () => {
      const startTime = getStartTime();
      const parsed = new Date(startTime);
      const expectedMs = Date.now() - 24 * 60 * 60 * 1000;

      // 実行時間の誤差を1秒以内で許容
      expect(Math.abs(parsed.getTime() - expectedMs)).toBeLessThan(1000);
    });

    it('指定した時間数に応じた過去の日時を返すこと', () => {
      const hours = 48;
      const startTime = getStartTime(hours);
      const parsed = new Date(startTime);
      const expectedMs = Date.now() - hours * 60 * 60 * 1000;

      expect(Math.abs(parsed.getTime() - expectedMs)).toBeLessThan(1000);
    });

    it('返却値は現在時刻より過去であること', () => {
      const startTime = getStartTime(1);
      const parsed = new Date(startTime);

      expect(parsed.getTime()).toBeLessThan(Date.now());
    });

    it('1時間前のような短い時間範囲でも正しく動作すること', () => {
      const startTime = getStartTime(1);
      const parsed = new Date(startTime);
      const expectedMs = Date.now() - 1 * 60 * 60 * 1000;

      expect(Math.abs(parsed.getTime() - expectedMs)).toBeLessThan(1000);
    });
  });
});
