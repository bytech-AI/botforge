---
name: api-test
description: 指定APIエンドポイントにリクエスト送って結果確認
---

Fetch MCPを使って、BotForgeのAPIエンドポイントをテストしてください。

## 引数
$ARGUMENTS にエンドポイントを指定（例: `/api/points/rules`, `GET /api/bot/status`）。
メソッド省略時はGET。

## テスト手順
1. `http://localhost:3001{エンドポイント}` にリクエスト送信
2. レスポンスの確認:
   - HTTPステータスコード
   - Content-Type
   - レスポンスボディ（JSON整形表示）
   - レスポンス時間
3. エラーの場合はエラーメッセージを表示

## 使用例
- `/api-test /api/bot/status` — Bot接続状態確認
- `/api-test POST /api/points/rules {"name":"test","type":"message"}` — ルール作成テスト
- `/api-test /api/points/economy?guildId=123456` — ギルド別設定取得
