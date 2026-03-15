# BotForge ポイント・経済システム仕様書

## 概要

CP（Coin Point）はサーバー内の通貨。活動で獲得し、送金・ガチャ・報酬交換に使える。RP（ランクポイント）とは独立した通貨。

## ポイント獲得

### 獲得ルール（デフォルト）

| アクション | 基本CP | クールダウン | 説明 |
|-----------|--------|------------|------|
| message | 1 | 60秒 | メッセージ送信 |
| reaction_give | 0.5 | なし | リアクション付与 |
| reaction_receive | 1 | なし | リアクション受信 |
| voice_join | 0.1/分 | なし | ボイス参加 |
| invite | 10 | なし | 招待成功 |
| thread_create | 3 | 300秒 | スレッド作成 |

### CP倍率

実際の獲得CP = 基本CP × ランク倍率（`getCpMultiplier()`）

例: Aランク（×1.0）でメッセージ送信 = 1 × 1.0 = 1 CP
例: S+ランク（×1.4）でメッセージ送信 = 1 × 1.4 = 1.4 CP

### チャンネル倍率

特定チャンネルにポイント倍率を設定可能。ランク倍率とは別に適用。

```
最終CP = 基本CP × ランク倍率 × チャンネル倍率
```

## レベルシステム

累計獲得ポイントからレベルを計算:

```
level = floor(sqrt(total_earned / 1.5)) + 1
```

| 累計獲得 | レベル |
|---------|--------|
| 0 | 1 |
| 6 | 3 |
| 24 | 5 |
| 54 | 7 |
| 150 | 11 |
| 600 | 21 |

## 経済設定

| 設定 | デフォルト | 説明 |
|------|-----------|------|
| transfer_fee_percent | 0% | 送金手数料率 |
| min_transfer_amount | 10 | 最小送金額 |
| daily_transfer_limit | 10,000 | 1日送金上限 |
| daily_bonus_amount | 50 | デイリーボーナス基本額 |
| daily_bonus_streak_multiplier | 1.1 | 連続ログイン倍率 |
| max_daily_bonus | 200 | デイリーボーナス上限 |

### 送金（/transfer, /pay）

```
送金額: amount
手数料: amount × transfer_fee_percent / 100
送金者の減少: amount + 手数料
受取者の増加: amount
```

### デイリーボーナス（/daily）

```
ボーナス額 = min(daily_bonus_amount × streak_multiplier^(streak_days - 1), max_daily_bonus)
```

- 24時間以内に再取得不可
- 連続ログインでストリーク増加
- 1日スキップでストリークリセット

## ガチャ（/gacha）

| 項目 | 説明 |
|------|------|
| cost | 1回あたりのCP消費 |
| items | JSON: `[{name, emoji, points, weight}]` |

**デフォルトガチャ:**
| 名前 | 絵文字 | CP報酬 | 出現率 |
|------|--------|--------|--------|
| ハズレ | 💨 | 0 | 40% |
| ブロンズ | 🥉 | 50 | 30% |
| シルバー | 🥈 | 150 | 18% |
| ゴールド | 🥇 | 300 | 8% |
| ダイヤモンド | 💎 | 500 | 3% |
| 伝説 | 🐉 | 1,000 | 1% |

### 抽選ロジック

重み付きランダム: `Math.random() × totalWeight` から対応アイテムを決定。

## コインフリップ（/coinflip）

- 賭け金を指定
- 50% で2倍獲得、50% で没収
- 最低賭け金: 10 CP

## 報酬ショップ

### 報酬タイプ

| タイプ | 説明 |
|--------|------|
| role | Discord ロール付与 |
| custom | カスタム報酬（管理者手動対応） |
| lottery | 抽選型報酬 |
| external | 外部サービス連携（将来拡張） |

### 在庫管理

- `stock = -1`: 無制限
- `stock > 0`: 残り `stock - claimed` 個

## ポイント減衰（CP用）

ポイントシステム独自の減衰。RPの減衰とは別。

| 設定 | デフォルト | 説明 |
|------|-----------|------|
| decay_enabled | false | 有効/無効 |
| decay_type | percentage | `percentage` / `flat` |
| decay_amount | 5 | 減衰量（%またはpt） |
| decay_interval | 30 | 減衰間隔（日） |
| decay_min_points | 0 | 最低ポイント |
| expiry_enabled | false | 有効期限有無 |
| expiry_days | 90 | 失効日数 |

## トランザクション種別

| type | 説明 |
|------|------|
| earn | アクションで獲得 |
| transfer | P2P送金 |
| daily | デイリーボーナス |
| reward | 報酬交換 |
| gacha | ガチャ |
| coinflip | コインフリップ |
| admin | 管理者調整 |
| season_bonus | シーズンボーナス |

## Discord コマンド

| コマンド | 説明 |
|----------|------|
| `/balance [user]` | ポイント残高・ランク・統計 |
| `/history [count]` | 取引履歴（デフォルト10件） |
| `/actions` | 獲得可能なアクション一覧 |
| `/transfer @user amount` | ポイント送金 |
| `/pay @user amount` | ポイント支払い（transferのエイリアス） |
| `/daily` | デイリーボーナス取得 |
| `/ranking` | ポイントTOP10 |
| `/gacha` | ガチャを回す |
| `/coinflip amount` | コインフリップ |
