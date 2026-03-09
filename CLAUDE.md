# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BotForge is a Japanese-language Discord bot builder with a visual web UI. Users connect their Discord bot token through the dashboard and configure features (slash commands, point system, auto-responses, moderation, etc.) without writing code. Deployed on Railway via Dockerfile.

## Commands

- `npm run dev` — Start both Vite dev server and Express backend concurrently (frontend on :5173, backend on :3001)
- `npm run build` — Build frontend with Vite (output to `dist/`)
- `npm start` — Production server only (serves built frontend from `dist/` + API)

No test framework is configured.

## Architecture

**Monorepo with two runtimes:**
- **Frontend:** React 18 SPA with Vite, React Router, plain CSS (`src/index.css`). No component library or state management beyond React Context (`AppContext` in `App.jsx`).
- **Backend:** Express server (`server/index.js`) exposing REST API at `/api/*`. In dev, Vite proxies `/api` requests to `:3001`.

**Key server files:**
- `server/index.js` — Express routes for all API endpoints (bot connection, commands CRUD, points, rewards, gacha, guilds)
- `server/bot.js` — Discord.js client lifecycle, slash command registration, event handlers (message points, reactions, voice tracking, auto-responses, scheduled messages, gacha, moderation)
- `server/db.js` — SQLite via better-sqlite3, schema init with migrations, all DB helper functions (commands, points, rewards, gacha, economy, leveling)

**Database:** SQLite stored at `data/botforge.db` (gitignored). Schema is created on startup in `initDatabase()`. Migrations are additive `ALTER TABLE` statements that silently fail if columns exist.

**Bot token:** Persisted as base64-encoded file at `data/token.enc` for auto-reconnect on server restart.

**Frontend pages** (`src/pages/`): Each page is a self-contained component that fetches from `/api/*` endpoints. Global state (bot status, selected guild, toast notifications) flows through `AppContext`.

## Conventions

- UI text is in Japanese throughout (error messages, labels, descriptions)
- ES Modules (`"type": "module"` in package.json) — use `import`/`export`, not `require`
- DB columns use `snake_case`; JS objects from the API use `camelCase` (deserialized in `db.js` helper functions like `deserializeCommand`)
- All CSS is in a single `src/index.css` file — no CSS modules or styled-components
- The leveling system uses an RPG-style curve: `level = floor(sqrt(totalEarned / 1.5)) + 1`

## Git Workflow

The project uses a branch-based workflow with agent workflows defined in `.agents/workflows/`:
- `start-work.md` — Pull latest main, create feature branch
- `finish-work.md` — Commit, push, then create PR on GitHub
- `pick-issue.md` — GitHubのIssueを取得して作業開始（Claude Code用）
- `submit-pr.md` — Issue紐付きPRを作成してレビューに回す（Claude Code用）

## 共同開発体制（Mac Antigravity ↔ Win Claude Code）

2つのAI環境が対等にレビューし合い、コードをブラッシュアップする体制。

| 環境 | 得意分野 | 主な作業 |
|------|----------|----------|
| Mac / Antigravity | UI/UX設計、ビジュアル確認、ユーザー体験 | 設計・Issue起票、UI/動作レビュー、改善提案 |
| Win / Claude Code | コード品質、アーキテクチャ、パフォーマンス | 実装、コードレビュー、設計へのフィードバック |

**PDCAサイクル：**
1. **Plan** — どちらかがIssueを起票（設計 or 改善提案どちらからでもOK）
2. **Do** — 実装担当がブランチ→実装→PR作成
3. **Check** — もう片方がレビュー。遠慮なくダメ出し・改善提案する
4. **Act** — 修正→再レビュー→マージ→次の改善点を洗い出し

**相互レビューのルール：**
- PRには必ず「ここが不安」「別案あれば教えて」などレビュー観点を書く
- レビュー側は最低1つ改善提案をする（LGTM即マージは禁止）
- 設計に対して「実装側からの逆提案」を歓迎する
- 意見が割れたらIssueにメリデメを書き出して判断する

**ルール：**
- `main` ブランチには直接pushしない（必ずPR経由）
- Issue起票時は `.github/ISSUE_TEMPLATE/design-task.md` のテンプレートを使う
- PRには `Closes #XX` を含めてIssueを自動クローズする
- 作業開始前に必ず `git pull origin main` で最新を取得する
