/**
 * 設定ファイル読み込みとバリデーション
 */

import type { KeywordConfig, KeywordEntry, GlobalSettings } from './types/config';
import keywordsData from './keywords.json';
import { logger } from './utils/logger';

/**
 * 設定ファイルをロードし、バリデーションを実行する
 * @returns バリデーション済みの設定データ
 */
export function loadConfig(): KeywordConfig {
  const config = keywordsData as KeywordConfig;

  validateConfig(config);

  logger.info('設定ファイルを読み込みました', {
    version: config.version,
    keywordCount: config.keywords.length,
    globalSettings: config.global_settings,
  });

  return config;
}

/**
 * 設定ファイルのバリデーション
 * @param config 設定データ
 * @throws バリデーションエラー
 */
function validateConfig(config: KeywordConfig): void {
  // version フィールドのチェック
  if (typeof config.version !== 'number' || config.version < 1) {
    throw new Error('設定ファイルのversionが不正です');
  }

  // global_settings のチェック
  validateGlobalSettings(config.global_settings);

  // keywords 配列のチェック
  if (!Array.isArray(config.keywords) || config.keywords.length === 0) {
    throw new Error('キーワード配列が空、または配列ではありません');
  }

  // 各キーワードのバリデーション
  config.keywords.forEach((keyword, index) => {
    validateKeywordEntry(keyword, index);
  });

  logger.info('設定ファイルのバリデーションが完了しました');
}

/**
 * グローバル設定のバリデーション
 * @param settings グローバル設定
 * @throws バリデーションエラー
 */
function validateGlobalSettings(settings: GlobalSettings): void {
  if (typeof settings.min_likes !== 'number' || settings.min_likes < 0) {
    throw new Error('global_settings.min_likes は0以上の整数である必要があります');
  }

  if (
    typeof settings.max_results !== 'number' ||
    settings.max_results < 10 ||
    settings.max_results > 100
  ) {
    throw new Error('global_settings.max_results は10〜100の範囲である必要があります');
  }

  if (typeof settings.lang !== 'string' || settings.lang.length === 0) {
    throw new Error('global_settings.lang は空でない文字列である必要があります');
  }
}

/**
 * キーワードエントリのバリデーション
 * @param keyword キーワードエントリ
 * @param index インデックス（エラーメッセージ用）
 * @throws バリデーションエラー
 */
function validateKeywordEntry(keyword: KeywordEntry, index: number): void {
  if (typeof keyword.term !== 'string' || keyword.term.trim().length === 0) {
    throw new Error(`keywords[${index}].term は空でない文字列である必要があります`);
  }

  if (
    keyword.min_likes !== undefined &&
    (typeof keyword.min_likes !== 'number' || keyword.min_likes < 0)
  ) {
    throw new Error(`keywords[${index}].min_likes は0以上の整数である必要があります`);
  }
}

/**
 * キーワードごとの最小いいね数を取得する
 * @param keyword キーワードエントリ
 * @param globalSettings グローバル設定
 * @returns 有効な最小いいね数
 */
export function getMinLikes(keyword: KeywordEntry, globalSettings: GlobalSettings): number {
  return keyword.min_likes !== undefined ? keyword.min_likes : globalSettings.min_likes;
}
