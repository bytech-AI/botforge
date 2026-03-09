import { getDb } from './connection.js'

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
  const db = getDb()
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
  const db = getDb()
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
  const db = getDb()
  db.prepare('INSERT INTO rank_config (guild_id, rank_key, rank_label, rank_order, rp_threshold, cp_multiplier, color, icon) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(guildId, data.rank_key, data.rank_label, data.rank_order, data.rp_threshold, data.cp_multiplier, data.color || '#808080', data.icon || '⭐')
}

export function removeRankTier(guildId, rankKey) {
  const db = getDb()
  db.prepare('DELETE FROM rank_config WHERE guild_id = ? AND rank_key = ?').run(guildId, rankKey)
}

// --- 減衰設定 ---

export function getRankSettings(guildId) {
  const db = getDb()
  let settings = db.prepare('SELECT * FROM rank_settings WHERE guild_id = ?').get(guildId)
  if (!settings) {
    db.prepare('INSERT INTO rank_settings (guild_id) VALUES (?)').run(guildId)
    settings = db.prepare('SELECT * FROM rank_settings WHERE guild_id = ?').get(guildId)
  }
  return settings
}

export function updateRankSettings(guildId, s) {
  const db = getDb()
  db.prepare('UPDATE rank_settings SET decay_rate = ?, decay_grace_days = ?, decay_floor = ? WHERE guild_id = ?')
    .run(s.decay_rate ?? 0.02, s.decay_grace_days ?? 1, s.decay_floor ?? 0, guildId)
}

// --- RPルール ---

export function getRpRules(guildId) {
  const db = getDb()
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
  const db = getDb()
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
  const db = getDb()
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
  const db = getDb()
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
  const db = getDb()
  const row = db.prepare('SELECT current_rank_key FROM member_ranks WHERE guild_id = ? AND user_id = ?').get(guildId, userId)
  if (!row) return 1.0
  const rankInfo = determineRank(guildId, db.prepare('SELECT current_rp FROM member_ranks WHERE guild_id = ? AND user_id = ?').get(guildId, userId)?.current_rp || 0)
  return rankInfo.cp_multiplier
}

// --- 減衰処理 ---

export function applyDecay(guildId) {
  const db = getDb()
  const settings = getRankSettings(guildId)
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
  const db = getDb()
  getMemberRank(guildId, userId)
  db.prepare('UPDATE member_ranks SET decay_exempt = ?, decay_exempt_until = ? WHERE guild_id = ? AND user_id = ?')
    .run(exempt ? 1 : 0, exemptUntil, guildId, userId)
}

export function getDecayExemptMembers(guildId) {
  const db = getDb()
  return db.prepare('SELECT * FROM member_ranks WHERE guild_id = ? AND decay_exempt = 1').all(guildId)
    .map(r => ({ ...r, decay_exempt: true }))
}

// --- RPランキング ---

export function getRpLeaderboard(guildId, limit = 50) {
  const db = getDb()
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
  const db = getDb()
  return db.prepare('SELECT * FROM rp_transactions WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT ?')
    .all(guildId, userId, limit)
}

// --- シーズン設定 ---

export function getSeasonConfig(guildId) {
  const db = getDb()
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
  const db = getDb()
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
  const db = getDb()
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
  const db = getDb()
  const count = db.prepare('SELECT COUNT(*) as count FROM season_history WHERE guild_id = ?').get(guildId)
  return (count.count || 0) + 1
}

function getSeasonStart(guildId) {
  const db = getDb()
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
  const db = getDb()
  return db.prepare('SELECT * FROM season_history WHERE guild_id = ? ORDER BY id DESC LIMIT ?').all(guildId, limit)
    .map(h => ({ ...h, results: JSON.parse(h.results || '[]') }))
}

// --- メンテナンス ---

export function cleanupOldRpTransactions(retentionDays = 120) {
  const db = getDb()
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - retentionDays)
  db.prepare('DELETE FROM rp_transactions WHERE created_at < ?').run(cutoff.toISOString())
}

// --- 全メンバーランク再判定 ---

export function recalculateAllRanks(guildId) {
  const db = getDb()
  const members = db.prepare('SELECT * FROM member_ranks WHERE guild_id = ?').all(guildId)
  const stmt = db.prepare('UPDATE member_ranks SET current_rank_key = ?, last_recalculated = CURRENT_TIMESTAMP WHERE guild_id = ? AND user_id = ?')
  for (const m of members) {
    const rank = determineRank(guildId, m.current_rp)
    stmt.run(rank.rank_key, guildId, m.user_id)
  }
  return members.length
}
