/**
 * X API 検索クエリ構築ユーティリティ
 */

import type { KeywordEntry, GlobalSettings } from '../types/config';
import { logger } from './logger';

const QUERY_MAX_LENGTH = 1024;
const BASE_CONDITIONS = '-is:retweet'; // リツイート除外

/**
 * キーワードリストから検索クエリを構築する
 * @param keywords キーワードエントリのリスト
 * @param globalSettings グローバル設定
 * @returns 検索クエリの配列（1024文字制限により分割される可能性あり）
 */
export function buildSearchQueries(
  keywords: KeywordEntry[],
  globalSettings: GlobalSettings
): string[] {
  if (keywords.length === 0) {
    throw new Error('キーワードが指定されていません');
  }

  const lang = globalSettings.lang;
  const langCondition = `lang:${lang}`;

  // ベースクエリ: "-is:retweet lang:ja"
  const baseQuery = `${BASE_CONDITIONS} ${langCondition}`;

  // キーワードをOR結合
  const keywordTerms = keywords.map((k) => {
    // スペースを含むキーワードは引用符で囲む
    if (k.term.includes(' ')) {
      return `"${k.term}"`;
    }
    return k.term;
  });

  // 単一クエリを生成
  const keywordQuery = `(${keywordTerms.join(' OR ')})`;
  const fullQuery = `${keywordQuery} ${baseQuery}`;

  // クエリ長チェック
  if (fullQuery.length > QUERY_MAX_LENGTH) {
    logger.warn('クエリが1024文字を超えています。分割が必要です。', {
      queryLength: fullQuery.length,
      maxLength: QUERY_MAX_LENGTH,
    });

    // TODO: クエリ分割ロジックの実装（Phase 1では簡易的にエラーを投げる）
    throw new Error(
      `検索クエリが${QUERY_MAX_LENGTH}文字を超えています（${fullQuery.length}文字）。キーワード数を減らしてください。`
    );
  }

  logger.info('検索クエリを構築しました', {
    query: fullQuery,
    queryLength: fullQuery.length,
    keywordCount: keywords.length,
  });

  return [fullQuery];
}

/**
 * 日時範囲を含む検索パラメータを構築する
 * @param lookbackHours 過去何時間分を取得するか（デフォルト: 24時間）
 * @returns ISO 8601形式の開始日時
 */
export function getStartTime(lookbackHours: number = 24): string {
  const now = new Date();
  const startTime = new Date(now.getTime() - lookbackHours * 60 * 60 * 1000);
  return startTime.toISOString();
}
