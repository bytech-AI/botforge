---
name: db-user-lookup
description: ユーザーIDからポイント・RP・ランク・採点履歴を横断検索
---

SQLite MCPを使って、指定されたユーザーの全データを横断検索してください。

## 引数
$ARGUMENTS にユーザーID（Discord ID）を指定してください。

## 検索対象
1. **ポイント残高**: `member_points` テーブルから total_points, total_earned, messages, reactions, voice_minutes, streak_days
2. **取引履歴（直近20件）**: `point_transactions` テーブルから最新の取引を取得
3. **RP情報**: `member_rp` テーブルからランク内RP、累計RP
4. **ランク**: `ranks` テーブルと照合して現在のランクを特定
5. **AI採点履歴**: `ai_scoring_results` テーブルから直近の採点結果
6. **デイリーボーナス状態**: `daily_claims` テーブルから最終申請日

## 出力形式
- 各カテゴリごとにセクション分けして表示
- ポイントの推移が分かるように時系列で表示
