---
name: db-guild-report
description: ギルド統計レポート（アクティブ数、ポイント流通量、ランク分布）
---

SQLite MCPを使って、指定ギルドの統計レポートを生成してください。

## 引数
$ARGUMENTS にギルドID（Discord サーバーID）を指定してください。省略時は全ギルド。

## レポート項目
1. **メンバー統計**
   - 総メンバー数、直近7日のアクティブ数
   - `SELECT COUNT(*), COUNT(CASE WHEN last_active > datetime('now', '-7 days') THEN 1 END) FROM member_points WHERE guild_id = ?`

2. **ポイント経済**
   - 総流通ポイント: `SELECT SUM(total_points) FROM member_points WHERE guild_id = ?`
   - 累計発行量: `SELECT SUM(total_earned) FROM member_points WHERE guild_id = ?`
   - 今日の取引数・取引量

3. **ランク分布**
   - 各ランクの人数分布

4. **活動内訳**
   - メッセージ/リアクション/ボイスの割合
   - `SELECT SUM(messages), SUM(reactions), SUM(voice_minutes) FROM member_points WHERE guild_id = ?`

5. **AI採点統計**
   - 今日の採点数、平均スコア、付与RP合計

## 出力形式
- 数値はカンマ区切りで読みやすく
- 前週比などの変化も可能であれば算出
