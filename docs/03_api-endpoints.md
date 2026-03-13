# BotForge API エンドポイント仕様書

## 概要

- ベースURL: `/api`
- 認証: なし（将来追加予定）
- レスポンス: JSON
- エラー形式: `{ "error": "メッセージ" }`
- ボディサイズ上限: 1MB

## ミドルウェア

| 名前 | 説明 |
|------|------|
| `requireGuildId` | `?guildId=` クエリパラメータ必須 |
| `requireIntParam()` | URL パラメータが整数であること |
| `requireBody(...fields)` | ボディに必須フィールドがあること |
| `maxLength(field, len)` | 文字列長制限 |
| `numberRange(field, min, max)` | 数値範囲制限 |
| `asyncHandler(fn)` | async 関数のエラーキャッチ |

---

## Bot 接続

### `POST /api/bot/connect`
Bot トークンで接続する。
```json
// Request
{ "token": "Bot_Token_Here" }
// Response
{ "success": true, "username": "BotName", "avatarUrl": "https://..." }
```

### `POST /api/bot/disconnect`
Bot を切断しトークンを削除する。
```json
{ "success": true }
```

### `GET /api/bot/status`
Bot の接続状態を返す（ヘルスチェック兼用）。
```json
{ "status": "online", "username": "BotName", "avatarUrl": "https://..." }
```

### `GET /api/guilds`
接続中のサーバー一覧。
```json
[{ "id": "123", "name": "サーバー名", "icon": "url", "memberCount": 50, "channels": [...], "roles": [...] }]
```

### `GET /api/guilds/:guildId/members`
サーバーのメンバー一覧。
```json
[{ "id": "456", "username": "user", "displayName": "User", "avatar": "url", "roles": [...] }]
```

---

## スラッシュコマンド

### `GET /api/commands`
全コマンド取得。

### `POST /api/commands`
コマンド作成。
```json
{ "name": "hello", "description": "挨拶", "response_type": "text", "response_text": "こんにちは！" }
```

### `PUT /api/commands/:id`
コマンド更新。ボディにフルオブジェクト。

### `DELETE /api/commands/:id`
コマンド削除。

### `POST /api/commands/sync`
DB のコマンドを Discord API に登録。
```json
{ "guildId": "123" }
```

### `GET /api/commands/registered?guildId=X`
Discord API に登録済みのコマンド一覧。

### `DELETE /api/commands/registered/:commandId?guildId=X`
Discord API からコマンド削除。

---

## ポイントシステム

### `GET /api/points/rules`
ポイント獲得ルール一覧。

### `PUT /api/points/rules`
ポイントルール一括更新。
```json
{ "rules": [{ "action": "message", "points": 2, "cooldown": 60, "enabled": true }] }
```

### `GET /api/points/leaderboard?guildId=X&limit=50`
ポイントランキング。

### `GET /api/points/stats?guildId=X`
ギルド全体の統計。

### `GET /api/points/members/:userId?guildId=X`
特定メンバーのポイント情報。

### `POST /api/points/adjust`
管理者によるポイント調整。
```json
{ "guildId": "123", "userId": "456", "amount": 100, "description": "イベント報酬" }
```

### `GET /api/points/transactions?guildId=X&userId=Y&limit=20`
取引履歴。

### `GET /api/points/economy?guildId=X`
経済設定（送金手数料、デイリーボーナス等）。

### `PUT /api/points/economy?guildId=X`
経済設定更新。

### `GET /api/points/channel-multipliers?guildId=X`
チャンネル倍率一覧。

### `PUT /api/points/channel-multipliers?guildId=X`
チャンネル倍率更新。
```json
{ "multipliers": [{ "channel_id": "789", "multiplier": 2.0 }] }
```

### `GET /api/points/decay-settings?guildId=X`
ポイント減衰設定。

### `PUT /api/points/decay-settings?guildId=X`
ポイント減衰設定更新。

---

## 報酬ショップ

### `GET /api/rewards`
報酬一覧。

### `POST /api/rewards`
報酬作成。

### `PUT /api/rewards/:id`
報酬更新。

### `DELETE /api/rewards/:id`
報酬削除。

---

## ガチャ

### `GET /api/gacha/settings`
ガチャ設定一覧。

### `PUT /api/gacha/settings/:id`
ガチャ設定更新。

---

## 自動応答

### `GET /api/auto-responses?guildId=X`
自動応答ルール一覧。

### `POST /api/auto-responses`
ルール作成。

### `PUT /api/auto-responses/:id`
ルール更新。

### `DELETE /api/auto-responses/:id`
ルール削除。

---

## モデレーション

### `GET /api/moderation/settings?guildId=X`
モデレーション設定。

### `PUT /api/moderation/settings?guildId=X`
モデレーション設定更新。

---

## 定時メッセージ

### `GET /api/scheduled-messages?guildId=X`
定時メッセージ一覧。

### `POST /api/scheduled-messages`
作成。

### `PUT /api/scheduled-messages/:id`
更新。

### `DELETE /api/scheduled-messages/:id`
削除。

---

## 入退室メッセージ

### `GET /api/welcome-settings?guildId=X`
入退室設定。

### `PUT /api/welcome-settings?guildId=X`
入退室設定更新。

---

## Embed テンプレート

### `GET /api/embed-templates?guildId=X`
テンプレート一覧。

### `POST /api/embed-templates`
作成。

### `PUT /api/embed-templates/:id`
更新。

### `DELETE /api/embed-templates/:id`
削除。

---

## RP ランクシステム

### ランク設定

#### `GET /api/ranks/config?guildId=X`
ランク設定一覧（13段階）。

#### `PUT /api/ranks/config?guildId=X`
ランク設定全置換。
```json
{ "ranks": [{ "rank_key": "c_minus", "rank_label": "C-", "rank_order": 0, "rp_threshold": 0, "cp_multiplier": 0.3, "color": "#808080", "icon": "🌱" }] }
```

#### `POST /api/ranks/config/tier?guildId=X`
ランク階層追加。

#### `DELETE /api/ranks/config/tier/:rankKey?guildId=X`
ランク階層削除。

### Xランク専用

#### `GET /api/ranks/x-config?guildId=X`
Xランク設定（サブティア等）。
```json
{ "guild_id": "123", "max_rp": 3000, "entry_rp": 1000, "demotion_threshold": 0, "tiers": [...] }
```

#### `PUT /api/ranks/x-config?guildId=X`
Xランク設定更新。

### 減衰設定

#### `GET /api/ranks/settings?guildId=X`
減衰設定。

#### `PUT /api/ranks/settings?guildId=X`
減衰設定更新。
```json
{ "decay_rate": 0.02, "decay_grace_days": 5, "decay_floor": 0 }
```

### 減衰免除

#### `GET /api/ranks/exempt?guildId=X`
免除メンバー一覧。

#### `POST /api/ranks/exempt`
免除設定。
```json
{ "guildId": "123", "userId": "456", "exempt": true, "exemptUntil": "2026-04-01T00:00:00Z" }
```

### RP ルール

#### `GET /api/ranks/rp-rules?guildId=X`
RPルール一覧。

#### `PUT /api/ranks/rp-rules?guildId=X`
RPルール一括更新。

#### `POST /api/ranks/rp-rules?guildId=X`
RPルール追加。

#### `DELETE /api/ranks/rp-rules/:id?guildId=X`
RPルール削除。

### メンバーランク

#### `GET /api/ranks/member/:userId?guildId=X`
メンバーのランク詳細。

#### `GET /api/ranks/leaderboard?guildId=X&limit=50`
RPリーダーボード。

#### `GET /api/ranks/rp-history/:userId?guildId=X&limit=20`
RP変動履歴。

### シーズン

#### `GET /api/ranks/season?guildId=X`
シーズン設定。

#### `PUT /api/ranks/season?guildId=X`
シーズン設定更新。

#### `GET /api/ranks/season/next?guildId=X`
次のシーズン終了日。

#### `GET /api/ranks/season/history?guildId=X`
シーズン履歴。

#### `POST /api/ranks/season/execute?guildId=X`
シーズン手動実行（テスト用）。

### 管理者操作

#### `POST /api/ranks/adjust`
RP手動調整。
```json
{ "guildId": "123", "userId": "456", "amount": 500, "source": "admin", "description": "イベント報酬" }
```

#### `POST /api/ranks/recalculate?guildId=X`
全メンバーのランク再計算。

---

## Cron ジョブ

| スケジュール | UTC | JST | 処理 |
|-------------|-----|-----|------|
| 毎日 | 19:00 | 04:00 | RP減衰 + シーズンチェック + 古いトランザクション削除 + Cronロック清掃 |

冪等性: `cron_locks` テーブルで同日2回実行を防止。
