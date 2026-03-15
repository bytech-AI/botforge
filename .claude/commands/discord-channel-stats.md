---
name: discord-channel-stats
description: チャンネル別のメッセージ数・アクティブ度を取得
---

Discord MCPとSQLite MCPを組み合わせて、チャンネル別の活動統計を出してください。

## 引数
$ARGUMENTS にギルドIDを指定。

## 分析項目
1. **チャンネル別ポイント取引数**
   - SQLiteから: `SELECT channel_id, COUNT(*) FROM point_transactions WHERE guild_id = ? GROUP BY channel_id ORDER BY COUNT(*) DESC`
   - ※ channel_id カラムがない場合はスキップ

2. **AI採点チャンネル別統計**
   - `SELECT channel_id, COUNT(*), AVG(score) FROM ai_scoring_results WHERE guild_id = ? GROUP BY channel_id`

3. **Discord側のチャンネル情報**
   - Discord MCPで各チャンネル名を解決
   - チャンネルのトピック、作成日、メンバーアクセス数

## 出力
- チャンネル名 | メッセージ関連取引数 | AI採点数 | 平均スコア の表形式
- 活発/過疎チャンネルをハイライト
