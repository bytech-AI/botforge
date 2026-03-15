---
name: db-economy-audit
description: ポイント経済分析（インフレ率、上位獲得者、異常値検出）
---

SQLite MCPを使って、ポイント経済の健全性を分析してください。

## 分析項目

1. **インフレ指標**
   - 日別のポイント発行量推移
   - `SELECT DATE(created_at) as day, SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as issued, SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as consumed FROM point_transactions GROUP BY day ORDER BY day DESC LIMIT 14`
   - 発行量 vs 消費量のバランス

2. **上位獲得者**
   - ポイント保有量トップ10
   - `SELECT user_id, total_points, total_earned, messages, voice_minutes FROM member_points WHERE guild_id = ? ORDER BY total_points DESC LIMIT 10`

3. **異常値検出**
   - 1日の獲得量が平均の3倍以上のユーザー
   - 短時間に大量の取引があるユーザー（Bot疑い）

4. **経済バランス**
   - 総発行量 vs 総消費量
   - ジニ係数（ポイント格差）の概算
   - デイリーボーナスの利用率

5. **改善提案**
   - インフレ傾向があれば減衰設定の推奨値を提案
   - 過疎状態であればボーナス増加を提案
