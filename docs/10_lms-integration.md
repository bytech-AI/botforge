# 学習サイト（LMS）との連携

学習サイト（lms.bytech.jp。リポジトリ bytech-AI/lms_bytech）の受講生と、受講生用 Discord サーバーをつなぐ。

## できること

| 機能 | 流れ |
|------|------|
| ひも付け | LMS のマイページ「Discord と連携」で Discord にログイン → LMS が Discord のユーザーIDを会員に保存する（BotForge 側は何も持たない） |
| 学習で RP・CP | LMS がレッスン完了・課題OK・コース修了を `POST /api/integrations/lms/events` に送る → RP と CP（ランク倍率つき）を付ける |
| プランのロール | LMS が会員のプランを `POST /api/integrations/lms/roles` に送る → `LMS_PLAN_ROLE_MAP` のロールを付け外しする |
| ランクの表示 | LMS のマイページが `GET /api/integrations/lms/members/:discordUserId` でランク・RP・ポイントを聞く |
| `/study` | 受講生が Discord で打つ → BotForge が LMS に学習状況を聞き、本人にだけ表示する |

コードは `server/integrations/lms.js`・`server/integrations/lms-signature.js`・`server/bot/commands/study.js`。

## 付ける量

管理画面の RP ルール・ポイントルールで変えられる（`lms_` で始まるもの）。はじめに入る値:

| 出来事 | action | RP | CP（倍率をかける前） |
|--------|--------|----|----|
| レッスン完了 | `lms_lesson_complete` | 20 | 5 |
| 課題OK | `lms_submission_approved` | 100 | 30 |
| コース修了 | `lms_course_complete` | 300 | 100 |

- 同じ出来事（`eventId`）は2回付けない（`lms_events` テーブル）。LMS は届かなかった分を送り直すため
- LMS 側でも、同じレッスン・課題・コースでは1回しか出来事を作らない

## ロール

- `LMS_PLAN_ROLE_MAP` に書いたロールと `LMS_LINKED_ROLE_ID` だけを付け外しする。ほかのロールには触らない
- プランは `FREE`（無料）／`SELF_STUDY`（AI独学プラン）／`MENTORING`（マンツーマン）／`MEMBER`（そのほかの有料会員）／`BIZ`（法人研修）
- 連携を外した人は、上のロールを全部外す
- Bot のロールを、付け外しするロールより上に置き、「ロールの管理」の権限を付けておく

## 署名

LMS と BotForge は同じ合言葉を持ち、`時刻.メソッド.パス.本文` を HMAC-SHA256 で署名して `x-lms-timestamp`・`x-lms-signature` に入れる。時刻が5分以上ずれたものは断る。連携の API はダッシュボードからは使わない。

## 環境変数（Railway）

| 変数 | 中身 |
|------|------|
| `LMS_SHARED_SECRET` | LMS との合言葉（LMS の `BOTFORGE_SHARED_SECRET` と同じ値）。無ければ連携の API は 503 を返す |
| `LMS_GUILD_ID` | 受講生用 Discord サーバーの ID |
| `LMS_BASE_URL` | `https://lms.bytech.jp`（`/study` が聞きに行く先） |
| `LMS_PLAN_ROLE_MAP` | 例 `{"SELF_STUDY":"<ロールID>","MENTORING":"<ロールID>","MEMBER":"<ロールID>","BIZ":"<ロールID>"}` |
| `LMS_LINKED_ROLE_ID` | 連携した人全員に付けるロール（任意） |

LMS の「Discord と連携」は、この Bot と同じ Discord アプリの OAuth2 を使う。Developer Portal の OAuth2 → Redirects に `https://lms.bytech.jp/api/discord/link/callback` を登録し、Client ID・Client Secret を LMS（Vercel）の `DISCORD_LINK_CLIENT_ID`・`DISCORD_LINK_CLIENT_SECRET` に入れる。

`/study` を Discord に出すには、ダッシュボードのコマンド同期（`POST /api/commands/sync`）をもう一度行う。
