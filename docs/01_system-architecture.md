# BotForge システムアーキテクチャ仕様書

## 概要

BotForge は日本語 Discord Bot ビルダー。Web ダッシュボードからノーコードで Bot を設定・運用できる。

## 技術スタック

| レイヤー | 技術 | バージョン |
|----------|------|-----------|
| フロントエンド | React 18 + Vite | SPA, React Router |
| バックエンド | Express.js | REST API (`/api/*`) |
| データベース | SQLite (better-sqlite3) | WAL モード |
| Bot | Discord.js v14 | Gateway + REST |
| スケジューラ | node-cron | 毎日 04:00 JST |
| デプロイ | Railway (Docker) | Hobby プラン |

## ディレクトリ構成

```
botforge/
├── src/                    # React フロントエンド
│   ├── App.jsx             # ルートコンポーネント + AppContext
│   ├── index.css           # 全スタイル（単一CSS）
│   └── pages/              # 12 ページコンポーネント
│       ├── Dashboard.jsx
│       ├── BotSetup.jsx
│       ├── CommandBuilder.jsx
│       ├── PointSystem.jsx
│       ├── RankSystem.jsx
│       ├── PointLeaderboard.jsx
│       ├── Rewards.jsx
│       ├── AutoResponse.jsx
│       ├── Moderation.jsx
│       ├── WelcomeMessages.jsx
│       ├── ScheduledMessages.jsx
│       └── EmbedBuilder.jsx
├── server/
│   ├── index.js            # Express サーバー + 全APIルート + Cron
│   ├── bot.js              # bot/ の re-export ファサード
│   ├── db.js               # db/ の re-export ファサード
│   ├── bot/
│   │   ├── client.js       # Discord.js クライアント管理・トークン暗号化
│   │   ├── register.js     # スラッシュコマンド登録
│   │   ├── handlers/
│   │   │   ├── interaction.js  # コマンド実行ルーティング
│   │   │   ├── message.js      # メッセージイベント（ポイント・自動応答）
│   │   │   ├── reaction.js     # リアクションイベント
│   │   │   └── voice.js        # ボイスチャンネルイベント
│   │   ├── commands/
│   │   │   ├── balance.js      # /balance, /history, /actions
│   │   │   ├── ranking.js      # /ranking, /rank, /rp-ranking, /season
│   │   │   ├── economy.js      # /transfer, /pay, /daily
│   │   │   └── games.js        # /gacha, /coinflip
│   │   └── points/
│   │       └── earning.js      # ポイント・RP獲得ロジック
│   ├── db/
│   │   ├── connection.js   # DB初期化・スキーマ・マイグレーション
│   │   ├── commands.js     # コマンドCRUD
│   │   ├── features.js     # 6機能（自動応答・モデレーション等）
│   │   ├── points.js       # ポイント・経済・ガチャ
│   │   └── rp-system.js    # RPランクシステム
│   └── middleware/
│       ├── validate.js     # リクエストバリデーション
│       └── errorHandler.js # エラーハンドリング
├── data/                   # ランタイムデータ（gitignored）
│   ├── botforge.db         # SQLite データベース
│   ├── token.enc           # 暗号化 Bot トークン
│   └── encryption.key      # AES-256 暗号鍵
├── Dockerfile
├── railway.json
├── CLAUDE.md
└── package.json
```

## 通信フロー

```
ブラウザ ──HTTP──▶ Vite Dev Server (:5173) ──proxy /api──▶ Express (:3001) ──▶ SQLite
                                                              │
                                                              ▼
                                                     Discord Gateway (WebSocket)
                                                              │
                                                              ▼
                                                     Discord REST API
```

**本番環境 (Railway):**
```
ブラウザ ──HTTPS──▶ Express (:3001) ──static──▶ dist/ (ビルド済みReact)
                        │
                        ├──▶ SQLite (Volume: /app/data)
                        └──▶ Discord Gateway
```

## グローバル状態管理 (AppContext)

| 状態 | 型 | 説明 |
|------|-----|------|
| `botStatus` | string | `'online'` / `'offline'` |
| `botName` | string | Bot のユーザー名 |
| `botAvatar` | string | Bot のアバターURL |
| `guilds` | Array | 接続中のサーバー一覧 |
| `selectedGuild` | string | 選択中のギルドID |
| `showToast(msg, type)` | Function | トースト通知表示 |
| `refreshGuilds()` | Function | ギルド一覧を再取得 |

## npm スクリプト

| コマンド | 説明 |
|----------|------|
| `npm run dev` | Vite (:5173) + Express (:3001) 同時起動 |
| `npm run build` | Vite でフロントエンドビルド → `dist/` |
| `npm start` | 本番サーバー起動（`dist/` 配信 + API） |

## デプロイ設定

**Railway:**
- リージョン: シンガポール (ap-southeast-1)
- Volume: `/app/data` (SQLite 永続化)
- ヘルスチェック: `GET /api/bot/status`
- 再起動ポリシー: ON_FAILURE
- URL: `botforge-production-b031.up.railway.app`
