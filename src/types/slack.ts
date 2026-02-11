/**
 * Slack Block Kit の型定義
 */

// Slack Incoming Webhook のペイロード
export interface SlackWebhookPayload {
  text?: string; // フォールバック用テキスト
  blocks: Block[];
}

// ブロックタイプ
export type Block = HeaderBlock | SectionBlock | DividerBlock | ContextBlock;

// ヘッダーブロック
export interface HeaderBlock {
  type: 'header';
  text: {
    type: 'plain_text';
    text: string;
    emoji?: boolean;
  };
}

// セクションブロック
export interface SectionBlock {
  type: 'section';
  text?: {
    type: 'mrkdwn' | 'plain_text';
    text: string;
  };
  fields?: {
    type: 'mrkdwn' | 'plain_text';
    text: string;
  }[];
  accessory?: any; // 必要に応じて拡張
}

// 区切り線ブロック
export interface DividerBlock {
  type: 'divider';
}

// コンテキストブロック
export interface ContextBlock {
  type: 'context';
  elements: {
    type: 'mrkdwn' | 'plain_text' | 'image';
    text?: string;
    image_url?: string;
    alt_text?: string;
  }[];
}

// Slack 通知用のサマリーデータ
export interface NotificationSummary {
  date: string;
  keywords: string[];
  tweets: {
    id: string;
    text: string;
    author: string;
    username: string;
    likes: number;
    retweets: number;
    url: string;
  }[];
  stats: {
    fetched: number;
    filtered: number;
    displayed: number;
  };
}
