---
name: db-integrity
description: データ整合性チェック（孤立レコード、不整合、外部キー違反）
---

SQLite MCPを使って、BotForgeデータベースの整合性を検証してください。

## チェック項目

1. **ポイント残高と取引履歴の整合性**
   - `member_points.total_points` と `point_transactions` の合計が一致するか
   - `SELECT mp.user_id, mp.total_points, COALESCE(SUM(pt.amount), 0) as calc_total FROM member_points mp LEFT JOIN point_transactions pt ON mp.guild_id = pt.guild_id AND mp.user_id = pt.to_user_id GROUP BY mp.guild_id, mp.user_id HAVING ABS(mp.total_points - calc_total) > 1`

2. **孤立レコード**
   - guild_idが存在しないレコードがないか
   - 参照先のないtransactionがないか

3. **データ型の異常**
   - NULLであるべきでないカラムにNULLが入っていないか
   - amount が 0 の取引がないか

4. **重複データ**
   - 同一ユーザー・同一ギルドで member_points が重複していないか
   - `SELECT guild_id, user_id, COUNT(*) FROM member_points GROUP BY guild_id, user_id HAVING COUNT(*) > 1`

5. **タイムスタンプ異常**
   - 未来の日付のレコードがないか
   - created_at が NULL のレコード

## 出力
- 問題なし → 「整合性チェック: ALL PASSED」
- 問題あり → 具体的なレコードと修正SQLを提案
