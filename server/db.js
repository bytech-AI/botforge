import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { mkdirSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const dbPath = join(__dirname, '..', 'data', 'botforge.db')

let db

export function initDatabase() {
  try {
    mkdirSync(join(__dirname, '..', 'data'), { recursive: true })
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

export function getDb() {
  return db
}

// ============================
// Auto Response DB Helpers
// ============================

export function getAllAutoResponses(guildId) {
  return db.prepare('SELECT * FROM auto_responses WHERE guild_id = ? ORDER BY id ASC').all(guildId || '__global__')
    .map(r => ({ ...r, enabled: !!r.enabled }))
}

export function getAutoResponsesGlobal() {
  return db.prepare('SELECT * FROM auto_responses ORDER BY id ASC').all()
    .map(r => ({ ...r, enabled: !!r.enabled }))
}

export function createAutoResponse(data) {
  const guildId = data.guildId || '__global__'
  const result = db.prepare(`INSERT INTO auto_responses (guild_id, trigger_text, match_type, response, channel_scope, channel_id, enabled)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    guildId, data.trigger, data.matchType || 'contains', data.response,
    data.channel || 'all', data.channelId || '', data.enabled !== false ? 1 : 0
  )
  return db.prepare('SELECT * FROM auto_responses WHERE id = ?').get(result.lastInsertRowid)
}

export function updateAutoResponse(id, data) {
  db.prepare(`UPDATE auto_responses SET trigger_text = ?, match_type = ?, response = ?,
    channel_scope = ?, channel_id = ?, enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(
    data.trigger, data.matchType || 'contains', data.response,
    data.channel || 'all', data.channelId || '', data.enabled !== false ? 1 : 0, id
  )
}

export function deleteAutoResponse(id) {
  db.prepare('DELETE FROM auto_responses WHERE id = ?').run(id)
}

// ============================
// Moderation Settings DB Helpers
// ============================

export function getModerationSettings(guildId) {
  let settings = db.prepare('SELECT * FROM moderation_settings WHERE guild_id = ?').get(guildId)
  if (!settings) {
    db.prepare('INSERT INTO moderation_settings (guild_id) VALUES (?)').run(guildId)
    settings = db.prepare('SELECT * FROM moderation_settings WHERE guild_id = ?').get(guildId)
  }
  return {
    ...settings,
    ngWordEnabled: !!settings.ng_word_enabled,
    ngWords: JSON.parse(settings.ng_words || '[]'),
    action: settings.action,
    spamEnabled: !!settings.spam_enabled,
    spamThreshold: settings.spam_threshold,
    spamTimeWindow: settings.spam_time_window,
    spamAction: settings.spam_action,
    linkFilterEnabled: !!settings.link_filter_enabled,
    linkWhitelist: JSON.parse(settings.link_whitelist || '[]'),
    capsFilterEnabled: !!settings.caps_filter_enabled,
    capsThreshold: settings.caps_threshold,
    logChannelId: settings.log_channel_id,
    warningLimit: settings.warning_limit,
    warningAction: settings.warning_action,
  }
}

export function updateModerationSettings(guildId, s) {
  db.prepare(`UPDATE moderation_settings SET
    ng_word_enabled = ?, ng_words = ?, action = ?,
    spam_enabled = ?, spam_threshold = ?, spam_time_window = ?, spam_action = ?,
    link_filter_enabled = ?, link_whitelist = ?,
    caps_filter_enabled = ?, caps_threshold = ?,
    log_channel_id = ?, warning_limit = ?, warning_action = ?,
    updated_at = CURRENT_TIMESTAMP WHERE guild_id = ?`).run(
    s.ngWordEnabled ? 1 : 0, JSON.stringify(s.ngWords || []), s.action || 'delete_warn',
    s.spamEnabled ? 1 : 0, s.spamThreshold || 5, s.spamTimeWindow || 10, s.spamAction || 'mute',
    s.linkFilterEnabled ? 1 : 0, JSON.stringify(s.linkWhitelist || []),
    s.capsFilterEnabled ? 1 : 0, s.capsThreshold || 70,
    s.logChannelId || '', s.warningLimit || 3, s.warningAction || 'kick',
    guildId
  )
}

// ============================
// Scheduled Messages DB Helpers
// ============================

export function getAllScheduledMessages(guildId) {
  return db.prepare('SELECT * FROM scheduled_messages WHERE guild_id = ? ORDER BY id ASC').all(guildId)
    .map(s => ({ ...s, enabled: !!s.enabled, days: JSON.parse(s.days || '[]') }))
}

export function createScheduledMessage(data) {
  const result = db.prepare(`INSERT INTO scheduled_messages (guild_id, name, message, channel_id, time, days, timezone, enabled)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    data.guildId, data.name, data.message, data.channelId || '',
    data.time || '12:00', JSON.stringify(data.days || []), data.timezone || 'Asia/Tokyo',
    data.enabled !== false ? 1 : 0
  )
  const row = db.prepare('SELECT * FROM scheduled_messages WHERE id = ?').get(result.lastInsertRowid)
  return { ...row, enabled: !!row.enabled, days: JSON.parse(row.days || '[]') }
}

export function updateScheduledMessage(id, data) {
  db.prepare(`UPDATE scheduled_messages SET name = ?, message = ?, channel_id = ?,
    time = ?, days = ?, timezone = ?, enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(
    data.name, data.message, data.channelId || '',
    data.time || '12:00', JSON.stringify(data.days || []), data.timezone || 'Asia/Tokyo',
    data.enabled !== false ? 1 : 0, id
  )
}

export function deleteScheduledMessage(id) {
  db.prepare('DELETE FROM scheduled_messages WHERE id = ?').run(id)
}

// ============================
// Welcome Settings DB Helpers
// ============================

export function getWelcomeSettings(guildId) {
  let settings = db.prepare('SELECT * FROM welcome_settings WHERE guild_id = ?').get(guildId)
  if (!settings) {
    db.prepare('INSERT INTO welcome_settings (guild_id) VALUES (?)').run(guildId)
    settings = db.prepare('SELECT * FROM welcome_settings WHERE guild_id = ?').get(guildId)
  }
  return {
    welcome: {
      enabled: !!settings.welcome_enabled,
      channelId: settings.welcome_channel_id || '',
      message: settings.welcome_message || '',
      embedEnabled: !!settings.welcome_embed_enabled,
      embedTitle: settings.welcome_embed_title || '',
      embedDescription: settings.welcome_embed_description || '',
      embedColor: settings.welcome_embed_color || '#7c5cfc',
      embedThumbnail: !!settings.welcome_embed_thumbnail,
      dmEnabled: !!settings.welcome_dm_enabled,
      dmMessage: settings.welcome_dm_message || '',
    },
    leave: {
      enabled: !!settings.leave_enabled,
      channelId: settings.leave_channel_id || '',
      message: settings.leave_message || '',
    }
  }
}

export function updateWelcomeSettings(guildId, data) {
  const w = data.welcome || {}
  const l = data.leave || {}
  db.prepare(`UPDATE welcome_settings SET
    welcome_enabled = ?, welcome_channel_id = ?, welcome_message = ?,
    welcome_embed_enabled = ?, welcome_embed_title = ?, welcome_embed_description = ?,
    welcome_embed_color = ?, welcome_embed_thumbnail = ?,
    welcome_dm_enabled = ?, welcome_dm_message = ?,
    leave_enabled = ?, leave_channel_id = ?, leave_message = ?,
    updated_at = CURRENT_TIMESTAMP WHERE guild_id = ?`).run(
    w.enabled ? 1 : 0, w.channelId || '', w.message || '',
    w.embedEnabled ? 1 : 0, w.embedTitle || '', w.embedDescription || '',
    w.embedColor || '#7c5cfc', w.embedThumbnail !== false ? 1 : 0,
    w.dmEnabled ? 1 : 0, w.dmMessage || '',
    l.enabled ? 1 : 0, l.channelId || '', l.message || '',
    guildId
  )
}

// ============================
// Embed Templates DB Helpers
// ============================

export function getAllEmbedTemplates(guildId) {
  return db.prepare('SELECT * FROM embed_templates WHERE guild_id = ? ORDER BY id DESC').all(guildId)
    .map(t => ({ ...t, embedData: JSON.parse(t.embed_data || '{}') }))
}

export function createEmbedTemplate(data) {
  const result = db.prepare(`INSERT INTO embed_templates (guild_id, name, embed_data) VALUES (?, ?, ?)`)
    .run(data.guildId, data.name, JSON.stringify(data.embedData || {}))
  const row = db.prepare('SELECT * FROM embed_templates WHERE id = ?').get(result.lastInsertRowid)
  return { ...row, embedData: JSON.parse(row.embed_data || '{}') }
}

export function updateEmbedTemplate(id, data) {
  db.prepare(`UPDATE embed_templates SET name = ?, embed_data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .run(data.name, JSON.stringify(data.embedData || {}), id)
}

export function deleteEmbedTemplate(id) {
  db.prepare('DELETE FROM embed_templates WHERE id = ?').run(id)
}

// ============================
// Channel Multipliers DB Helpers
// ============================

export function getChannelMultipliers(guildId) {
  return db.prepare('SELECT * FROM channel_multipliers WHERE guild_id = ? ORDER BY id ASC').all(guildId)
}

export function updateChannelMultipliers(guildId, multipliers) {
  const del = db.prepare('DELETE FROM channel_multipliers WHERE guild_id = ?')
  const ins = db.prepare('INSERT INTO channel_multipliers (guild_id, channel_id, multiplier) VALUES (?, ?, ?)')
  const tx = db.transaction(() => {
    del.run(guildId)
    for (const m of multipliers) {
      ins.run(guildId, m.channelId, m.multiplier ?? 1.0)
    }
  })
  tx()
}

export function getChannelMultiplier(guildId, channelId) {
  const row = db.prepare('SELECT multiplier FROM channel_multipliers WHERE guild_id = ? AND channel_id = ?').get(guildId, channelId)
  return row ? row.multiplier : 1.0
}

// ============================
// Point Decay Settings DB Helpers
// ============================

export function getPointDecaySettings(guildId) {
  let settings = db.prepare('SELECT * FROM point_decay_settings WHERE guild_id = ?').get(guildId)
  if (!settings) {
    db.prepare('INSERT INTO point_decay_settings (guild_id) VALUES (?)').run(guildId)
    settings = db.prepare('SELECT * FROM point_decay_settings WHERE guild_id = ?').get(guildId)
  }
  return {
    decay: {
      enabled: !!settings.decay_enabled,
      type: settings.decay_type || 'percentage',
      amount: settings.decay_amount || 5,
      interval: settings.decay_interval || 30,
      minPoints: settings.decay_min_points || 0,
    },
    expiry: {
      enabled: !!settings.expiry_enabled,
      days: settings.expiry_days || 90,
    }
  }
}

export function updatePointDecaySettings(guildId, data) {
  const d = data.decay || {}
  const e = data.expiry || {}
  db.prepare(`UPDATE point_decay_settings SET
    decay_enabled = ?, decay_type = ?, decay_amount = ?, decay_interval = ?, decay_min_points = ?,
    expiry_enabled = ?, expiry_days = ?, updated_at = CURRENT_TIMESTAMP WHERE guild_id = ?`).run(
    d.enabled ? 1 : 0, d.type || 'percentage', d.amount || 5, d.interval || 30, d.minPoints || 0,
    e.enabled ? 1 : 0, e.days || 90, guildId
  )
}

// ============================
// RP (Rank Point) System
// ============================

/** ランク設定のデフォルトシード */
const DEFAULT_RANK_CONFIG = [
  { rank_key: 'c_minus', rank_label: 'C-', rank_order: 0, rp_threshold: 0, cp_multiplier: 0.3, color: '#808080', icon: '🌱' },
  { rank_key: 'c', rank_label: 'C', rank_order: 1, rp_threshold: 500, cp_multiplier: 0.4, color: '#8B8B8B', icon: '🌿' },
  { rank_key: 'c_plus', rank_label: 'C+', rank_order: 2, rp_threshold: 1200, cp_multiplier: 0.5, color: '#969696', icon: '🍀' },
  { rank_key: 'b_minus', rank_label: 'B-', rank_order: 3, rp_threshold: 2500, cp_multiplier: 0.6, color: '#4A9BD9', icon: '🔵' },
  { rank_key: 'b', rank_label: 'B', rank_order: 4, rp_threshold: 4000, cp_multiplier: 0.8, color: '#3D8BC9', icon: '💎' },
  { rank_key: 'b_plus', rank_label: 'B+', rank_order: 5, rp_threshold: 6000, cp_multiplier: 1.0, color: '#2E7AB8', icon: '💠' },
  { rank_key: 'a_minus', rank_label: 'A-', rank_order: 6, rp_threshold: 9000, cp_multiplier: 1.2, color: '#9B59B6', icon: '🔮' },
  { rank_key: 'a', rank_label: 'A', rank_order: 7, rp_threshold: 13000, cp_multiplier: 1.4, color: '#8E44AD', icon: '⚡' },
  { rank_key: 'a_plus', rank_label: 'A+', rank_order: 8, rp_threshold: 18000, cp_multiplier: 1.6, color: '#7D3C98', icon: '🌟' },
  { rank_key: 's_minus', rank_label: 'S-', rank_order: 9, rp_threshold: 25000, cp_multiplier: 1.8, color: '#F39C12', icon: '🏅' },
  { rank_key: 's', rank_label: 'S', rank_order: 10, rp_threshold: 33000, cp_multiplier: 1.9, color: '#E67E22', icon: '👑' },
  { rank_key: 's_plus', rank_label: 'S+', rank_order: 11, rp_threshold: 42000, cp_multiplier: 2.0, color: '#E74C3C', icon: '🐉' },
  { rank_key: 'x', rank_label: 'X', rank_order: 12, rp_threshold: 60000, cp_multiplier: 2.5, color: '#FF0000', icon: '✦' },
]

/** RPルールのデフォルトシード */
const DEFAULT_RP_RULES = [
  { action: 'message', label: 'メッセージ送信', icon: '💬', rp_amount: 10, cooldown: 60 },
  { action: 'reaction_give', label: 'リアクション付与', icon: '👍', rp_amount: 5, cooldown: 0 },
  { action: 'reaction_receive', label: 'リアクション受信', icon: '⭐', rp_amount: 8, cooldown: 0 },
  { action: 'voice_join', label: 'ボイス参加（/分）', icon: '🎤', rp_amount: 3, cooldown: 0 },
  { action: 'daily', label: 'デイリーログイン', icon: '🎁', rp_amount: 100, cooldown: 0 },
  { action: 'thread_create', label: 'スレッド作成', icon: '🧵', rp_amount: 30, cooldown: 300 },
]

/** デフォルトのシーズンボーナス配分 */
const DEFAULT_BONUS_DISTRIBUTION = {
  rank_bonuses: {
    x: 5000, s_plus: 4000, s: 3500, s_minus: 3000,
    a_plus: 2500, a: 2000, a_minus: 1500,
    b_plus: 1000, b: 800, b_minus: 600,
    c_plus: 400, c: 200, c_minus: 100
  },
  top_bonuses: [
    { rank_from: 1, rank_to: 1, bonus: 3000, label: '1位' },
    { rank_from: 2, rank_to: 2, bonus: 2000, label: '2位' },
    { rank_from: 3, rank_to: 3, bonus: 1000, label: '3位' },
    { rank_from: 4, rank_to: 10, bonus: 500, label: 'TOP10' },
  ]
}

// --- ランク設定 ---

export function getRankConfig(guildId) {
  let rows = db.prepare('SELECT * FROM rank_config WHERE guild_id = ? ORDER BY rank_order ASC').all(guildId)
  if (rows.length === 0) {
    const stmt = db.prepare('INSERT INTO rank_config (guild_id, rank_key, rank_label, rank_order, rp_threshold, cp_multiplier, color, icon) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    const tx = db.transaction(() => {
      for (const r of DEFAULT_RANK_CONFIG) {
        stmt.run(guildId, r.rank_key, r.rank_label, r.rank_order, r.rp_threshold, r.cp_multiplier, r.color, r.icon)
      }
    })
    tx()
    rows = db.prepare('SELECT * FROM rank_config WHERE guild_id = ? ORDER BY rank_order ASC').all(guildId)
  }
  return rows
}

export function updateRankConfig(guildId, ranks) {
  const del = db.prepare('DELETE FROM rank_config WHERE guild_id = ?')
  const ins = db.prepare('INSERT INTO rank_config (guild_id, rank_key, rank_label, rank_order, rp_threshold, cp_multiplier, color, icon) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
  const tx = db.transaction(() => {
    del.run(guildId)
    for (const r of ranks) {
      ins.run(guildId, r.rank_key, r.rank_label, r.rank_order, r.rp_threshold, r.cp_multiplier, r.color || '#808080', r.icon || '⭐')
    }
  })
  tx()
}

export function addRankTier(guildId, data) {
  db.prepare('INSERT INTO rank_config (guild_id, rank_key, rank_label, rank_order, rp_threshold, cp_multiplier, color, icon) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(guildId, data.rank_key, data.rank_label, data.rank_order, data.rp_threshold, data.cp_multiplier, data.color || '#808080', data.icon || '⭐')
}

export function removeRankTier(guildId, rankKey) {
  db.prepare('DELETE FROM rank_config WHERE guild_id = ? AND rank_key = ?').run(guildId, rankKey)
}

// --- 減衰設定 ---

export function getRankSettings(guildId) {
  let settings = db.prepare('SELECT * FROM rank_settings WHERE guild_id = ?').get(guildId)
  if (!settings) {
    db.prepare('INSERT INTO rank_settings (guild_id) VALUES (?)').run(guildId)
    settings = db.prepare('SELECT * FROM rank_settings WHERE guild_id = ?').get(guildId)
  }
  return settings
}

export function updateRankSettings(guildId, s) {
  db.prepare('UPDATE rank_settings SET decay_rate = ?, decay_grace_days = ?, decay_floor = ? WHERE guild_id = ?')
    .run(s.decay_rate ?? 0.02, s.decay_grace_days ?? 1, s.decay_floor ?? 0, guildId)
}

// --- RPルール ---

export function getRpRules(guildId) {
  let rows = db.prepare('SELECT * FROM rp_rules WHERE guild_id = ? ORDER BY id ASC').all(guildId)
  if (rows.length === 0) {
    const stmt = db.prepare('INSERT INTO rp_rules (guild_id, action, label, icon, rp_amount, cooldown, enabled) VALUES (?, ?, ?, ?, ?, ?, 1)')
    const tx = db.transaction(() => {
      for (const r of DEFAULT_RP_RULES) {
        stmt.run(guildId, r.action, r.label, r.icon, r.rp_amount, r.cooldown)
      }
    })
    tx()
    rows = db.prepare('SELECT * FROM rp_rules WHERE guild_id = ? ORDER BY id ASC').all(guildId)
  }
  return rows.map(r => ({ ...r, enabled: !!r.enabled }))
}

export function updateRpRules(guildId, rules) {
  const stmt = db.prepare('UPDATE rp_rules SET rp_amount = ?, cooldown = ?, enabled = ? WHERE guild_id = ? AND action = ?')
  for (const r of rules) {
    stmt.run(r.rp_amount, r.cooldown || 0, r.enabled ? 1 : 0, guildId, r.action)
  }
}

// --- ランク判定 ---

export function determineRank(guildId, currentRp) {
  const config = getRankConfig(guildId)
  let matched = config[0]
  for (const rank of config) {
    if (currentRp >= rank.rp_threshold) {
      matched = rank
    }
  }
  return matched
}

// --- メンバーランク ---

export function getMemberRank(guildId, userId) {
  let row = db.prepare('SELECT * FROM member_ranks WHERE guild_id = ? AND user_id = ?').get(guildId, userId)
  if (!row) {
    db.prepare('INSERT INTO member_ranks (guild_id, user_id) VALUES (?, ?)').run(guildId, userId)
    row = db.prepare('SELECT * FROM member_ranks WHERE guild_id = ? AND user_id = ?').get(guildId, userId)
  }
  const rankInfo = determineRank(guildId, row.current_rp)
  return {
    ...row,
    decay_exempt: !!row.decay_exempt,
    rank_label: rankInfo.rank_label,
    cp_multiplier: rankInfo.cp_multiplier,
    color: rankInfo.color,
    icon: rankInfo.icon,
    rank_order: rankInfo.rank_order,
    rp_threshold: rankInfo.rp_threshold,
  }
}

// --- RP付与 ---

export function addRp(guildId, userId, amount, source, description = '') {
  // メンバーランクの初期化（なければ作成）
  getMemberRank(guildId, userId)

  const beforeRow = db.prepare('SELECT current_rp, current_rank_key FROM member_ranks WHERE guild_id = ? AND user_id = ?').get(guildId, userId)
  const previousRankKey = beforeRow.current_rank_key

  // RP加算
  db.prepare('UPDATE member_ranks SET current_rp = MAX(0, current_rp + ?), last_recalculated = CURRENT_TIMESTAMP WHERE guild_id = ? AND user_id = ?')
    .run(amount, guildId, userId)

  // ランク再判定
  const updated = db.prepare('SELECT current_rp FROM member_ranks WHERE guild_id = ? AND user_id = ?').get(guildId, userId)
  const newRank = determineRank(guildId, updated.current_rp)
  db.prepare('UPDATE member_ranks SET current_rank_key = ? WHERE guild_id = ? AND user_id = ?')
    .run(newRank.rank_key, guildId, userId)

  // トランザクション記録
  db.prepare('INSERT INTO rp_transactions (guild_id, user_id, amount, source, description) VALUES (?, ?, ?, ?, ?)')
    .run(guildId, userId, amount, source, description)

  return {
    rp_added: amount,
    current_rp: updated.current_rp,
    rank_key: newRank.rank_key,
    rank_label: newRank.rank_label,
    cp_multiplier: newRank.cp_multiplier,
    rank_changed: newRank.rank_key !== previousRankKey,
    previous_rank_key: previousRankKey,
  }
}

// --- CP倍率取得 ---

export function getCpMultiplier(guildId, userId) {
  const row = db.prepare('SELECT current_rank_key FROM member_ranks WHERE guild_id = ? AND user_id = ?').get(guildId, userId)
  if (!row) return 1.0
  const rankInfo = determineRank(guildId, db.prepare('SELECT current_rp FROM member_ranks WHERE guild_id = ? AND user_id = ?').get(guildId, userId)?.current_rp || 0)
  return rankInfo.cp_multiplier
}

// --- 減衰処理 ---

export function applyDecay(guildId) {
  const settings = getRankSettings(guildId)
  const today = new Date().toISOString().split('T')[0]
  const graceDate = new Date()
  graceDate.setDate(graceDate.getDate() - settings.decay_grace_days)
  const graceDateStr = graceDate.toISOString().split('T')[0]

  // 免除期限切れの処理
  db.prepare(`UPDATE member_ranks SET decay_exempt = 0
    WHERE guild_id = ? AND decay_exempt = 1 AND decay_exempt_until IS NOT NULL AND decay_exempt_until <= ?`)
    .run(guildId, new Date().toISOString())

  // 減衰対象のメンバーを取得（非免除 & 猶予期間超過）
  const members = db.prepare(`
    SELECT mr.user_id, mr.current_rp FROM member_ranks mr
    LEFT JOIN member_points mp ON mr.guild_id = mp.guild_id AND mr.user_id = mp.user_id
    WHERE mr.guild_id = ? AND mr.decay_exempt = 0
    AND (mp.last_active IS NULL OR DATE(mp.last_active) < ?)
  `).all(guildId, graceDateStr)

  const updateStmt = db.prepare('UPDATE member_ranks SET current_rp = ?, current_rank_key = ?, last_recalculated = CURRENT_TIMESTAMP WHERE guild_id = ? AND user_id = ?')

  let decayedCount = 0
  for (const m of members) {
    const newRp = Math.max(Math.floor(m.current_rp * (1 - settings.decay_rate)), settings.decay_floor)
    if (newRp !== m.current_rp) {
      const rank = determineRank(guildId, newRp)
      updateStmt.run(newRp, rank.rank_key, guildId, m.user_id)
      decayedCount++
    }
  }
  return decayedCount
}

// --- 減衰免除 ---

export function setDecayExempt(guildId, userId, exempt, exemptUntil = null) {
  getMemberRank(guildId, userId)
  db.prepare('UPDATE member_ranks SET decay_exempt = ?, decay_exempt_until = ? WHERE guild_id = ? AND user_id = ?')
    .run(exempt ? 1 : 0, exemptUntil, guildId, userId)
}

export function getDecayExemptMembers(guildId) {
  return db.prepare('SELECT * FROM member_ranks WHERE guild_id = ? AND decay_exempt = 1').all(guildId)
    .map(r => ({ ...r, decay_exempt: true }))
}

// --- RPランキング ---

export function getRpLeaderboard(guildId, limit = 50) {
  return db.prepare(`
    SELECT mr.*, mp.username, mp.display_name, mp.avatar, mp.total_points, mp.messages, mp.reactions, mp.voice_minutes, mp.streak_days,
      RANK() OVER (ORDER BY mr.current_rp DESC) as rank
    FROM member_ranks mr
    LEFT JOIN member_points mp ON mr.guild_id = mp.guild_id AND mr.user_id = mp.user_id
    WHERE mr.guild_id = ?
    ORDER BY mr.current_rp DESC LIMIT ?
  `).all(guildId, limit)
}

// --- RP履歴 ---

export function getRpHistory(guildId, userId, limit = 20) {
  return db.prepare('SELECT * FROM rp_transactions WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT ?')
    .all(guildId, userId, limit)
}

// --- シーズン設定 ---

export function getSeasonConfig(guildId) {
  let config = db.prepare('SELECT * FROM season_config WHERE guild_id = ?').get(guildId)
  if (!config) {
    db.prepare('INSERT INTO season_config (guild_id, bonus_distribution) VALUES (?, ?)')
      .run(guildId, JSON.stringify(DEFAULT_BONUS_DISTRIBUTION))
    config = db.prepare('SELECT * FROM season_config WHERE guild_id = ?').get(guildId)
  }
  return {
    ...config,
    enabled: !!config.enabled,
    bonus_distribution: JSON.parse(config.bonus_distribution || '{}'),
  }
}

export function updateSeasonConfig(guildId, data) {
  db.prepare(`UPDATE season_config SET enabled = ?, cycle_type = ?, cycle_value = ?,
    start_date = ?, bonus_distribution = ?, notify_channel_id = ? WHERE guild_id = ?`).run(
    data.enabled ? 1 : 0, data.cycle_type || 'months', data.cycle_value || 3,
    data.start_date || new Date().toISOString().split('T')[0],
    JSON.stringify(data.bonus_distribution || {}),
    data.notify_channel_id || '', guildId
  )
}

export function getNextSeasonEnd(guildId) {
  const config = getSeasonConfig(guildId)
  const start = new Date(config.start_date)
  const now = new Date()

  if (config.cycle_type === 'months') {
    let seasonEnd = new Date(start)
    while (seasonEnd <= now) {
      seasonEnd.setMonth(seasonEnd.getMonth() + config.cycle_value)
    }
    seasonEnd.setDate(seasonEnd.getDate() - 1)
    return seasonEnd.toISOString().split('T')[0]
  } else {
    const diffDays = Math.floor((now - start) / 86400000)
    const cyclesPassed = Math.floor(diffDays / config.cycle_value)
    const nextEnd = new Date(start)
    nextEnd.setDate(nextEnd.getDate() + (cyclesPassed + 1) * config.cycle_value - 1)
    return nextEnd.toISOString().split('T')[0]
  }
}

export function checkAndExecuteSeason(guildId) {
  const config = getSeasonConfig(guildId)
  if (!config.enabled) return null

  const nextEnd = getNextSeasonEnd(guildId)
  const today = new Date().toISOString().split('T')[0]
  if (today !== nextEnd) return null

  // 既に今日実行済みなら何もしない
  if (config.last_season_end) {
    const lastEnd = new Date(config.last_season_end).toISOString().split('T')[0]
    if (lastEnd === today) return null
  }

  // ランキング生成
  const members = getRpLeaderboard(guildId, 9999)
  if (members.length === 0) return null

  const dist = config.bonus_distribution || DEFAULT_BONUS_DISTRIBUTION
  const results = []

  for (let i = 0; i < members.length; i++) {
    const m = members[i]
    const position = i + 1
    let bonus = 0

    // ランク帯ボーナス
    if (dist.rank_bonuses && dist.rank_bonuses[m.current_rank_key]) {
      bonus += dist.rank_bonuses[m.current_rank_key]
    }

    // TOP順位ボーナス
    if (dist.top_bonuses) {
      for (const tb of dist.top_bonuses) {
        if (position >= tb.rank_from && position <= tb.rank_to) {
          bonus += tb.bonus
          break
        }
      }
    }

    if (bonus > 0) {
      const seasonNum = getSeasonNumber(guildId)
      addRp(guildId, m.user_id, bonus, 'season_bonus', `シーズン${seasonNum} ボーナス`)
    }

    results.push({
      user_id: m.user_id,
      username: m.username || m.display_name || m.user_id,
      rank_key: m.current_rank_key,
      rp: m.current_rp,
      position,
      bonus_rp: bonus,
    })
  }

  // 履歴記録
  const seasonNum = getSeasonNumber(guildId)
  const seasonStart = getSeasonStart(guildId)
  db.prepare('INSERT INTO season_history (guild_id, season_number, season_start, season_end, results) VALUES (?, ?, ?, ?, ?)')
    .run(guildId, seasonNum, seasonStart, today, JSON.stringify(results))

  // last_season_end更新
  db.prepare('UPDATE season_config SET last_season_end = ? WHERE guild_id = ?')
    .run(new Date().toISOString(), guildId)

  return { season_number: seasonNum, results }
}

function getSeasonNumber(guildId) {
  const count = db.prepare('SELECT COUNT(*) as count FROM season_history WHERE guild_id = ?').get(guildId)
  return (count.count || 0) + 1
}

function getSeasonStart(guildId) {
  const config = getSeasonConfig(guildId)
  const lastHistory = db.prepare('SELECT season_end FROM season_history WHERE guild_id = ? ORDER BY id DESC LIMIT 1').get(guildId)
  if (lastHistory) {
    const d = new Date(lastHistory.season_end)
    d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0]
  }
  return config.start_date
}

export function getSeasonHistory(guildId, limit = 10) {
  return db.prepare('SELECT * FROM season_history WHERE guild_id = ? ORDER BY id DESC LIMIT ?').all(guildId, limit)
    .map(h => ({ ...h, results: JSON.parse(h.results || '[]') }))
}

// --- メンテナンス ---

export function cleanupOldRpTransactions(retentionDays = 120) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - retentionDays)
  db.prepare('DELETE FROM rp_transactions WHERE created_at < ?').run(cutoff.toISOString())
}

// --- 全メンバーランク再判定 ---

export function recalculateAllRanks(guildId) {
  const members = db.prepare('SELECT * FROM member_ranks WHERE guild_id = ?').all(guildId)
  const stmt = db.prepare('UPDATE member_ranks SET current_rank_key = ?, last_recalculated = CURRENT_TIMESTAMP WHERE guild_id = ? AND user_id = ?')
  for (const m of members) {
    const rank = determineRank(guildId, m.current_rp)
    stmt.run(rank.rank_key, guildId, m.user_id)
  }
  return members.length
}

// ============================
// Commands DB Helpers
// ============================

export function getAllCommands() {
  const rows = db.prepare('SELECT * FROM commands ORDER BY id ASC').all()
  return rows.map(deserializeCommand)
}

export function createCommand(cmd) {
  const stmt = db.prepare(`INSERT INTO commands (name, description, response_type, response_text,
    embed_title, embed_description, embed_color, ephemeral, cooldown, enabled,
    options, required_permissions, allowed_roles, random_responses, dm_response,
    is_builtin, point_cost, point_reward_min, point_reward_max)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  const result = stmt.run(
    cmd.name, cmd.description || '', cmd.responseType || 'text', cmd.responseText || '',
    cmd.embedTitle || '', cmd.embedDescription || '', cmd.embedColor || '#7c5cfc',
    cmd.ephemeral ? 1 : 0, cmd.cooldown || 0, cmd.enabled !== false ? 1 : 0,
    JSON.stringify(cmd.options || []),
    JSON.stringify(cmd.requiredPermissions || []),
    JSON.stringify(cmd.allowedRoles || []),
    JSON.stringify(cmd.randomResponses || []),
    cmd.dmResponse ? 1 : 0,
    cmd.isBuiltin ? 1 : 0,
    cmd.pointCost || 0, cmd.pointRewardMin || 0, cmd.pointRewardMax || 0
  )
  return deserializeCommand(db.prepare('SELECT * FROM commands WHERE id = ?').get(result.lastInsertRowid))
}

export function updateCommand(id, cmd) {
  db.prepare(`UPDATE commands SET name = ?, description = ?, response_type = ?, response_text = ?,
    embed_title = ?, embed_description = ?, embed_color = ?, ephemeral = ?, cooldown = ?, enabled = ?,
    options = ?, required_permissions = ?, allowed_roles = ?, random_responses = ?, dm_response = ?,
    is_builtin = ?, point_cost = ?, point_reward_min = ?, point_reward_max = ?,
    updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .run(
      cmd.name, cmd.description || '', cmd.responseType || 'text', cmd.responseText || '',
      cmd.embedTitle || '', cmd.embedDescription || '', cmd.embedColor || '#7c5cfc',
      cmd.ephemeral ? 1 : 0, cmd.cooldown || 0, cmd.enabled !== false ? 1 : 0,
      JSON.stringify(cmd.options || []),
      JSON.stringify(cmd.requiredPermissions || []),
      JSON.stringify(cmd.allowedRoles || []),
      JSON.stringify(cmd.randomResponses || []),
      cmd.dmResponse ? 1 : 0,
      cmd.isBuiltin ? 1 : 0,
      cmd.pointCost || 0, cmd.pointRewardMin || 0, cmd.pointRewardMax || 0,
      id
    )
}

export function deleteCommand(id) {
  db.prepare('DELETE FROM commands WHERE id = ?').run(id)
}

function deserializeCommand(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    responseType: row.response_type,
    responseText: row.response_text,
    embedTitle: row.embed_title,
    embedDescription: row.embed_description,
    embedColor: row.embed_color,
    ephemeral: !!row.ephemeral,
    cooldown: row.cooldown,
    enabled: !!row.enabled,
    options: JSON.parse(row.options || '[]'),
    requiredPermissions: JSON.parse(row.required_permissions || '[]'),
    allowedRoles: JSON.parse(row.allowed_roles || '[]'),
    randomResponses: JSON.parse(row.random_responses || '[]'),
    dmResponse: !!row.dm_response,
    isBuiltin: !!row.is_builtin,
    pointCost: row.point_cost || 0,
    pointRewardMin: row.point_reward_min || 0,
    pointRewardMax: row.point_reward_max || 0,
  }
}

// ============================
// Gacha DB Helpers
// ============================

export function getGachaSettings() {
  const rows = db.prepare('SELECT * FROM gacha_settings ORDER BY id ASC').all()
  return rows.map(r => ({ ...r, enabled: !!r.enabled, items: JSON.parse(r.items || '[]') }))
}

export function updateGachaSettings(id, settings) {
  db.prepare('UPDATE gacha_settings SET name = ?, cost = ?, enabled = ?, items = ? WHERE id = ?')
    .run(settings.name, settings.cost, settings.enabled ? 1 : 0, JSON.stringify(settings.items), id)
}

export function rollGacha(items) {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0)
  let random = Math.random() * totalWeight
  for (const item of items) {
    random -= item.weight
    if (random <= 0) return item
  }
  return items[items.length - 1]
}

// ============================
// Point Rules DB Helpers
// ============================

export function getAllPointRules() {
  return db.prepare('SELECT * FROM point_rules ORDER BY id ASC').all().map(r => ({ ...r, enabled: !!r.enabled }))
}

export function updatePointRules(rules) {
  const stmt = db.prepare('UPDATE point_rules SET points = ?, cooldown = ?, enabled = ? WHERE id = ?')
  for (const rule of rules) {
    stmt.run(rule.points, rule.cooldown, rule.enabled ? 1 : 0, rule.id)
  }
}

// ============================
// Rewards DB Helpers
// ============================

export function getAllRewards() {
  return db.prepare('SELECT * FROM rewards ORDER BY id ASC').all().map(r => ({ ...r, enabled: !!r.enabled }))
}

export function createReward(reward) {
  const result = db.prepare(`INSERT INTO rewards (name, type, icon, cost, role_id, description, stock, enabled)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(reward.name, reward.type || 'role', reward.icon || '🎁', reward.cost || 100,
      reward.roleId || '', reward.description || '', reward.stock ?? -1, reward.enabled !== false ? 1 : 0)
  return db.prepare('SELECT * FROM rewards WHERE id = ?').get(result.lastInsertRowid)
}

export function updateReward(id, reward) {
  db.prepare(`UPDATE rewards SET name = ?, type = ?, icon = ?, cost = ?, role_id = ?,
    description = ?, stock = ?, enabled = ? WHERE id = ?`)
    .run(reward.name, reward.type, reward.icon, reward.cost,
      reward.roleId || reward.role_id || '', reward.description, reward.stock, reward.enabled ? 1 : 0, id)
}

export function deleteReward(id) {
  db.prepare('DELETE FROM rewards WHERE id = ?').run(id)
}

// ============================
// Point System DB Helpers
// ============================

export function getOrCreateMember(guildId, userId, username = '', displayName = '', avatar = '') {
  const existing = db.prepare('SELECT * FROM member_points WHERE guild_id = ? AND user_id = ?').get(guildId, userId)
  if (existing) {
    if (username || displayName || avatar) {
      db.prepare('UPDATE member_points SET username = ?, display_name = ?, avatar = ?, last_active = CURRENT_TIMESTAMP WHERE guild_id = ? AND user_id = ?')
        .run(username || existing.username, displayName || existing.display_name, avatar || existing.avatar, guildId, userId)
    }
    return db.prepare('SELECT * FROM member_points WHERE guild_id = ? AND user_id = ?').get(guildId, userId)
  }
  db.prepare('INSERT INTO member_points (guild_id, user_id, username, display_name, avatar) VALUES (?, ?, ?, ?, ?)').run(guildId, userId, username, displayName, avatar)
  return db.prepare('SELECT * FROM member_points WHERE guild_id = ? AND user_id = ?').get(guildId, userId)
}

export function addPoints(guildId, userId, amount, type, description = '', fromUserId = null, fee = 0) {
  const member = getOrCreateMember(guildId, userId)

  // Update balance
  db.prepare('UPDATE member_points SET total_points = total_points + ?, last_active = CURRENT_TIMESTAMP WHERE guild_id = ? AND user_id = ?')
    .run(amount, guildId, userId)

  // Track total earned (only positive earnings for level calculation)
  if (amount > 0) {
    db.prepare('UPDATE member_points SET total_earned = total_earned + ? WHERE guild_id = ? AND user_id = ?')
      .run(amount, guildId, userId)
  }

  // Update stats based on type
  if (type === 'earn' && description.includes('メッセージ')) {
    db.prepare('UPDATE member_points SET messages = messages + 1 WHERE guild_id = ? AND user_id = ?').run(guildId, userId)
  } else if (type === 'earn' && description.includes('リアクション')) {
    db.prepare('UPDATE member_points SET reactions = reactions + 1 WHERE guild_id = ? AND user_id = ?').run(guildId, userId)
  }

  // Record transaction
  db.prepare('INSERT INTO point_transactions (guild_id, from_user_id, to_user_id, amount, fee, type, description) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(guildId, fromUserId, userId, amount, fee, type, description)

  return db.prepare('SELECT * FROM member_points WHERE guild_id = ? AND user_id = ?').get(guildId, userId)
}

export function transferPoints(guildId, fromUserId, toUserId, amount, feePercent = 5, description = '') {
  const sender = getOrCreateMember(guildId, fromUserId)

  if (sender.total_points < amount) {
    return { success: false, error: 'ポイントが不足しています' }
  }

  const fee = Math.floor(amount * feePercent / 100)
  const netAmount = amount - fee

  // Deduct from sender (no total_earned change - spending doesn't affect level)
  db.prepare('UPDATE member_points SET total_points = total_points - ? WHERE guild_id = ? AND user_id = ?')
    .run(amount, guildId, fromUserId)

  // Record sender transaction
  db.prepare('INSERT INTO point_transactions (guild_id, from_user_id, to_user_id, amount, fee, type, description) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(guildId, fromUserId, toUserId, -amount, fee, 'transfer', description || 'ポイント送金')

  // Add to receiver (received points count as earned for receiver's level)
  addPoints(guildId, toUserId, netAmount, 'transfer', description || 'ポイント受取', fromUserId, 0)

  return {
    success: true,
    sent: amount,
    fee,
    received: netAmount,
    senderBalance: db.prepare('SELECT total_points FROM member_points WHERE guild_id = ? AND user_id = ?').get(guildId, fromUserId).total_points,
    receiverBalance: db.prepare('SELECT total_points FROM member_points WHERE guild_id = ? AND user_id = ?').get(guildId, toUserId).total_points
  }
}

/**
 * ボイスチャンネル参加時間を加算する
 * @param {string} guildId - サーバーID
 * @param {string} userId - ユーザーID
 * @param {number} minutes - 加算する分数
 */
export function addVoiceMinutes(guildId, userId, minutes) {
  db.prepare('UPDATE member_points SET voice_minutes = voice_minutes + ? WHERE guild_id = ? AND user_id = ?')
    .run(minutes, guildId, userId)
}

export function getLeaderboard(guildId, limit = 50) {
  return db.prepare('SELECT *, RANK() OVER (ORDER BY total_points DESC) as rank FROM member_points WHERE guild_id = ? ORDER BY total_points DESC LIMIT ?').all(guildId, limit)
}

export function getUserRank(guildId, userId) {
  const result = db.prepare(`
    SELECT rank FROM (
      SELECT user_id, RANK() OVER (ORDER BY total_points DESC) as rank
      FROM member_points WHERE guild_id = ?
    ) WHERE user_id = ?
  `).get(guildId, userId)
  return result?.rank || 0
}

export function getTransactionHistory(guildId, userId, limit = 20) {
  return db.prepare('SELECT * FROM point_transactions WHERE guild_id = ? AND (from_user_id = ? OR to_user_id = ?) ORDER BY created_at DESC LIMIT ?')
    .all(guildId, userId, userId, limit)
}

export function getPointStats(guildId) {
  const totalPoints = db.prepare('SELECT COALESCE(SUM(total_points), 0) as total FROM member_points WHERE guild_id = ?').get(guildId)
  const memberCount = db.prepare('SELECT COUNT(*) as count FROM member_points WHERE guild_id = ?').get(guildId)
  const topStreak = db.prepare('SELECT MAX(streak_days) as max_streak FROM member_points WHERE guild_id = ?').get(guildId)
  const totalTransactions = db.prepare("SELECT COUNT(*) as count FROM point_transactions WHERE guild_id = ? AND type = 'reward'").get(guildId)

  return {
    totalPointsIssued: totalPoints.total,
    averagePoints: memberCount.count > 0 ? Math.round(totalPoints.total / memberCount.count) : 0,
    maxStreak: topStreak.max_streak || 0,
    rewardsClaimed: totalTransactions.count
  }
}

export function getEconomySettings(guildId) {
  let settings = db.prepare('SELECT * FROM point_economy_settings WHERE guild_id = ?').get(guildId)
  if (!settings) {
    db.prepare('INSERT INTO point_economy_settings (guild_id) VALUES (?)').run(guildId)
    settings = db.prepare('SELECT * FROM point_economy_settings WHERE guild_id = ?').get(guildId)
  }
  return settings
}

export function updateEconomySettings(guildId, settings) {
  db.prepare(`UPDATE point_economy_settings SET
    transfer_fee_percent = ?, min_transfer_amount = ?, daily_transfer_limit = ?,
    daily_bonus_amount = ?, daily_bonus_streak_multiplier = ?, max_daily_bonus = ?, enabled = ?
    WHERE guild_id = ?`
  ).run(
    settings.transfer_fee_percent, settings.min_transfer_amount, settings.daily_transfer_limit,
    settings.daily_bonus_amount, settings.daily_bonus_streak_multiplier, settings.max_daily_bonus,
    settings.enabled ? 1 : 0, guildId
  )
  return getEconomySettings(guildId)
}

export function claimDaily(guildId, userId) {
  const today = new Date().toISOString().split('T')[0]
  const existing = db.prepare('SELECT * FROM daily_claims WHERE guild_id = ? AND user_id = ? AND claimed_at = ?').get(guildId, userId, today)
  if (existing) {
    return { success: false, error: '今日はすでにデイリーボーナスを受け取っています', nextClaim: getNextDayString() }
  }

  const settings = getEconomySettings(guildId)

  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  const yesterdayClaim = db.prepare('SELECT * FROM daily_claims WHERE guild_id = ? AND user_id = ? AND claimed_at = ?').get(guildId, userId, yesterday)

  let streak = yesterdayClaim ? (yesterdayClaim.streak + 1) : 1
  let bonus = Math.min(
    settings.daily_bonus_amount * Math.pow(settings.daily_bonus_streak_multiplier, streak - 1),
    settings.max_daily_bonus
  )
  bonus = Math.round(bonus * 10) / 10

  db.prepare('INSERT INTO daily_claims (guild_id, user_id, claimed_at, amount, streak) VALUES (?, ?, ?, ?, ?)')
    .run(guildId, userId, today, bonus, streak)

  db.prepare('UPDATE member_points SET streak_days = ? WHERE guild_id = ? AND user_id = ?').run(streak, guildId, userId)

  addPoints(guildId, userId, bonus, 'daily', `デイリーボーナス (${streak}日連続)`)

  return { success: true, amount: bonus, streak, nextClaim: getNextDayString() }
}

function getNextDayString() {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(0, 0, 0, 0)
  return tomorrow.toISOString()
}

export function getDailyTransferTotal(guildId, userId) {
  const today = new Date().toISOString().split('T')[0]
  const result = db.prepare(`
    SELECT COALESCE(SUM(ABS(amount)), 0) as total
    FROM point_transactions
    WHERE guild_id = ? AND from_user_id = ? AND type = 'transfer'
    AND DATE(created_at) = ?
  `).get(guildId, userId, today)
  return result.total
}
