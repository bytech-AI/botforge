---
name: db-health
description: DBヘルスチェック（テーブル一覧・レコード数・マイグレーション状態）
---

SQLite MCPを使って、BotForgeのデータベース健全性を一括チェックしてください。

## チェック項目
1. **テーブル一覧**: `SELECT name FROM sqlite_master WHERE type='table'` で全テーブルを取得
2. **レコード数**: 各テーブルの `SELECT COUNT(*) FROM <table>` を実行
3. **空テーブル検出**: レコード数0のテーブルを警告
4. **カラム構成**: 主要テーブル（member_points, point_transactions, ranks, rp_transactions）のカラム一覧を `PRAGMA table_info(<table>)` で確認
5. **インデックス**: `SELECT * FROM sqlite_master WHERE type='index'` でインデックスの有無を確認

## 出力形式
- テーブル名 | レコード数 | 状態（OK/警告）の表形式
- 問題があれば具体的な改善提案を出す
