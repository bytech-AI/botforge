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
      trigger_text TEXT NOT NULL,
      match_type TEXT DEFAULT 'contains',
      response TEXT NOT NULL,
      channel_scope TEXT DEFAULT 'all',
      channel_id TEXT DEFAULT '',
      enabled INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
  `)

  // Migrations for existing DBs
  const migrations = [
    'ALTER TABLE member_points ADD COLUMN total_earned REAL DEFAULT 0',
    'ALTER TABLE commands ADD COLUMN is_builtin INTEGER DEFAULT 0',
    'ALTER TABLE commands ADD COLUMN point_cost REAL DEFAULT 0',
    'ALTER TABLE commands ADD COLUMN point_reward_min REAL DEFAULT 0',
    'ALTER TABLE commands ADD COLUMN point_reward_max REAL DEFAULT 0',
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
// RPG Level System
// ============================

// RPG Leveling Curve - easy start, progressively harder
// Formula: level = floor(sqrt(totalEarned / 1.5)) + 1
// Lv.2 ≈ 2pt, Lv.3 ≈ 6pt, Lv.5 ≈ 24pt, Lv.10 ≈ 122pt
// Lv.20 ≈ 542pt, Lv.50 ≈ 3602pt, Lv.100 ≈ 14702pt
export function calculateLevel(totalEarned) {
  return Math.max(1, Math.floor(Math.sqrt((totalEarned || 0) / 1.5)) + 1)
}

export function pointsForNextLevel(currentLevel) {
  // Total earned points needed to reach this level
  return Math.ceil(1.5 * currentLevel * currentLevel)
}

export function getLevelTitle(level) {
  if (level >= 100) return { title: '🐉 伝説の冒険者', color: '#ff4500', tier: 'legendary' }
  if (level >= 80) return { title: '⚡ 英雄', color: '#ffd700', tier: 'hero' }
  if (level >= 60) return { title: '🔮 大魔導師', color: '#9b59b6', tier: 'archmage' }
  if (level >= 45) return { title: '👑 マスター', color: '#e74c3c', tier: 'master' }
  if (level >= 35) return { title: '💎 ダイヤモンド', color: '#3498db', tier: 'diamond' }
  if (level >= 25) return { title: '🛡️ ベテラン冒険者', color: '#2ecc71', tier: 'veteran' }
  if (level >= 15) return { title: '⚔️ 一人前の戦士', color: '#e67e22', tier: 'warrior' }
  if (level >= 8) return { title: '🗡️ 見習い剣士', color: '#95a5a6', tier: 'apprentice' }
  if (level >= 3) return { title: '🌿 冒険者', color: '#27ae60', tier: 'adventurer' }
  return { title: '🌱 新人', color: '#bdc3c7', tier: 'newbie' }
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

  // Calculate RPG level from total earned (never decreases)
  const updated = db.prepare('SELECT total_earned FROM member_points WHERE guild_id = ? AND user_id = ?').get(guildId, userId)
  const newLevel = calculateLevel(updated.total_earned)
  db.prepare('UPDATE member_points SET level = ? WHERE guild_id = ? AND user_id = ?').run(newLevel, guildId, userId)

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
