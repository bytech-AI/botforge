---
name: db-export
description: 指定テーブルをCSV/JSON形式でエクスポート
---

SQLite MCPを使って、指定テーブルのデータをエクスポートしてください。

## 引数
$ARGUMENTS にテーブル名を指定してください。オプションで形式（csv/json）と条件を指定可能。
例: `member_points json guild_id=123456`

## 手順
1. テーブルの存在確認: `SELECT name FROM sqlite_master WHERE type='table' AND name = ?`
2. カラム情報取得: `PRAGMA table_info(<table>)`
3. データ取得: `SELECT * FROM <table>` （条件指定があればWHERE句追加）
4. 指定形式で `data/exports/` ディレクトリに出力

## 注意
- 1万行以上の場合はLIMITを付けて警告する
- APIキーなど機密情報を含むカラムはマスクする（`api_key_encrypted` など）
