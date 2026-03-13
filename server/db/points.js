import { getDb } from './connection.js'

// ============================
// Gacha DB Helpers
// ============================

export function getGachaSettings() {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM gacha_settings ORDER BY id ASC').all()
  return rows.map(r => ({ ...r, enabled: !!r.enabled, items: JSON.parse(r.items || '[]') }))
}

export function updateGachaSettings(id, settings) {
  const db = getDb()
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
  const db = getDb()
  return db.prepare('SELECT * FROM point_rules ORDER BY id ASC').all().map(r => ({ ...r, enabled: !!r.enabled }))
}

export function updatePointRules(rules) {
  const db = getDb()
  const stmt = db.prepare('UPDATE point_rules SET points = ?, cooldown = ?, enabled = ? WHERE id = ?')
  for (const rule of rules) {
    stmt.run(rule.points, rule.cooldown, rule.enabled ? 1 : 0, rule.id)
  }
}

// ============================
// Rewards DB Helpers
// ============================

export function getAllRewards() {
  const db = getDb()
  return db.prepare('SELECT * FROM rewards ORDER BY id ASC').all().map(r => ({ ...r, enabled: !!r.enabled }))
}

export function createReward(reward) {
  const db = getDb()
  const result = db.prepare(`INSERT INTO rewards (name, type, icon, cost, role_id, description, stock, enabled)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(reward.name, reward.type || 'role', reward.icon || '🎁', reward.cost || 100,
      reward.roleId || '', reward.description || '', reward.stock ?? -1, reward.enabled !== false ? 1 : 0)
  return db.prepare('SELECT * FROM rewards WHERE id = ?').get(result.lastInsertRowid)
}

export function updateReward(id, reward) {
  const db = getDb()
  db.prepare(`UPDATE rewards SET name = ?, type = ?, icon = ?, cost = ?, role_id = ?,
    description = ?, stock = ?, enabled = ? WHERE id = ?`)
    .run(reward.name, reward.type, reward.icon, reward.cost,
      reward.roleId || reward.role_id || '', reward.description, reward.stock, reward.enabled ? 1 : 0, id)
}

export function deleteReward(id) {
  const db = getDb()
  db.prepare('DELETE FROM rewards WHERE id = ?').run(id)
}

// ============================
// Point System DB Helpers
// ============================

export function getOrCreateMember(guildId, userId, username = '', displayName = '', avatar = '') {
  const db = getDb()
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
  const db = getDb()
  getOrCreateMember(guildId, userId)

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
  const db = getDb()
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
  const db = getDb()
  db.prepare('UPDATE member_points SET voice_minutes = voice_minutes + ? WHERE guild_id = ? AND user_id = ?')
    .run(minutes, guildId, userId)
}

export function getLeaderboard(guildId, limit = 50) {
  const db = getDb()
  return db.prepare('SELECT *, RANK() OVER (ORDER BY total_points DESC) as rank FROM member_points WHERE guild_id = ? ORDER BY total_points DESC LIMIT ?').all(guildId, limit)
}

export function getUserRank(guildId, userId) {
  const db = getDb()
  const result = db.prepare(`
    SELECT rank FROM (
      SELECT user_id, RANK() OVER (ORDER BY total_points DESC) as rank
      FROM member_points WHERE guild_id = ?
    ) WHERE user_id = ?
  `).get(guildId, userId)
  return result?.rank || 0
}

export function getTransactionHistory(guildId, userId, limit = 20) {
  const db = getDb()
  return db.prepare('SELECT * FROM point_transactions WHERE guild_id = ? AND (from_user_id = ? OR to_user_id = ?) ORDER BY created_at DESC LIMIT ?')
    .all(guildId, userId, userId, limit)
}

export function getPointStats(guildId) {
  const db = getDb()
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
  const db = getDb()
  let settings = db.prepare('SELECT * FROM point_economy_settings WHERE guild_id = ?').get(guildId)
  if (!settings) {
    db.prepare('INSERT INTO point_economy_settings (guild_id) VALUES (?)').run(guildId)
    settings = db.prepare('SELECT * FROM point_economy_settings WHERE guild_id = ?').get(guildId)
  }
  return settings
}

export function updateEconomySettings(guildId, settings) {
  const db = getDb()
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
  const db = getDb()
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
  const db = getDb()
  const today = new Date().toISOString().split('T')[0]
  const result = db.prepare(`
    SELECT COALESCE(SUM(ABS(amount)), 0) as total
    FROM point_transactions
    WHERE guild_id = ? AND from_user_id = ? AND type = 'transfer'
    AND DATE(created_at) = ?
  `).get(guildId, userId, today)
  return result.total
}

export function resetAllPoints(guildId) {
  const db = getDb()
  db.prepare('UPDATE member_points SET total_points = 0, total_earned = 0, level = 1, messages = 0, reactions = 0, voice_minutes = 0, streak_days = 0 WHERE guild_id = ?').run(guildId)
  db.prepare('DELETE FROM point_transactions WHERE guild_id = ?').run(guildId)
  db.prepare('DELETE FROM daily_claims WHERE guild_id = ?').run(guildId)
}

export function resetUserPoints(guildId, userId) {
  const db = getDb()
  db.prepare('UPDATE member_points SET total_points = 0, total_earned = 0, level = 1, messages = 0, reactions = 0, voice_minutes = 0, streak_days = 0 WHERE guild_id = ? AND user_id = ?').run(guildId, userId)
  db.prepare('DELETE FROM point_transactions WHERE guild_id = ? AND to_user_id = ?').run(guildId, userId)
  db.prepare('DELETE FROM daily_claims WHERE guild_id = ? AND user_id = ?').run(guildId, userId)
}
