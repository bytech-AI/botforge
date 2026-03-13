# BotForge フロントエンド仕様書

## 概要

- React 18 SPA（Single Page Application）
- ルーティング: React Router
- 状態管理: React Context（AppContext）
- スタイル: 単一CSS（`src/index.css`, 1129行）
- UI言語: 全て日本語
- デザイン: Discord風ダークテーマ、グラスモーフィズム

---

## ページ一覧（12ページ）

### 1. Dashboard（ダッシュボード）
**パス:** `/`
**API:** `/api/bot/status` (10秒ポーリング), `/api/guilds`, `/api/points/leaderboard`

**表示内容:**
- Bot 接続状態（オンライン/オフライン）
- サーバー選択ドロップダウン
- クイック統計（メンバー数、コマンド数、ポイント総額等）
- メンバーリスト（上位30名）
- クイックアクション

### 2. BotSetup（Bot 接続設定）
**パス:** `/setup`
**API:** `POST /api/bot/connect`, `POST /api/bot/disconnect`

**表示内容:**
- 3ステップウィザード
  1. Discord Developer Portal でBot作成の案内
  2. トークン入力フォーム
  3. 接続テスト
- 切断ボタン

### 3. CommandBuilder（コマンドビルダー）
**パス:** `/commands`
**API:** `/api/commands` (CRUD), `/api/commands/sync`, `/api/commands/registered`

**表示内容:**
- コマンド一覧（カード形式）
- 作成/編集フォーム（モーダル）
  - 基本設定（名前、説明、応答タイプ）
  - 応答内容（テキスト/Embed/ランダム）
  - オプション設定（型、選択肢）
  - 詳細設定（権限、ロール、クールダウン、ポイントコスト）
- Discord API 同期ボタン
- 登録済みコマンドの確認・削除

### 4. PointSystem（ポイント設定）
**パス:** `/points`
**API:** `/api/points/rules`, `/api/points/economy`, `/api/points/channel-multipliers`, `/api/points/decay-settings`

**タブ構成:**
1. **基本ルール** — アクション別ポイント量・クールダウン
2. **経済設定** — 送金手数料、デイリーボーナス
3. **アクション一覧** — 有効/無効トグル
4. **チャンネル倍率** — チャンネル別ポイント倍率
5. **ボーナス設定** — ストリーク倍率等
6. **減衰・有効期限** — ポイント減衰設定

### 5. RankSystem（ランクシステム）
**パス:** `/ranks`
**API:** `/api/ranks/*`

**タブ構成:**
1. **ランク設定** — 13段階ランクテーブル（RP閾値、CP倍率、カラー、アイコン）+ Xランク専用設定（サブティア）
2. **RPルール** — アクション別RP量・日次上限
3. **減衰設定** — 減衰率・猶予日数・下限 + シミュレーション + 免除メンバー
4. **シーズンボーナス** — 周期・ランク別CP配分 + 手動実行ボタン
5. **RPリーダーボード** — 累積RP降順、Xランクはサブティア表示
6. **分布 & 履歴** — ランク分布グラフ + シーズン履歴

### 6. PointLeaderboard（ポイントランキング）
**パス:** `/leaderboard`
**API:** `/api/points/leaderboard`

**表示内容:**
- TOP3 表彰台
- 全メンバーテーブル（順位、アバター、名前、ポイント、RP、メッセージ数等）
- 検索フィルター
- CSV エクスポート

### 7. Rewards（報酬ショップ）
**パス:** `/rewards`
**API:** `/api/rewards` (CRUD)

**表示内容:**
- 報酬カード一覧
- 作成/編集フォーム
- タイプ別表示（ロール、カスタム、抽選、外部連携）
- 在庫管理（残数表示）

### 8. AutoResponse（自動応答）
**パス:** `/auto-response`
**API:** `/api/auto-responses` (CRUD)

**表示内容:**
- ルール一覧（トリガー → 応答）
- 作成/編集フォーム
- マッチタイプ選択（contains/exact/startsWith/regex）
- チャンネルスコープ設定
- 有効/無効トグル

### 9. Moderation（モデレーション）
**パス:** `/moderation`
**API:** `/api/moderation/settings`

**表示内容:**
- NGワードフィルター（ワードリスト + アクション）
- スパム検出設定（閾値 + 時間窓 + アクション）
- リンクフィルター（ホワイトリスト）
- 大文字フィルター（閾値）
- 警告システム（上限 + エスカレーションアクション）
- ログチャンネル設定

### 10. WelcomeMessages（入退室メッセージ）
**パス:** `/welcome`
**API:** `/api/welcome-settings`

**表示内容:**
- 入室メッセージ設定（テキスト + Embed + DM）
- 退室メッセージ設定
- プレビュー表示
- 変数ヘルプ

### 11. ScheduledMessages（定時メッセージ）
**パス:** `/scheduled`
**API:** `/api/scheduled-messages` (CRUD)

**表示内容:**
- メッセージ一覧（名前、時刻、曜日、チャンネル）
- 作成/編集フォーム
- 曜日チェックボックス（月〜日）
- 時刻ピッカー
- チャンネル選択
- 有効/無効トグル

### 12. EmbedBuilder（Embedエディター）
**パス:** `/embeds`
**API:** `/api/embed-templates` (CRUD)

**表示内容:**
- テンプレート一覧
- ビジュアルエディター
  - Author（名前、アイコンURL、リンク）
  - Title + URL
  - Description
  - Color ピッカー
  - Thumbnail URL
  - Image URL
  - Footer（テキスト、アイコンURL）
  - Fields（名前、値、inline）
- リアルタイムプレビュー
- テンプレート保存/読み込み

---

## CSS デザインシステム

### カラーパレット

| 変数 | 値 | 用途 |
|------|-----|------|
| --bg-primary | #0a0a0f | メイン背景 |
| --bg-secondary | #12121a | サイドバー |
| --bg-card | #16161f | カード背景 |
| --accent-primary | #7c5cfc | メインアクセント |
| --accent-success | #00d4aa | 成功 |
| --accent-danger | #ff4757 | 危険 |
| --accent-warning | #ffb347 | 警告 |
| --text-primary | #e8e8ed | メインテキスト |
| --text-secondary | #9898a8 | 補助テキスト |

### コンポーネント

- `.card` — グラスモーフィズムカード
- `.btn` — ボタン（primary/secondary/danger）
- `.form-input` / `.form-select` — フォーム要素
- `.table-wrapper` — テーブルコンテナ
- `.tabs` — タブ切り替え
- `.toggle` — トグルスイッチ
- `.badge` — バッジ
- `.toast` — トースト通知
- `.grid-2` — 2カラムグリッド
