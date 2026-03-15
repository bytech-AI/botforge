---
name: railway-status
description: Railwayデプロイ状況・ヘルスチェック
---

Fetch MCPを使って、Railway上のBotForgeの稼働状態を確認してください。

## チェック項目
1. **ヘルスチェック**: 本番URLにアクセスしてHTTPステータス確認
2. **API疎通**: `/api/bot/status` エンドポイントの応答確認
3. **レスポンス時間**: リクエストからレスポンスまでの時間計測

## 注意
- 本番URLがわからない場合はユーザーに確認する
- Railway CLIが使える場合は `railway status` も実行
