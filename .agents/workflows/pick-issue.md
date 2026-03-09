---
description: GitHubのIssueを取得し、優先度の高いものから作業を開始します。設計側（Antigravity）が起票したIssueを開発側（Claude Code）が拾うためのワークフローです。
---

# Issue駆動開発：タスクを拾って作業開始

このワークフローは、GitHubのIssueから次に取り組むべきタスクを選び、作業ブランチを作成します。

1. 以下のコマンドでアサイン可能なIssueを一覧表示してください。

```bash
gh issue list --state open --label "ready" --limit 10
```

もし `ready` ラベルのIssueがなければ、ラベルなしで全件表示してください：

```bash
gh issue list --state open --limit 10
```

2. ユーザーにどのIssueに取り組むか選んでもらってください。

3. 選んだIssueの詳細を取得し、要件を理解してください。

```bash
gh issue view <Issue番号>
```

4. Issue番号と内容から適切なブランチ名を決定し（例: `issue-12-add-gacha-test`）、作業ブランチを作成してください。

```bash
git checkout main
git pull origin main
git checkout -b <ブランチ名>
```

5. 「Issue #XX の作業を開始します。要件は以下の通りです：」と要件をまとめて表示し、実装方針を提案してください。
