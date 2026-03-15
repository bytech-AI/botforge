---
name: api-health
description: 全APIエンドポイントを叩いてステータスコード一括確認
---

Fetch MCPを使って、BotForgeの全APIエンドポイントのヘルスチェックを実行してください。

## 対象エンドポイント（GET）
- `/api/bot/status`
- `/api/guilds`
- `/api/commands`
- `/api/points/rules`
- `/api/points/actions`
- `/api/points/economy?guildId=test`
- `/api/rewards`
- `/api/gacha/config`
- `/api/scheduled-messages`
- `/api/auto-responses`
- `/api/moderation/settings`
- `/api/welcome/settings`
- `/api/ai-scoring/settings`
- `/api/rank/config`
- `/api/voice-debug/status`

## テスト手順
1. 各エンドポイントに GET リクエスト送信（ベースURL: `http://localhost:3001`）
2. 以下を記録:
   - ステータスコード（200/400/404/500）
   - レスポンス時間
   - エラーメッセージ（あれば）

## 出力形式
| エンドポイント | ステータス | 時間 | 結果 |
|---|---|---|---|
- 全てOKなら「ALL PASSED」
- 失敗があれば詳細と修正提案
