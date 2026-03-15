---
name: known-issues
description: 既知のバグ・制約事項をMemory MCPに記録/検索
---

Memory MCPを使って、既知のバグや制約事項を管理してください。

## 使い方
- **記録**: `/known-issues add ボイスポイントでソロミュートユーザーにポイント付与されるバグ（修正済み）`
- **検索**: `/known-issues search ボイス`
- **一覧**: `/known-issues list`

## 記録形式
```json
{
  "type": "known_issue",
  "date": "YYYY-MM-DD",
  "title": "問題のタイトル",
  "description": "詳細",
  "status": "open|fixed|wontfix",
  "workaround": "回避策（あれば）",
  "fixed_in": "修正PR番号（修正済みの場合）"
}
```
