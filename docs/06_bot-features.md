# BotForge Bot 機能仕様書

## 1. スラッシュコマンドビルダー

### 概要
ダッシュボードからノーコードでDiscordスラッシュコマンドを作成・管理。

### コマンド設定

| 項目 | 説明 |
|------|------|
| name | コマンド名（英数字小文字、ハイフン、アンダースコア） |
| description | コマンドの説明文 |
| response_type | `text` / `embed` / `random` |
| response_text | テキスト応答 |
| ephemeral | 本人のみ表示（true/false） |
| cooldown | 連続使用制限（秒） |
| dm_response | DMで返信するか |
| point_cost | 使用に必要なポイント |
| point_reward_min/max | 使用時のポイント報酬（ランダム範囲） |

### レスポンスタイプ

**text:** 単純テキスト返信
**embed:** リッチ埋め込み（タイトル、説明、カラー）
**random:** 登録済み応答からランダム選択

### 変数置換

| 変数 | 説明 |
|------|------|
| `{user}` | @メンション |
| `{username}` | ユーザー名 |
| `{server}` | サーバー名 |
| `{date}` | 現在日付 |
| `{time}` | 現在時刻 |
| `{random:MIN-MAX}` | ランダム数値 |
| `{option:NAME}` | コマンドオプションの値 |

### コマンドオプション

| オプション型 | Discord型 |
|-------------|----------|
| string | STRING |
| user | USER |
| integer | INTEGER |
| number | NUMBER |
| channel | CHANNEL |
| boolean | BOOLEAN |
| role | ROLE |

各オプションに `choices`（選択肢リスト）を設定可能。

### 権限管理

- required_permissions: `Administrator`, `ManageGuild`, `ManageChannels` 等
- allowed_roles: 特定ロールのみ使用許可

### Discord API同期

`POST /api/commands/sync` で DB のコマンド定義を Discord API に登録。ギルドスコープで登録されるため即時反映。

---

## 2. 自動応答

### 概要
特定のキーワードやパターンに自動で返信する。

### マッチタイプ

| タイプ | 説明 | 例 |
|--------|------|-----|
| contains | 部分一致 | 「おはよう」を含むメッセージ |
| exact | 完全一致 | 「おはよう」のみ |
| startsWith | 前方一致 | 「おはよう」で始まるメッセージ |
| regex | 正規表現 | `/おは(よう|よー)/` |

### スコープ

- **all:** 全チャンネルで反応
- **specific:** 指定チャンネルのみ

### ギルドスコープ

- `guild_id = '__global__'`: 全サーバー共通
- `guild_id = 'XXXXX'`: 特定サーバーのみ

---

## 3. モデレーション

### NGワードフィルター

| 設定 | 説明 |
|------|------|
| ng_word_enabled | 有効/無効 |
| ng_words | NGワードリスト (JSON) |
| action | `delete_warn` / `delete` / `mute` / `kick` / `ban` |

### スパム検出

| 設定 | デフォルト | 説明 |
|------|-----------|------|
| spam_enabled | true | |
| spam_threshold | 5 | メッセージ数 |
| spam_time_window | 10 | 検出時間窓（秒） |
| spam_action | mute | `mute` / `kick` / `ban` |

### リンクフィルター

| 設定 | 説明 |
|------|------|
| link_filter_enabled | 有効/無効 |
| link_whitelist | 許可ドメインリスト |

### 大文字フィルター

| 設定 | デフォルト | 説明 |
|------|-----------|------|
| caps_filter_enabled | false | |
| caps_threshold | 70% | 大文字率の閾値 |

### 警告システム

| 設定 | デフォルト | 説明 |
|------|-----------|------|
| warning_limit | 3 | 警告回数上限 |
| warning_action | kick | 上限到達時のアクション |

### ログチャンネル

`log_channel_id` を設定するとモデレーションログを指定チャンネルに送信。

---

## 4. 定時メッセージ

### 概要
指定した時刻・曜日にメッセージを自動送信。

### 設定項目

| 項目 | 説明 |
|------|------|
| name | メッセージ名（識別用） |
| message | 送信内容 |
| channel_id | 送信先チャンネル |
| time | 送信時刻（HH:MM形式） |
| days | 送信曜日（0=月〜6=日） |
| timezone | タイムゾーン（デフォルト: `Asia/Tokyo`） |
| enabled | 有効/無効 |

### 実行

`node-cron` で毎分チェック。現在時刻が設定と一致し、最終実行が今日でなければ送信。

---

## 5. 入退室メッセージ

### 入室（Welcome）

| 設定 | 説明 |
|------|------|
| welcome_enabled | 有効/無効 |
| welcome_channel_id | 送信先チャンネル |
| welcome_message | テキストメッセージ |
| welcome_embed_enabled | Embed使用 |
| welcome_embed_title | Embedタイトル |
| welcome_embed_description | Embed説明文 |
| welcome_embed_color | Embedカラー |
| welcome_embed_thumbnail | アバターサムネイル表示 |
| welcome_dm_enabled | DM送信 |
| welcome_dm_message | DMメッセージ |

### 退室（Leave）

| 設定 | 説明 |
|------|------|
| leave_enabled | 有効/無効 |
| leave_channel_id | 送信先チャンネル |
| leave_message | テキストメッセージ |

### 変数

| 変数 | 説明 |
|------|------|
| `{user}` | @メンション |
| `{username}` | ユーザー名 |
| `{server}` | サーバー名 |
| `{memberCount}` | メンバー数 |

---

## 6. Embed テンプレート

### 概要
リッチ埋め込みメッセージのテンプレートを保存・再利用。

### Embed 構造

```json
{
  "author": { "name": "", "iconUrl": "", "url": "" },
  "title": "",
  "url": "",
  "description": "",
  "color": "#7c5cfc",
  "thumbnail": "",
  "image": "",
  "footer": { "text": "", "iconUrl": "" },
  "fields": [
    { "name": "フィールド名", "value": "値", "inline": false }
  ]
}
```

---

## 7. ビルトインコマンド一覧

Bot 接続時に自動登録されるコマンド:

| コマンド | 説明 | オプション |
|----------|------|-----------|
| /balance | ポイント残高・ステータス | `user`: 対象ユーザー |
| /history | 取引履歴 | `count`: 表示件数 |
| /actions | ポイント獲得方法一覧 | なし |
| /transfer | ポイント送金 | `user`, `amount` |
| /pay | ポイント支払い | `user`, `amount` |
| /daily | デイリーボーナス | なし |
| /ranking | CPランキングTOP10 | なし |
| /rank | ランク詳細 | `user`: 対象ユーザー |
| /rp-ranking | RPランキングTOP10 | なし |
| /season | シーズン情報 | なし |
| /gacha | ガチャを回す | なし |
| /coinflip | コインフリップ | `amount`: 賭け金 |
