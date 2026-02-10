/**
 * キーワード設定の型定義
 */

// キーワード設定ファイルの型
export interface KeywordConfig {
  version: number;
  global_settings: GlobalSettings;
  keywords: KeywordEntry[];
}

// グローバル設定
export interface GlobalSettings {
  min_likes: number;
  max_results: number;
  lang: string;
}

// キーワードエントリ
export interface KeywordEntry {
  term: string;
  min_likes?: number; // オプション：グローバル設定を上書き可能
}

// 環境変数の型
export interface Env {
  X_BEARER_TOKEN: string;
  SLACK_WEBHOOK_URL: string;
  MANUAL_TRIGGER_KEY?: string;
}
