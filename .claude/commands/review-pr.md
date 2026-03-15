---
description: PRのコードを多角的にレビューし、改善提案を出す
---

# PR コードレビュー

$ARGUMENTS にPR番号が指定されている場合はそのPRを、なければ最新のPRをレビューしてください。

1. PR情報を取得してください。

```bash
gh pr view $ARGUMENTS --json title,body,files,additions,deletions,headRefName,baseRefName
gh pr diff $ARGUMENTS
```

2. 以下の観点で多角的にレビューしてください：

**セキュリティ**
- SQLインジェクション、XSS、コマンドインジェクション
- 認証・認可の漏れ
- 秘密情報のハードコード

**データ整合性**
- トランザクション処理の適切さ
- レースコンディション
- エラー時のロールバック

**コード品質**
- 重複コードの有無
- 適切な抽象化レベル
- エラーハンドリング

**パフォーマンス**
- N+1クエリ
- メモリリーク（長時間実行Map等）
- 不必要な再レンダリング（React）

3. CLAUDE.mdルールに従い、**最低1つの改善提案**を出してください。LGTM即マージは禁止です。

4. 結果をまとめて報告してください。重要度順（CRITICAL > HIGH > MEDIUM > LOW）で整理してください。
