---
name: discord-permissions-audit
description: Bot権限の過不足チェック（機能別に必要な権限を確認）
---

Discord MCPを使って、BotForgeの各機能に必要なDiscord権限を監査してください。

## 機能別必要権限マトリクス

| 機能 | 必要権限 |
|------|----------|
| メッセージポイント | Read Messages, Message History |
| リアクションポイント | Read Messages, Add Reactions |
| ボイスポイント | Connect, View Channel |
| ウェルカムメッセージ | Send Messages, Embed Links |
| AI採点通知 | Send Messages, Embed Links |
| モデレーション | Kick Members, Ban Members, Manage Messages |
| ロール報酬 | Manage Roles |
| スラッシュコマンド | Use Application Commands |
| DM送信 | Send Messages (DM) |

## チェック手順
1. 各ギルドでBotの現在の権限を取得
2. 上記マトリクスと照合
3. 不足している権限を一覧表示
4. 権限の修正方法（招待リンクまたはロール設定）を案内
