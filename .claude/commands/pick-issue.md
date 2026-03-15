---
description: GitHubのIssueを取得して作業ブランチを作成
---

# Issue駆動開発：タスクを拾って作業開始

1. まず最新のmainを取得してください。

```bash
git fetch origin main
```

2. アサイン可能なIssueを一覧表示してください。

```bash
gh issue list --state open --limit 10
```

3. ユーザーにどのIssueに取り組むか選んでもらってください。

4. 選んだIssueの詳細を取得し、要件を理解してください。

```bash
gh issue view <Issue番号>
```

5. Issue番号と内容から適切なブランチ名を決定し（例: `issue-12-add-gacha-test`）、作業ブランチを作成してください。

```bash
git checkout main
git pull origin main
git checkout -b <ブランチ名>
```

6. 「Issue #XX の作業を開始します。要件は以下の通りです：」と要件をまとめて表示し、実装方針を提案してください。
