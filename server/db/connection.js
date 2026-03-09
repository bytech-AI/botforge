import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { mkdirSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const dbPath = join(__dirname, '..', '..', 'data', 'botforge.db')

let db

/**
 * データベースを初期化し、テーブル作成・マイグレーション・シードを実行する
 * @returns {Database} better-sqlite3のDBインスタンス
 */
export function initDatabase() {
  try {
    mkdirSync(join(__dirname, '..', '..', 'data'), { recursive: true })
  } catch { }

  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')

  db.exec(`
    CREATE TABLE IF NOT EXISTS bot_config (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS commands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT DEFAULT '',
      response_type TEXT DEFAULT 'text',
      response_text TEXT DEFAULT '',
      embed_title TEXT DEFAULT '',
      embed_description TEXT DEFAULT '',
      embed_color TEXT DEFAULT '#7c5cfc',
      ephemeral INTEGER DEFAULT 0,
      cooldown INTEGER DEFAULT 0,
      enabled INTEGER DEFAULT 1,
      options TEXT DEFAULT '[]',
      required_permissions TEXT DEFAULT '[]',
      allowed_roles TEXT DEFAULT '[]',
      random_responses TEXT DEFAULT '[]',
      dm_response INTEGER DEFAULT 0,
      is_builtin INTEGER DEFAULT 0,
      point_cost REAL DEFAULT 0,
      point_reward_min REAL DEFAULT 0,
      point_reward_max REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS gacha_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL DEFAULT 'デフォルトガチャ',
      cost INTEGER DEFAULT 100,
      enabled INTEGER DEFAULT 1,
      items TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS auto_responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL DEFAULT '__global__',
      trigger_text TEXT NOT NULL,
      match_type TEXT DEFAULT 'contains',
      response TEXT NOT NULL,
      channel_scope TEXT DEFAULT 'all',
      channel_id TEXT DEFAULT '',
      enabled INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS point_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      icon TEXT DEFAULT '⭐',
      points REAL DEFAULT 1,
      cooldown INTEGER DEFAULT 0,
      enabled INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS member_points (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      username TEXT DEFAULT '',
      display_name TEXT DEFAULT '',
      avatar TEXT DEFAULT '',
      total_points REAL DEFAULT 0,
      total_earned REAL DEFAULT 0,
      level INTEGER DEFAULT 1,
      messages INTEGER DEFAULT 0,
      reactions INTEGER DEFAULT 0,
      voice_minutes INTEGER DEFAULT 0,
      streak_days INTEGER DEFAULT 0,
      last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(guild_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS point_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      from_user_id TEXT,
      to_user_id TEXT NOT NULL,
      amount REAL NOT NULL,
      fee REAL DEFAULT 0,
      type TEXT NOT NULL,
      description TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS point_economy_settings (
      guild_id TEXT PRIMARY KEY,
      transfer_fee_percent REAL DEFAULT 5,
      min_transfer_amount REAL DEFAULT 10,
      daily_transfer_limit REAL DEFAULT 10000,
      daily_bonus_amount REAL DEFAULT 50,
      daily_bonus_streak_multiplier REAL DEFAULT 1.1,
      max_daily_bonus REAL DEFAULT 200,
      enabled INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS daily_claims (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      claimed_at DATE NOT NULL,
      amount REAL NOT NULL,
      streak INTEGER DEFAULT 1,
      UNIQUE(guild_id, user_id, claimed_at)
    );

    CREATE TABLE IF NOT EXISTS rewards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT DEFAULT 'role',
      icon TEXT DEFAULT '🎁',
      cost INTEGER DEFAULT 100,
      role_id TEXT DEFAULT '',
      description TEXT DEFAULT '',
      stock INTEGER DEFAULT -1,
      claimed INTEGER DEFAULT 0,
      enabled INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- === 6機能のバックエンドテーブル ===

    CREATE TABLE IF NOT EXISTS moderation_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL UNIQUE,
      ng_word_enabled INTEGER DEFAULT 1,
      ng_words TEXT DEFAULT '[]',
      action TEXT DEFAULT 'delete_warn',
      spam_enabled INTEGER DEFAULT 1,
      spam_threshold INTEGER DEFAULT 5,
      spam_time_window INTEGER DEFAULT 10,
      spam_action TEXT DEFAULT 'mute',
      link_filter_enabled INTEGER DEFAULT 0,
      link_whitelist TEXT DEFAULT '[]',
      caps_filter_enabled INTEGER DEFAULT 0,
      caps_threshold INTEGER DEFAULT 70,
      log_channel_id TEXT DEFAULT '',
      warning_limit INTEGER DEFAULT 3,
      warning_action TEXT DEFAULT 'kick',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS scheduled_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      name TEXT NOT NULL,
      message TEXT NOT NULL,
      channel_id TEXT DEFAULT '',
      time TEXT DEFAULT '12:00',
      days TEXT DEFAULT '[0,1,2,3,4,5,6]',
      timezone TEXT DEFAULT 'Asia/Tokyo',
      enabled INTEGER DEFAULT 1,
      last_run DATETIME DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS welcome_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL UNIQUE,
      welcome_enabled INTEGER DEFAULT 0,
      welcome_channel_id TEXT DEFAULT '',
      welcome_message TEXT DEFAULT '',
      welcome_embed_enabled INTEGER DEFAULT 0,
      welcome_embed_title TEXT DEFAULT '',
      welcome_embed_description TEXT DEFAULT '',
      welcome_embed_color TEXT DEFAULT '#7c5cfc',
      welcome_embed_thumbnail INTEGER DEFAULT 1,
      welcome_dm_enabled INTEGER DEFAULT 0,
      welcome_dm_message TEXT DEFAULT '',
      leave_enabled INTEGER DEFAULT 0,
      leave_channel_id TEXT DEFAULT '',
      leave_message TEXT DEFAULT '',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS embed_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      name TEXT NOT NULL,
      embed_data TEXT NOT NULL DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS channel_multipliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      multiplier REAL DEFAULT 1.0,
      UNIQUE(guild_id, channel_id)
    );

    CREATE TABLE IF NOT EXISTS point_decay_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL UNIQUE,
      decay_enabled INTEGER DEFAULT 0,
      decay_type TEXT DEFAULT 'percentage',
      decay_amount REAL DEFAULT 5,
      decay_interval INTEGER DEFAULT 30,
      decay_min_points INTEGER DEFAULT 0,
      expiry_enabled INTEGER DEFAULT 0,
      expiry_days INTEGER DEFAULT 90,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- === RPシステムテーブル ===

    CREATE TABLE IF NOT EXISTS rank_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      rank_key TEXT NOT NULL,
      rank_label TEXT NOT NULL,
      rank_order INTEGER NOT NULL,
      rp_threshold INTEGER NOT NULL,
      cp_multiplier REAL NOT NULL,
      color TEXT DEFAULT '#808080',
      icon TEXT DEFAULT '⭐',
      UNIQUE(guild_id, rank_key)
    );

    CREATE TABLE IF NOT EXISTS rank_settings (
      guild_id TEXT PRIMARY KEY,
      decay_rate REAL DEFAULT 0.02,
      decay_grace_days INTEGER DEFAULT 1,
      decay_floor INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS member_ranks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      current_rp INTEGER DEFAULT 0,
      current_rank_key TEXT DEFAULT 'c_minus',
      decay_exempt INTEGER DEFAULT 0,
      decay_exempt_until DATETIME DEFAULT NULL,
      last_recalculated DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(guild_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS rp_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      source TEXT NOT NULL,
      description TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_rp_tx_guild_user_date
      ON rp_transactions(guild_id, user_id, created_at);

    CREATE TABLE IF NOT EXISTS rp_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      action TEXT NOT NULL,
      label TEXT NOT NULL,
      icon TEXT DEFAULT '⭐',
      rp_amount INTEGER DEFAULT 10,
      cooldown INTEGER DEFAULT 0,
      enabled INTEGER DEFAULT 1,
      UNIQUE(guild_id, action)
    );

    CREATE TABLE IF NOT EXISTS season_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL UNIQUE,
      enabled INTEGER DEFAULT 1,
      cycle_type TEXT DEFAULT 'months',
      cycle_value INTEGER DEFAULT 3,
      start_date DATE NOT NULL DEFAULT (date('now')),
      bonus_distribution TEXT DEFAULT '{}',
      notify_channel_id TEXT DEFAULT '',
      last_season_end DATETIME DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS season_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      season_number INTEGER NOT NULL,
      season_start DATE NOT NULL,
      season_end DATE NOT NULL,
      results TEXT NOT NULL DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- === Cronロックテーブル（冪等性担保） ===

    CREATE TABLE IF NOT EXISTS cron_locks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_name TEXT NOT NULL,
      run_date TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(task_name, run_date)
    );
  `)

  // Migrations for existing DBs
  const migrations = [
    'ALTER TABLE member_points ADD COLUMN total_earned REAL DEFAULT 0',
    'ALTER TABLE commands ADD COLUMN is_builtin INTEGER DEFAULT 0',
    'ALTER TABLE commands ADD COLUMN point_cost REAL DEFAULT 0',
    'ALTER TABLE commands ADD COLUMN point_reward_min REAL DEFAULT 0',
    'ALTER TABLE commands ADD COLUMN point_reward_max REAL DEFAULT 0',
    "ALTER TABLE auto_responses ADD COLUMN guild_id TEXT NOT NULL DEFAULT '__global__'",
    'ALTER TABLE auto_responses ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP',
  ]
  for (const sql of migrations) {
    try { db.exec(sql) } catch { /* column already exists */ }
  }

  // Seed default gacha settings if empty
  const gachaCount = db.prepare('SELECT COUNT(*) as count FROM gacha_settings').get()
  if (gachaCount.count === 0) {
    db.prepare(`INSERT INTO gacha_settings (name, cost, items) VALUES (?, ?, ?)`).run(
      'デフォルトガチャ', 100,
      JSON.stringify([
        { name: 'ハズレ', emoji: '💨', points: 0, weight: 40 },
        { name: 'ブロンズ', emoji: '🥉', points: 50, weight: 30 },
        { name: 'シルバー', emoji: '🥈', points: 150, weight: 18 },
        { name: 'ゴールド', emoji: '🥇', points: 300, weight: 8 },
        { name: 'ダイヤモンド', emoji: '💎', points: 500, weight: 3 },
        { name: '伝説', emoji: '🐉', points: 1000, weight: 1 },
      ])
    )
  }

  // Seed default point rules if table is empty
  const ruleCount = db.prepare('SELECT COUNT(*) as count FROM point_rules').get()
  if (ruleCount.count === 0) {
    const defaultRules = [
      ['message', 'メッセージ送信', '💬', 1, 60, 1],
      ['reaction_give', 'リアクション付与', '👍', 0.5, 0, 1],
      ['reaction_receive', 'リアクション受信', '⭐', 1, 0, 1],
      ['voice_join', 'ボイス参加（/分）', '🎤', 0.1, 0, 1],
      ['invite', '招待成功', '📨', 10, 0, 0],
      ['thread_create', 'スレッド作成', '🧵', 3, 300, 0],
    ]
    const stmt = db.prepare('INSERT INTO point_rules (action, label, icon, points, cooldown, enabled) VALUES (?, ?, ?, ?, ?, ?)')
    for (const rule of defaultRules) {
      stmt.run(...rule)
    }
  }

  return db
}

/**
 * DBインスタンスを取得する
 * @returns {Database} better-sqlite3のDBインスタンス
 */
export function getDb() {
  return db
}

/**
 * cronジョブのロックを取得する（冪等性担保）
 * @param {string} taskName - タスク名
 * @returns {boolean} ロック取得成功ならtrue（=今日まだ実行していない）
 */
export function acquireCronLock(taskName) {
  const today = new Date().toISOString().split('T')[0]
  try {
    db.prepare('INSERT INTO cron_locks (task_name, run_date) VALUES (?, ?)').run(taskName, today)
    return true
  } catch {
    // UNIQUE制約違反 = 今日は既に実行済み
    return false
  }
}

/**
 * 古いcronロックをクリーンアップする（7日以上前のロック）
 */
export function cleanupCronLocks() {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 7)
  db.prepare('DELETE FROM cron_locks WHERE run_date < ?').run(cutoff.toISOString().split('T')[0])
}
