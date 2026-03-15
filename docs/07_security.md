# BotForge セキュリティ仕様書

## Bot トークン管理

### 暗号化方式

| 項目 | 値 |
|------|-----|
| アルゴリズム | AES-256-GCM |
| 鍵長 | 256bit (32bytes) |
| IV | 12bytes (ランダム生成) |
| 認証タグ | 16bytes |

### 保存形式

```
token.enc = base64(IV_12bytes + AuthTag_16bytes + Ciphertext)
```

### 鍵管理

- **環境変数 `ENCRYPTION_KEY`:** 存在すれば SHA-256 ハッシュを鍵として使用
- **ファイル `data/encryption.key`:** 環境変数がない場合、ランダム32bytesを生成して保存

### トークン読み込み優先順位

1. 環境変数 `DISCORD_TOKEN`（最優先）
2. 暗号化ファイル `data/token.enc`（AES-256-GCM）
3. 旧 base64 ファイル（フォールバック → 自動で暗号化形式にマイグレーション）

### トークン削除

`POST /api/bot/disconnect` で `token.enc` を物理削除。

---

## API セキュリティ

### 現状

| 項目 | 状態 |
|------|------|
| 認証 | **なし**（将来追加予定） |
| HTTPS | Railway デプロイ時は自動 |
| CORS | 全オリジン許可 |
| Rate Limiting | **なし** |
| ボディサイズ制限 | 1MB |

### バリデーション

| ミドルウェア | 対象 |
|-------------|------|
| requireGuildId | guildId クエリパラメータ必須 |
| requireIntParam | URLパラメータが整数 |
| requireBody | ボディ必須フィールド |
| maxLength | 文字列長制限 |
| numberRange | 数値範囲制限 |

### エラーハンドリング

- asyncHandler: Promise rejection をキャッチ
- globalErrorHandler: 500エラーをJSON返却
- notFoundHandler: 404エラー

---

## データベースセキュリティ

| 項目 | 状態 |
|------|------|
| SQLインジェクション | **対策済み**（Prepared Statements使用） |
| WALモード | 有効（同時読み書き性能向上） |
| ファイルパーミッション | OS依存 |
| バックアップ | **手動**（将来自動化予定） |

---

## 既知のリスクと対策予定

### 高優先度

| リスク | 影響 | 対策 |
|--------|------|------|
| ダッシュボード認証なし | URL知ってれば誰でも操作可能 | パスワード認証追加 |
| CORS全開放 | 任意ドメインからAPI呼び出し可能 | 許可オリジン制限 |
| Rate Limiting なし | API DoS攻撃に脆弱 | express-rate-limit 導入 |

### 中優先度

| リスク | 影響 | 対策 |
|--------|------|------|
| 暗号鍵とデータが同一Volume | 物理アクセスで復号可能 | 環境変数で鍵管理 |
| セッション管理なし | ステートレスAPI | JWT/セッション導入 |

### 低優先度

| リスク | 影響 | 対策 |
|--------|------|------|
| ログに機微情報 | コンソールにエラー詳細 | 本番ログレベル制御 |
| CSP未設定 | XSS時のダメージ拡大 | Content-Security-Policy 追加 |
