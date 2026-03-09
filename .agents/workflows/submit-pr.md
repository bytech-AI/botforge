---
description: 実装が完了したら、コミット・プッシュ・PR作成までを一気に行います。PRにはIssue番号を紐付けて、レビュー側（Antigravity）が確認しやすくします。
---

# Issue駆動開発：PR作成フロー

このワークフローは、作業完了後にPRを作成し、設計・レビュー側に引き渡すまでを自動化します。

1. 現在のブランチ名と変更内容を確認してください。

```bash
git branch --show-current
git status
git diff --stat
```

2. 変更内容から適切なコミットメッセージ（日本語）を推測し、ユーザーに確認してください。

3. 確認が取れたら、コミットしてプッシュしてください。

```bash
git add -A
git commit -m "<コミットメッセージ>"
git push origin HEAD
```

4. ブランチ名からIssue番号を推測し（例: `issue-12-xxx` → `#12`）、PRを作成してください。

```bash
gh pr create --title "<PRタイトル>" --body "$(cat <<'EOF'
## 対応Issue
Closes #<Issue番号>

## 変更内容
- <変更点を箇条書き>

## テスト
- [ ] 動作確認済み

🔄 レビューお願いします（Antigravity側）
EOF
)"
```

5. PR作成後、URLをユーザーに表示してください。
