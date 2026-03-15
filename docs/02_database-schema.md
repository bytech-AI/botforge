# BotForge データベーススキーマ仕様書

## 概要

- **エンジン:** SQLite 3 (better-sqlite3)
- **ファイル:** `data/botforge.db`
- **モード:** WAL (Write-Ahead Logging)
- **命名規則:** `snake_case`（JS側で `camelCase` にデシリアライズ）
- **JSON格納:** TEXT型カラムにJSON.stringify して保存

## マイグレーション方式

`initDatabase()` 内で `ALTER TABLE ADD COLUMN` を実行。既にカラムが存在する場合はエラーを無視。破壊的変更はなし。

---

## テーブル一覧

### bot_config
| カラム | 型 | デフォルト | 説明 |
|--------|-----|-----------|------|
| key | TEXT PK | | 設定キー |
| value | TEXT | | 設定値 |

### commands（スラッシュコマンド）
| カラム | 型 | デフォルト | 説明 |
|--------|-----|-----------|------|
| id | INTEGER PK | AUTO | |
| name | TEXT NOT NULL UNIQUE | | コマンド名 |
| description | TEXT | `''` | 説明文 |
| response_type | TEXT | `'text'` | `text` / `embed` / `random` |
| response_text | TEXT | `''` | テキスト応答 |
| embed_title | TEXT | `''` | Embed タイトル |
| embed_description | TEXT | `''` | Embed 説明 |
| embed_color | TEXT | `'#7c5cfc'` | Embed カラー |
| ephemeral | INTEGER | `0` | 本人のみ表示 |
| cooldown | INTEGER | `0` | クールダウン（秒） |
| enabled | INTEGER | `1` | 有効/無効 |
| options | TEXT | `'[]'` | JSON: コマンドオプション |
| required_permissions | TEXT | `'[]'` | JSON: 必要権限 |
| allowed_roles | TEXT | `'[]'` | JSON: 許可ロール |
| random_responses | TEXT | `'[]'` | JSON: ランダム応答リスト |
| dm_response | INTEGER | `0` | DM で返信 |
| is_builtin | INTEGER | `0` | ビルトインコマンド |
| point_cost | REAL | `0` | ポイントコスト |
| point_reward_min | REAL | `0` | ポイント報酬（最小） |
| point_reward_max | REAL | `0` | ポイント報酬（最大） |
| created_at | DATETIME | CURRENT_TIMESTAMP | |
| updated_at | DATETIME | CURRENT_TIMESTAMP | |

### gacha_settings（ガチャ設定）
| カラム | 型 | デフォルト | 説明 |
|--------|-----|-----------|------|
| id | INTEGER PK | AUTO | |
| name | TEXT | `'デフォルトガチャ'` | ガチャ名 |
| cost | INTEGER | `100` | 1回あたりコスト |
| enabled | INTEGER | `1` | 有効/無効 |
| items | TEXT | `'[]'` | JSON: `[{name, emoji, points, weight}]` |
| created_at | DATETIME | CURRENT_TIMESTAMP | |

### auto_responses（自動応答）
| カラム | 型 | デフォルト | 説明 |
|--------|-----|-----------|------|
| id | INTEGER PK | AUTO | |
| guild_id | TEXT | `'__global__'` | ギルドID（グローバルは `__global__`） |
| trigger_text | TEXT NOT NULL | | トリガー文字列 |
| match_type | TEXT | `'contains'` | `contains` / `exact` / `startsWith` / `regex` |
| response | TEXT NOT NULL | | 応答テキスト |
| channel_scope | TEXT | `'all'` | `all` / `specific` |
| channel_id | TEXT | `''` | 対象チャンネルID |
| enabled | INTEGER | `1` | |
| created_at | DATETIME | CURRENT_TIMESTAMP | |
| updated_at | DATETIME | CURRENT_TIMESTAMP | |

### point_rules（ポイント獲得ルール）
| カラム | 型 | デフォルト | 説明 |
|--------|-----|-----------|------|
| id | INTEGER PK | AUTO | |
| action | TEXT NOT NULL UNIQUE | | アクション名 |
| label | TEXT NOT NULL | | 表示ラベル |
| icon | TEXT | `'⭐'` | 絵文字アイコン |
| points | REAL | `1` | 獲得ポイント |
| cooldown | INTEGER | `0` | クールダウン（秒） |
| enabled | INTEGER | `1` | |

**デフォルトシード:**
| action | label | points | cooldown |
|--------|-------|--------|----------|
| message | メッセージ送信 | 1 | 60 |
| reaction_give | リアクション付与 | 0.5 | 0 |
| reaction_receive | リアクション受信 | 1 | 0 |
| voice_join | ボイス参加（/分） | 0.1 | 0 |
| invite | 招待成功 | 10 | 0 |
| thread_create | スレッド作成 | 3 | 300 |

### member_points（メンバーポイント）
| カラム | 型 | デフォルト | 説明 |
|--------|-----|-----------|------|
| id | INTEGER PK | AUTO | |
| guild_id | TEXT NOT NULL | | |
| user_id | TEXT NOT NULL | | |
| username | TEXT | `''` | |
| display_name | TEXT | `''` | |
| avatar | TEXT | `''` | |
| total_points | REAL | `0` | 現在のポイント残高 |
| total_earned | REAL | `0` | 累計獲得ポイント |
| level | INTEGER | `1` | `floor(sqrt(total_earned/1.5))+1` |
| messages | INTEGER | `0` | メッセージ数 |
| reactions | INTEGER | `0` | リアクション数 |
| voice_minutes | INTEGER | `0` | ボイス参加分数 |
| streak_days | INTEGER | `0` | 連続ログイン日数 |
| last_active | DATETIME | CURRENT_TIMESTAMP | 最終活動日時 |
| created_at | DATETIME | CURRENT_TIMESTAMP | |
| **UNIQUE** | (guild_id, user_id) | | |

### point_transactions（ポイント取引履歴）
| カラム | 型 | デフォルト | 説明 |
|--------|-----|-----------|------|
| id | INTEGER PK | AUTO | |
| guild_id | TEXT NOT NULL | | |
| from_user_id | TEXT | | 送金元（NULL = システム） |
| to_user_id | TEXT NOT NULL | | 送金先 |
| amount | REAL NOT NULL | | 金額 |
| fee | REAL | `0` | 手数料 |
| type | TEXT NOT NULL | | `earn` / `transfer` / `daily` / `reward` / `season_bonus` |
| description | TEXT | `''` | 説明 |
| created_at | DATETIME | CURRENT_TIMESTAMP | |

### point_economy_settings（経済設定）
| カラム | 型 | デフォルト | 説明 |
|--------|-----|-----------|------|
| guild_id | TEXT PK | | |
| transfer_fee_percent | REAL | `0` | 送金手数料率(%) |
| min_transfer_amount | REAL | `10` | 最小送金額 |
| daily_transfer_limit | REAL | `10000` | 1日送金上限 |
| daily_bonus_amount | REAL | `50` | デイリーボーナス額 |
| daily_bonus_streak_multiplier | REAL | `1.1` | 連続ログイン倍率 |
| max_daily_bonus | REAL | `200` | デイリーボーナス上限 |
| enabled | INTEGER | `1` | |

### daily_claims（デイリーボーナス記録）
| カラム | 型 | デフォルト | 説明 |
|--------|-----|-----------|------|
| id | INTEGER PK | AUTO | |
| guild_id | TEXT NOT NULL | | |
| user_id | TEXT NOT NULL | | |
| claimed_at | DATE NOT NULL | | 取得日 |
| amount | REAL NOT NULL | | 取得額 |
| streak | INTEGER | `1` | 連続日数 |
| **UNIQUE** | (guild_id, user_id, claimed_at) | | |

### rewards（報酬ショップ）
| カラム | 型 | デフォルト | 説明 |
|--------|-----|-----------|------|
| id | INTEGER PK | AUTO | |
| name | TEXT NOT NULL | | 報酬名 |
| type | TEXT | `'role'` | `role` / `custom` / `lottery` / `external` |
| icon | TEXT | `'🎁'` | |
| cost | INTEGER | `100` | 必要ポイント |
| role_id | TEXT | `''` | 付与するロールID |
| description | TEXT | `''` | 説明 |
| stock | INTEGER | `-1` | 在庫数（-1=無限） |
| claimed | INTEGER | `0` | 交換済み数 |
| enabled | INTEGER | `1` | |
| created_at | DATETIME | CURRENT_TIMESTAMP | |

### moderation_settings（モデレーション設定）
| カラム | 型 | デフォルト | 説明 |
|--------|-----|-----------|------|
| id | INTEGER PK | AUTO | |
| guild_id | TEXT NOT NULL UNIQUE | | |
| ng_word_enabled | INTEGER | `1` | NGワードフィルター |
| ng_words | TEXT | `'[]'` | JSON: NGワードリスト |
| action | TEXT | `'delete_warn'` | アクション |
| spam_enabled | INTEGER | `1` | スパム検出 |
| spam_threshold | INTEGER | `5` | メッセージ数閾値 |
| spam_time_window | INTEGER | `10` | 検出時間窓（秒） |
| spam_action | TEXT | `'mute'` | スパム時アクション |
| link_filter_enabled | INTEGER | `0` | リンクフィルター |
| link_whitelist | TEXT | `'[]'` | JSON: 許可ドメイン |
| caps_filter_enabled | INTEGER | `0` | 大文字フィルター |
| caps_threshold | INTEGER | `70` | 大文字率閾値(%) |
| log_channel_id | TEXT | `''` | ログチャンネル |
| warning_limit | INTEGER | `3` | 警告上限 |
| warning_action | TEXT | `'kick'` | 上限時アクション |
| updated_at | DATETIME | CURRENT_TIMESTAMP | |

### scheduled_messages（定時メッセージ）
| カラム | 型 | デフォルト | 説明 |
|--------|-----|-----------|------|
| id | INTEGER PK | AUTO | |
| guild_id | TEXT NOT NULL | | |
| name | TEXT NOT NULL | | 名前 |
| message | TEXT NOT NULL | | メッセージ本文 |
| channel_id | TEXT | `''` | 送信先チャンネル |
| time | TEXT | `'12:00'` | 送信時刻 (HH:MM) |
| days | TEXT | `'[0,1,2,3,4,5,6]'` | JSON: 曜日（0=月〜6=日） |
| timezone | TEXT | `'Asia/Tokyo'` | タイムゾーン |
| enabled | INTEGER | `1` | |
| last_run | DATETIME | NULL | 最終実行日時 |
| created_at | DATETIME | CURRENT_TIMESTAMP | |
| updated_at | DATETIME | CURRENT_TIMESTAMP | |

### welcome_settings（入退室メッセージ）
| カラム | 型 | デフォルト | 説明 |
|--------|-----|-----------|------|
| id | INTEGER PK | AUTO | |
| guild_id | TEXT NOT NULL UNIQUE | | |
| welcome_enabled | INTEGER | `0` | 入室通知 |
| welcome_channel_id | TEXT | `''` | 入室チャンネル |
| welcome_message | TEXT | `''` | 入室メッセージ |
| welcome_embed_enabled | INTEGER | `0` | Embed使用 |
| welcome_embed_title | TEXT | `''` | Embed タイトル |
| welcome_embed_description | TEXT | `''` | Embed 説明 |
| welcome_embed_color | TEXT | `'#7c5cfc'` | Embed カラー |
| welcome_embed_thumbnail | INTEGER | `1` | アバターサムネイル |
| welcome_dm_enabled | INTEGER | `0` | DM送信 |
| welcome_dm_message | TEXT | `''` | DMメッセージ |
| leave_enabled | INTEGER | `0` | 退室通知 |
| leave_channel_id | TEXT | `''` | 退室チャンネル |
| leave_message | TEXT | `''` | 退室メッセージ |
| updated_at | DATETIME | CURRENT_TIMESTAMP | |

### embed_templates（Embedテンプレート）
| カラム | 型 | デフォルト | 説明 |
|--------|-----|-----------|------|
| id | INTEGER PK | AUTO | |
| guild_id | TEXT NOT NULL | | |
| name | TEXT NOT NULL | | テンプレート名 |
| embed_data | TEXT | `'{}'` | JSON: Embedデータ |
| created_at | DATETIME | CURRENT_TIMESTAMP | |
| updated_at | DATETIME | CURRENT_TIMESTAMP | |

### channel_multipliers（チャンネル倍率）
| カラム | 型 | デフォルト | 説明 |
|--------|-----|-----------|------|
| id | INTEGER PK | AUTO | |
| guild_id | TEXT NOT NULL | | |
| channel_id | TEXT NOT NULL | | |
| multiplier | REAL | `1.0` | ポイント倍率 |
| **UNIQUE** | (guild_id, channel_id) | | |

### point_decay_settings（ポイント減衰設定）
| カラム | 型 | デフォルト | 説明 |
|--------|-----|-----------|------|
| id | INTEGER PK | AUTO | |
| guild_id | TEXT NOT NULL UNIQUE | | |
| decay_enabled | INTEGER | `0` | 減衰有効 |
| decay_type | TEXT | `'percentage'` | `percentage` / `flat` |
| decay_amount | REAL | `5` | 減衰量（%またはpt） |
| decay_interval | INTEGER | `30` | 減衰間隔（日） |
| decay_min_points | INTEGER | `0` | 最低ポイント |
| expiry_enabled | INTEGER | `0` | 有効期限 |
| expiry_days | INTEGER | `90` | 失効日数 |
| updated_at | DATETIME | CURRENT_TIMESTAMP | |

---

## RP ランクシステム テーブル

### rank_config（ランク設定）
| カラム | 型 | デフォルト | 説明 |
|--------|-----|-----------|------|
| id | INTEGER PK | AUTO | |
| guild_id | TEXT NOT NULL | | |
| rank_key | TEXT NOT NULL | | ランクキー（`c_minus`〜`x`） |
| rank_label | TEXT NOT NULL | | 表示名（`C-`〜`X`） |
| rank_order | INTEGER NOT NULL | | 順序（0〜12） |
| rp_threshold | INTEGER | `0` | 累積RP閾値 |
| cp_multiplier | REAL NOT NULL | | CP倍率 |
| color | TEXT | `'#808080'` | 表示カラー |
| icon | TEXT | `'⭐'` | 絵文字アイコン |
| **UNIQUE** | (guild_id, rank_key) | | |

**デフォルト13段階:**
| rank_key | label | threshold | CP倍率 |
|----------|-------|-----------|--------|
| c_minus | C- | 0 | 0.30 |
| c | C | 500 | 0.40 |
| c_plus | C+ | 1,200 | 0.50 |
| b_minus | B- | 2,500 | 0.60 |
| b | B | 4,000 | 0.70 |
| b_plus | B+ | 6,000 | 0.80 |
| a_minus | A- | 9,000 | 0.90 |
| a | A | 13,000 | 1.00 |
| a_plus | A+ | 18,000 | 1.10 |
| s_minus | S- | 25,000 | 1.20 |
| s | S | 33,000 | 1.30 |
| s_plus | S+ | 42,000 | 1.40 |
| x | X | 60,000 | 1.75 |

### x_rank_config（Xランク専用設定）
| カラム | 型 | デフォルト | 説明 |
|--------|-----|-----------|------|
| guild_id | TEXT PK | | |
| max_rp | INTEGER | `3000` | Xランク内パワー上限 |
| entry_rp | INTEGER | `1000` | X昇格時の初期パワー |
| demotion_threshold | INTEGER | `0` | 降格閾値（この値以下でS+へ） |
| tiers | TEXT | `'[]'` | JSON: サブティア設定 |

**tiersフォーマット:**
```json
[
  { "min": 0, "max": 999, "cp_multiplier": 1.6, "label": "X-I" },
  { "min": 1000, "max": 1999, "cp_multiplier": 1.7, "label": "X-II" },
  { "min": 2000, "max": 3000, "cp_multiplier": 1.8, "label": "X-III" }
]
```

### rank_settings（減衰設定）
| カラム | 型 | デフォルト | 説明 |
|--------|-----|-----------|------|
| guild_id | TEXT PK | | |
| decay_rate | REAL | `0.02` | 減衰率（2%） |
| decay_grace_days | INTEGER | `5` | 猶予日数 |
| decay_floor | INTEGER | `0` | RP下限 |

### member_ranks（メンバーランク）
| カラム | 型 | デフォルト | 説明 |
|--------|-----|-----------|------|
| id | INTEGER PK | AUTO | |
| guild_id | TEXT NOT NULL | | |
| user_id | TEXT NOT NULL | | |
| current_rp | INTEGER | `0` | 累積RP |
| current_rank_key | TEXT | `'c_minus'` | 現在ランクキー |
| x_rp | INTEGER | `NULL` | Xランク内パワー（非Xの場合NULL） |
| decay_exempt | INTEGER | `0` | 減衰免除フラグ |
| decay_exempt_until | DATETIME | NULL | 免除期限 |
| last_recalculated | DATETIME | CURRENT_TIMESTAMP | 最終再計算日時 |
| **UNIQUE** | (guild_id, user_id) | | |

### rp_transactions（RPトランザクション）
| カラム | 型 | デフォルト | 説明 |
|--------|-----|-----------|------|
| id | INTEGER PK | AUTO | |
| guild_id | TEXT NOT NULL | | |
| user_id | TEXT NOT NULL | | |
| amount | INTEGER NOT NULL | | RP変動量 |
| source | TEXT NOT NULL | | 獲得元（`message`, `voice_join`, `admin` 等） |
| description | TEXT | `''` | 説明 |
| created_at | DATETIME | CURRENT_TIMESTAMP | |

**インデックス:** `idx_rp_tx_guild_user_date` ON (guild_id, user_id, created_at)

### rp_rules（RP獲得ルール）
| カラム | 型 | デフォルト | 説明 |
|--------|-----|-----------|------|
| id | INTEGER PK | AUTO | |
| guild_id | TEXT NOT NULL | | |
| action | TEXT NOT NULL | | アクション名 |
| label | TEXT NOT NULL | | 表示ラベル |
| icon | TEXT | `'⭐'` | |
| rp_amount | INTEGER | `10` | 獲得RP |
| cooldown | INTEGER | `0` | クールダウン（秒） |
| daily_cap | INTEGER | `0` | 日次上限（0=無制限） |
| enabled | INTEGER | `1` | |
| **UNIQUE** | (guild_id, action) | | |

**デフォルトシード:**
| action | label | rp_amount | cooldown | daily_cap |
|--------|-------|-----------|----------|-----------|
| message | メッセージ送信 | 5 | 60 | 0 |
| reaction_receive | リアクション受信 | 3 | 0 | 0 |
| voice_join | ボイス参加（/分） | 1 | 0 | 60 |
| thread_create | スレッド作成 | 10 | 300 | 0 |
| contest_participate | コンテスト参加 | 100 | 0 | 0 |

### season_config（シーズン設定）
| カラム | 型 | デフォルト | 説明 |
|--------|-----|-----------|------|
| id | INTEGER PK | AUTO | |
| guild_id | TEXT NOT NULL UNIQUE | | |
| enabled | INTEGER | `1` | |
| cycle_type | TEXT | `'months'` | `months` / `days` |
| cycle_value | INTEGER | `1` | 周期値 |
| start_date | DATE | `date('now')` | 起算日 |
| bonus_distribution | TEXT | `'{}'` | JSON: ボーナス配分 |
| notify_channel_id | TEXT | `''` | 通知チャンネル |
| last_season_end | DATETIME | NULL | 最終シーズン終了日時 |

### season_history（シーズン履歴）
| カラム | 型 | デフォルト | 説明 |
|--------|-----|-----------|------|
| id | INTEGER PK | AUTO | |
| guild_id | TEXT NOT NULL | | |
| season_number | INTEGER NOT NULL | | シーズン番号 |
| season_start | DATE NOT NULL | | 開始日 |
| season_end | DATE NOT NULL | | 終了日 |
| results | TEXT | `'[]'` | JSON: 結果データ |
| created_at | DATETIME | CURRENT_TIMESTAMP | |

### cron_locks（Cronロック）
| カラム | 型 | デフォルト | 説明 |
|--------|-----|-----------|------|
| id | INTEGER PK | AUTO | |
| task_name | TEXT NOT NULL | | タスク名 |
| run_date | TEXT NOT NULL | | 実行日 (YYYY-MM-DD) |
| created_at | DATETIME | CURRENT_TIMESTAMP | |
| **UNIQUE** | (task_name, run_date) | | |
