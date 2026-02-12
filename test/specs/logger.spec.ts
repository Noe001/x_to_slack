/**
 * ============================================================
 * ログシステム仕様 (Logging System Specification)
 * ============================================================
 *
 * このテストファイルは構造化ログシステムの仕様を定義する。
 *
 * ## システム要件
 * - 構造化JSON形式でログを出力する
 * - 3つのログレベルをサポート: INFO, WARN, ERROR
 * - 各ログエントリにタイムスタンプを含む
 * - オプションで追加データを付与できる
 * - シングルトンインスタンスとしてエクスポートされる
 *
 * ## ログエントリ構造
 * ```json
 * {
 *   "level": "INFO|WARN|ERROR",
 *   "timestamp": "ISO 8601",
 *   "message": "string",
 *   "data": { ... }  // optional
 * }
 * ```
 *
 * ## 出力先
 * - INFO → console.log
 * - WARN → console.warn
 * - ERROR → console.error
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from '../../src/utils/logger';

describe('ログシステム仕様', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================
  // シングルトン仕様
  // ============================================================
  describe('シングルトンインスタンス', () => {
    it('logger はモジュールからエクスポートされたシングルトンであること', () => {
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
    });
  });

  // ============================================================
  // ログレベル別の出力先仕様
  // ============================================================
  describe('ログレベルと出力先', () => {
    it('info() は console.log を呼び出すこと', () => {
      logger.info('テスト情報メッセージ');
      expect(logSpy).toHaveBeenCalledTimes(1);
    });

    it('warn() は console.warn を呼び出すこと', () => {
      logger.warn('テスト警告メッセージ');
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it('error() は console.error を呼び出すこと', () => {
      logger.error('テストエラーメッセージ');
      expect(errorSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================
  // 構造化JSON出力仕様
  // ============================================================
  describe('構造化JSON出力', () => {
    it('出力は有効なJSON文字列であること', () => {
      logger.info('テスト');

      const output = logSpy.mock.calls[0][0] as string;
      expect(() => JSON.parse(output)).not.toThrow();
    });

    it('ログエントリに level フィールドが含まれること', () => {
      logger.info('テスト');
      const entry = JSON.parse(logSpy.mock.calls[0][0] as string);
      expect(entry.level).toBe('INFO');

      logger.warn('テスト');
      const warnEntry = JSON.parse(warnSpy.mock.calls[0][0] as string);
      expect(warnEntry.level).toBe('WARN');

      logger.error('テスト');
      const errorEntry = JSON.parse(errorSpy.mock.calls[0][0] as string);
      expect(errorEntry.level).toBe('ERROR');
    });

    it('ログエントリに timestamp フィールドが含まれること', () => {
      logger.info('テスト');

      const entry = JSON.parse(logSpy.mock.calls[0][0] as string);
      expect(entry.timestamp).toBeDefined();
      // ISO 8601 形式
      expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('ログエントリに message フィールドが含まれること', () => {
      logger.info('テストメッセージ');

      const entry = JSON.parse(logSpy.mock.calls[0][0] as string);
      expect(entry.message).toBe('テストメッセージ');
    });
  });

  // ============================================================
  // 追加データ仕様
  // ============================================================
  describe('追加データの付与', () => {
    it('data パラメータが指定された場合、ログに含まれること', () => {
      logger.info('テスト', { key: 'value', count: 42 });

      const entry = JSON.parse(logSpy.mock.calls[0][0] as string);
      expect(entry.data).toBeDefined();
      expect(entry.data.key).toBe('value');
      expect(entry.data.count).toBe(42);
    });

    it('data パラメータが未指定の場合、data フィールドが存在しないこと', () => {
      logger.info('テスト');

      const entry = JSON.parse(logSpy.mock.calls[0][0] as string);
      expect(entry.data).toBeUndefined();
    });

    it('ネストしたオブジェクトも data に含めることができること', () => {
      logger.info('テスト', {
        nested: { deep: { value: true } },
        array: [1, 2, 3],
      });

      const entry = JSON.parse(logSpy.mock.calls[0][0] as string);
      expect(entry.data.nested.deep.value).toBe(true);
      expect(entry.data.array).toEqual([1, 2, 3]);
    });

    it('warn と error でも data を付与できること', () => {
      logger.warn('警告', { reason: 'test' });
      logger.error('エラー', { stack: 'trace' });

      const warnEntry = JSON.parse(warnSpy.mock.calls[0][0] as string);
      expect(warnEntry.data.reason).toBe('test');

      const errorEntry = JSON.parse(errorSpy.mock.calls[0][0] as string);
      expect(errorEntry.data.stack).toBe('trace');
    });
  });

  // ============================================================
  // タイムスタンプ仕様
  // ============================================================
  describe('タイムスタンプ', () => {
    it('タイムスタンプは ISO 8601 形式であること', () => {
      logger.info('タイムスタンプテスト');

      const entry = JSON.parse(logSpy.mock.calls[0][0] as string);
      const parsed = new Date(entry.timestamp);

      expect(parsed).toBeInstanceOf(Date);
      expect(parsed.getTime()).not.toBeNaN();
    });

    it('タイムスタンプは UTC であること（Z または +00:00 で終わる）', () => {
      logger.info('UTCテスト');

      const entry = JSON.parse(logSpy.mock.calls[0][0] as string);
      // ISO 8601 UTC format
      expect(entry.timestamp).toMatch(/Z$/);
    });
  });
});
