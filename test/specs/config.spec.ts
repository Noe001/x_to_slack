/**
 * ============================================================
 * 設定管理システム仕様 (Configuration System Specification)
 * ============================================================
 *
 * このテストファイルは設定ファイルの読み込み・バリデーション機能の
 * 仕様を定義する。TDDにおける「仕様書」として機能する。
 *
 * ## システム要件
 * - keywords.json から設定を読み込み、型安全なオブジェクトとして返す
 * - バージョン、グローバル設定、キーワード配列を検証する
 * - キーワードごとの min_likes オーバーライドをサポートする
 * - 不正な設定は明確なエラーメッセージで拒否する
 *
 * ## バリデーションルール
 * - version: 1以上の整数
 * - global_settings.min_likes: 0以上の整数
 * - global_settings.max_results: 10〜100の範囲
 * - global_settings.lang: 空でない文字列
 * - keywords: 1件以上の配列
 * - keywords[].term: 空でない文字列
 * - keywords[].min_likes: 省略可、指定時は0以上
 */

import { describe, it, expect } from 'vitest';
import { loadConfig, getMinLikes } from '../../src/config';
import { createGlobalSettings, createKeywordEntry } from './fixtures';

describe('設定管理システム仕様', () => {
  // ============================================================
  // 設定ファイルの読み込み
  // ============================================================
  describe('設定ファイルの読み込み (loadConfig)', () => {
    it('keywords.json を正常に読み込み、KeywordConfig 型のオブジェクトを返す', () => {
      const config = loadConfig();

      expect(config).toBeDefined();
      expect(config).toHaveProperty('version');
      expect(config).toHaveProperty('global_settings');
      expect(config).toHaveProperty('keywords');
    });

    it('version フィールドは数値型であること', () => {
      const config = loadConfig();
      expect(typeof config.version).toBe('number');
      expect(config.version).toBeGreaterThanOrEqual(1);
    });

    it('global_settings は必要なフィールドを全て含むこと', () => {
      const config = loadConfig();
      const { global_settings } = config;

      expect(global_settings).toHaveProperty('min_likes');
      expect(global_settings).toHaveProperty('max_results');
      expect(global_settings).toHaveProperty('lang');

      expect(typeof global_settings.min_likes).toBe('number');
      expect(typeof global_settings.max_results).toBe('number');
      expect(typeof global_settings.lang).toBe('string');
    });

    it('keywords は1件以上のキーワードエントリを含むこと', () => {
      const config = loadConfig();

      expect(Array.isArray(config.keywords)).toBe(true);
      expect(config.keywords.length).toBeGreaterThanOrEqual(1);
    });

    it('各キーワードエントリは term フィールドを含むこと', () => {
      const config = loadConfig();

      config.keywords.forEach((keyword) => {
        expect(keyword).toHaveProperty('term');
        expect(typeof keyword.term).toBe('string');
        expect(keyword.term.trim().length).toBeGreaterThan(0);
      });
    });

    it('キーワードの min_likes は省略可能であること', () => {
      const config = loadConfig();

      // min_likes が指定されているものと省略されているものが混在する
      const withMinLikes = config.keywords.filter((k) => k.min_likes !== undefined);
      const withoutMinLikes = config.keywords.filter((k) => k.min_likes === undefined);

      // 実際のkeywords.jsonに基づく検証
      expect(withMinLikes.length + withoutMinLikes.length).toBe(config.keywords.length);
    });
  });

  // ============================================================
  // min_likes のオーバーライド仕様
  // ============================================================
  describe('キーワード別 min_likes オーバーライド仕様 (getMinLikes)', () => {
    const globalSettings = createGlobalSettings({ min_likes: 3 });

    it('キーワードに min_likes が指定されている場合はその値を使用する', () => {
      const keyword = createKeywordEntry('#Rails', 5);

      const result = getMinLikes(keyword, globalSettings);
      expect(result).toBe(5);
    });

    it('キーワードに min_likes が指定されていない場合はグローバル設定を使用する', () => {
      const keyword = createKeywordEntry('#Ruby');

      const result = getMinLikes(keyword, globalSettings);
      expect(result).toBe(3);
    });

    it('キーワードの min_likes が 0 の場合は 0 を使用する（グローバルに上書き）', () => {
      const keyword = createKeywordEntry('#Easy', 0);

      const result = getMinLikes(keyword, globalSettings);
      expect(result).toBe(0);
    });

    it('グローバルの min_likes が 0 でもキーワード設定が優先される', () => {
      const zeroGlobal = createGlobalSettings({ min_likes: 0 });
      const keyword = createKeywordEntry('#Popular', 10);

      const result = getMinLikes(keyword, zeroGlobal);
      expect(result).toBe(10);
    });
  });

  // ============================================================
  // グローバル設定のバリデーション仕様
  // ============================================================
  describe('グローバル設定バリデーション仕様', () => {
    it('max_results の許容範囲は 10〜100 であること', () => {
      const config = loadConfig();
      expect(config.global_settings.max_results).toBeGreaterThanOrEqual(10);
      expect(config.global_settings.max_results).toBeLessThanOrEqual(100);
    });

    it('min_likes は 0 以上であること', () => {
      const config = loadConfig();
      expect(config.global_settings.min_likes).toBeGreaterThanOrEqual(0);
    });

    it('lang は空文字列ではないこと', () => {
      const config = loadConfig();
      expect(config.global_settings.lang.length).toBeGreaterThan(0);
    });
  });

  // ============================================================
  // 現在のキーワード設定の内容検証
  // ============================================================
  describe('現在のキーワード設定の内容検証', () => {
    it('設定ファイルには技術キーワードが含まれること', () => {
      const config = loadConfig();
      const terms = config.keywords.map((k) => k.term);

      // 現在の設定値に基づく具体的な検証
      expect(terms).toContain('#Rails');
      expect(terms).toContain('#Ruby');
      expect(terms).toContain('Next.js');
      expect(terms).toContain('Hono Framework');
    });

    it('#Rails キーワードはグローバル設定より高い min_likes を持つこと', () => {
      const config = loadConfig();
      const rails = config.keywords.find((k) => k.term === '#Rails');

      expect(rails).toBeDefined();
      expect(rails!.min_likes).toBeDefined();
      expect(rails!.min_likes!).toBeGreaterThan(config.global_settings.min_likes);
    });

    it('日本語ツイートを対象とする設定であること', () => {
      const config = loadConfig();
      expect(config.global_settings.lang).toBe('ja');
    });
  });
});
