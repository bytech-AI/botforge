---
name: external-api-check
description: Anthropic/OpenAI APIの疎通確認（採点機能の事前チェック）
---

Fetch MCPを使って、AI採点で使用する外部APIの疎通を確認してください。

## チェック項目

1. **Anthropic API**
   - エンドポイント: `https://api.anthropic.com/v1/messages`
   - ヘッダー: `x-api-key`, `anthropic-version: 2023-06-01`
   - 最小限のテストリクエスト（max_tokens: 10）
   - レートリミット状態の確認

2. **OpenAI API**
   - エンドポイント: `https://api.openai.com/v1/chat/completions`
   - ヘッダー: `Authorization: Bearer {key}`
   - 最小限のテストリクエスト（max_tokens: 10）

## 注意
- APIキーはユーザーに確認する（DBに暗号化保存されているため直接取得不可）
- テストメッセージは最小限にしてコスト削減
- レスポンスからモデル利用可能状態とレートリミットヘッダーを確認
