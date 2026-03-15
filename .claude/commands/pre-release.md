---
name: pre-release
description: リリース前の総合チェックリスト（ビルド + UI + DB + API）
---

リリース前の総合チェックを実行してください。複数のMCPとツールを組み合わせます。

## チェックリスト

### 1. ビルド確認
- `npm run build` が成功するか
- ビルドサイズが異常に大きくないか（前回比）

### 2. DB整合性（SQLite MCP）
- マイグレーションが全て適用されているか
- データ不整合がないか
- `/db-integrity` スキルを実行

### 3. API全チェック（Fetch MCP）
- `/api-health` スキルを実行
- 全エンドポイントが200を返すか

### 4. UI全ページ確認（Playwright MCP）
- `/all-pages-screenshot` スキルを実行
- コンソールエラーがないか

### 5. コード品質
- `git diff main` で変更差分を確認
- console.logの消し忘れがないか
- 機密情報（トークン、APIキー）がコードに含まれていないか

### 6. Git状態
- コミット漏れのファイルがないか
- ブランチが最新のmainとマージ済みか

## 出力
- 全項目のPASS/FAILリスト
- FAILがあればリリースを止めて修正を推奨
