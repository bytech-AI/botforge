---
name: save-decision
description: 設計判断・「なぜこうしたか」をMemory MCPに記録
---

Memory MCPを使って、設計判断や技術的決定を記録してください。

## 引数
$ARGUMENTS に記録する内容を指定。
例: `RPシステムはランク内RP方式を採用。理由: シーズンリセット時に全RPが消えるとユーザーの不満が大きいため`

## 記録形式
以下の構造で保存:
```json
{
  "type": "decision",
  "date": "YYYY-MM-DD",
  "topic": "決定事項のタイトル",
  "decision": "何を決めたか",
  "reason": "なぜその判断をしたか",
  "alternatives": "検討した他の選択肢",
  "impact": "影響範囲"
}
```

## 用途
- 後から「なぜこうなっている？」と疑問に思った時に検索できる
- 同じ議論を繰り返さないための記録
- PRレビュー時の背景説明に使える
