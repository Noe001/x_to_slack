# X投稿収集・Slack通知システム - セットアップガイド

このドキュメントでは、システムのセットアップ手順と運用方法について説明します。

## 前提条件

- Node.js 18.x 以上
- npm または yarn
- Cloudflare アカウント（Paid プラン推奨）
- X Developer アカウント（Pay-Per-Use プランで利用可能）
- Slack ワークスペースとチャンネル

## セットアップ手順

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.dev.vars.example` をコピーして `.dev.vars` を作成します。

```bash
cp .dev.vars.example .dev.vars
```

`.dev.vars` ファイルを編集し、以下の環境変数を設定します。

```bash
# X API Bearer Token
X_BEARER_TOKEN=your_x_bearer_token_here

# Slack Incoming Webhook URL
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# 手動実行用のトリガーキー（任意の文字列）
MANUAL_TRIGGER_KEY=your_secret_key_here
```

#### X API Bearer Token の取得方法

1. [X Developer Portal](https://developer.x.com/) にアクセス
2. プロジェクトとアプリを作成
3. App Settings の「Keys and tokens」から Bearer Token を生成
4. Pay-Per-Use プランを有効化し、最低 $5 のクレジットをチャージ

#### Slack Incoming Webhook URL の取得方法

1. [Slack API](https://api.slack.com/messaging/webhooks) にアクセス
2. 「Create your Slack app」をクリック
3. 「Incoming Webhooks」を有効化
4. 通知先のチャンネルを選択して Webhook URL を取得

### 3. キーワードの設定

`src/keywords.json` を編集して、検索するキーワードを設定します。

```json
{
  "version": 1,
  "global_settings": {
    "min_likes": 3,
    "max_results": 50,
    "lang": "ja"
  },
  "keywords": [
    { "term": "#Rails", "min_likes": 5 },
    { "term": "#Ruby" },
    { "term": "Next.js" }
  ]
}
```

- `global_settings.min_likes`: 最小いいね数（デフォルト）
- `global_settings.max_results`: X API から取得する最大件数（10〜100）
- `global_settings.lang`: 言語フィルタ（ja: 日本語）
- `keywords[].term`: 検索キーワード
- `keywords[].min_likes`: キーワードごとの最小いいね数（オプション）

### 4. ローカル開発環境での実行

```bash
npm run dev
```

ローカルサーバーが起動します。手動実行エンドポイントにアクセスして動作を確認できます。

```bash
curl "http://localhost:8787/trigger?key=your_secret_key_here"
```

### 5. テストの実行

```bash
# すべてのテストを実行
npm run test

# ウォッチモード
npm run test:watch

# カバレッジ付き
npm run test:coverage

# 型チェック
npm run type-check
```

## Cloudflare Workers へのデプロイ

### 1. Wrangler のログイン

```bash
npx wrangler login
```

### 2. シークレットの設定

本番環境の環境変数を設定します。

```bash
npx wrangler secret put X_BEARER_TOKEN
# プロンプトが表示されたら Bearer Token を入力

npx wrangler secret put SLACK_WEBHOOK_URL
# プロンプトが表示されたら Webhook URL を入力

npx wrangler secret put MANUAL_TRIGGER_KEY
# プロンプトが表示されたら任意のキーを入力
```

### 3. デプロイ

```bash
npm run deploy
```

デプロイが成功すると、Workers の URL が表示されます。

### 4. Cron の確認

Cloudflare Dashboard から Cron Triggers を確認できます。

- 実行スケジュール: 毎日 17:00 JST (08:00 UTC)
- Cron 式: `0 8 * * *`

## 運用

### 手動実行

デプロイ後、以下の URL にアクセスして手動実行できます。

```bash
curl "https://your-worker.workers.dev/trigger?key=your_secret_key_here"
```

### ログの確認

Cloudflare Dashboard の「Logs」セクションから実行ログを確認できます。

```bash
# ローカルでのログ確認
npx wrangler tail
```

### キーワードの変更

1. `src/keywords.json` を編集
2. 再デプロイ

```bash
npm run deploy
```

### エラー通知

エラーが発生した場合、Slack に自動でエラー通知が送信されます。

## トラブルシューティング

### X API エラー

#### 401/403 認証エラー

- Bearer Token が正しく設定されているか確認
- X Developer Portal でトークンを再生成

#### 402 クレジット枯渇

- X Developer Console でクレジットをチャージ

#### 429 レート制限

- リクエスト頻度を下げる
- Cron の実行間隔を調整

### Slack 通知エラー

- Webhook URL が正しく設定されているか確認
- Slack App が削除されていないか確認
- 必要に応じて Webhook を再生成

### デプロイエラー

```bash
# Wrangler のバージョンを確認
npx wrangler --version

# 再ログイン
npx wrangler logout
npx wrangler login
```

## ディレクトリ構造

```
.
├── src/
│   ├── index.ts              # エントリーポイント
│   ├── keywords.json          # 検索キーワード設定
│   ├── config.ts              # 設定管理
│   ├── services/
│   │   ├── x-client.ts        # X API クライアント
│   │   ├── slack-notifier.ts  # Slack 通知
│   │   └── tweet-processor.ts # ツイート処理
│   ├── types/
│   │   ├── x-api.ts           # X API 型定義
│   │   ├── slack.ts           # Slack 型定義
│   │   └── config.ts          # 設定型定義
│   └── utils/
│       ├── query-builder.ts   # クエリ構築
│       └── logger.ts          # ログユーティリティ
├── test/                      # テストファイル
├── wrangler.toml              # Cloudflare Workers 設定
├── package.json
├── tsconfig.json
└── README.md                  # システム仕様書
```

## コスト試算

### X API (Pay-Per-Use)

- 投稿取得: $0.005/件
- ユーザー情報取得: $0.010/件
- 月間想定: 約 $23.25（50件/日 × 31日）

### Cloudflare Workers

- Paid プラン: $5/月

### 合計

- 約 $28.25/月

## セキュリティ

- すべての環境変数は Cloudflare Secrets で管理
- `.dev.vars` は `.gitignore` に含まれており、Git にコミットされない
- Webhook URL が漏洩した場合は速やかに再生成する

## サポート

問題が発生した場合は、以下を確認してください。

1. ログの確認（Cloudflare Dashboard または `npx wrangler tail`）
2. 環境変数の設定確認
3. X API のクレジット残高確認
4. Slack App の状態確認
