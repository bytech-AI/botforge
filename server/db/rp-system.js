import { getDb } from './connection.js'
import { addPoints, getOrCreateMember } from './points.js'

// ============================
// RP (Rank Point) System
// ============================
// 累積RP方式: RPは累積値として管理し、閾値テーブルでランクを判定する
// 減衰はサボった日だけ適用（活動日は減衰なし）

/** Xランク設定のデフォルト */
const DEFAULT_X_RANK_CONFIG = {
  max_rp: 3000,
  entry_rp: 1000,
  demotion_threshold: 0,
  tiers: [
    { min: 0, max: 999, cp_multiplier: 1.6, label: 'X-I' },
    { min: 1000, max: 1999, cp_multiplier: 1.7, label: 'X-II' },
    { min: 2000, max: 3000, cp_multiplier: 1.8, label: 'X-III' },
  ]
}

/** ランク設定のデフォルトシード（仕様書準拠: 13段階） */
const DEFAULT_RANK_CONFIG = [
  { rank_key: 'c_minus', rank_label: 'C-', rank_order: 0, rp_threshold: 0, cp_multiplier: 0.3, color: '#808080', icon: '🌱' },
  { rank_key: 'c', rank_label: 'C', rank_order: 1, rp_threshold: 500, cp_multiplier: 0.4, color: '#8B8B8B', icon: '🌿' },
  { rank_key: 'c_plus', rank_label: 'C+', rank_order: 2, rp_threshold: 1200, cp_multiplier: 0.5, color: '#969696', icon: '🍀' },
  { rank_key: 'b_minus', rank_label: 'B-', rank_order: 3, rp_threshold: 2500, cp_multiplier: 0.6, color: '#4A9BD9', icon: '🔵' },
  { rank_key: 'b', rank_label: 'B', rank_order: 4, rp_threshold: 4000, cp_multiplier: 0.7, color: '#3D8BC9', icon: '💎' },
  { rank_key: 'b_plus', rank_label: 'B+', rank_order: 5, rp_threshold: 6000, cp_multiplier: 0.8, color: '#2E7AB8', icon: '💠' },
  { rank_key: 'a_minus', rank_label: 'A-', rank_order: 6, rp_threshold: 9000, cp_multiplier: 0.9, color: '#9B59B6', icon: '🔮' },
  { rank_key: 'a', rank_label: 'A', rank_order: 7, rp_threshold: 13000, cp_multiplier: 1.0, color: '#8E44AD', icon: '⚡' },
  { rank_key: 'a_plus', rank_label: 'A+', rank_order: 8, rp_threshold: 18000, cp_multiplier: 1.1, color: '#7D3C98', icon: '🌟' },
  { rank_key: 's_minus', rank_label: 'S-', rank_order: 9, rp_threshold: 25000, cp_multiplier: 1.2, color: '#F39C12', icon: '🏅' },
  { rank_key: 's', rank_label: 'S', rank_order: 10, rp_threshold: 33000, cp_multiplier: 1.3, color: '#E67E22', icon: '👑' },
  { rank_key: 's_plus', rank_label: 'S+', rank_order: 11, rp_threshold: 42000, cp_multiplier: 1.4, color: '#E74C3C', icon: '🐉' },
  { rank_key: 'x', rank_label: 'X', rank_order: 12, rp_threshold: 60000, cp_multiplier: 1.75, color: '#FF0000', icon: '✦' },
]

/** RPルールのデフォルトシード（仕様書準拠） */
const DEFAULT_RP_RULES = [
  { action: 'message', label: 'メッセージ送信', icon: '💬', rp_amount: 5, cooldown: 60, daily_cap: 0 },
  { action: 'reaction_receive', label: 'リアクション受信', icon: '⭐', rp_amount: 3, cooldown: 0, daily_cap: 0 },
  { action: 'voice_join', label: 'ボイス参加（/分）', icon: '🎤', rp_amount: 1, cooldown: 0, daily_cap: 60 },
  { action: 'thread_create', label: 'スレッド作成', icon: '🧵', rp_amount: 10, cooldown: 300, daily_cap: 0 },
  { action: 'contest_participate', label: 'コンテスト参加', icon: '🏆', rp_amount: 100, cooldown: 0, daily_cap: 0 },
]

/** デフォルトのシーズンボーナス配分（CP配布、仕様書準拠） */
const DEFAULT_BONUS_DISTRIBUTION = {
  rank_bonuses: {
    x: 50000, s_plus: 40000, s: 35000, s_minus: 30000,
    a_plus: 25000, a: 20000, a_minus: 15000,
    b_plus: 10000, b: 8000, b_minus: 6000,
    c_plus: 4000, c: 2000, c_minus: 0
  },
  top_bonuses: [
    { rank_from: 1, rank_to: 1, bonus: 50000, label: '1位' },
    { rank_from: 2, rank_to: 2, bonus: 20000, label: '2位' },
    { rank_from: 3, rank_to: 3, bonus: 10000, label: '3位' },
    { rank_from: 4, rank_to: 10, bonus: 5000, label: 'TOP10' },
  ]
}

// --- ヘルパー: 累積RPからランクを判定する ---

/**
 * ランク設定配列と累積RPからランクを判定する
 * @param {Array} config - ランク設定配列（rank_order昇順）
 * @param {number} currentRp - 累積RP
 * @returns {{ rank: Object, index: number }} マッチしたランクとそのインデックス
 */
function resolveRank(config, currentRp) {
  let matched = config[0]
  let matchedIdx = 0
  for (let i = 0; i < config.length; i++) {
    if (currentRp >= (config[i].rp_threshold ?? 0)) {
      matched = config[i]
      matchedIdx = i
    }
  }
  return { rank: matched, index: matchedIdx }
}

// --- ランク設定 ---

/**
 * ギルドのランク設定を取得する（なければデフォルトをシードする）
 */
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

/**
 * ギルドのランク設定を全置換する
 */
export function updateRankConfig(guildId, ranks) {
  const db = getDb()
  const del = db.prepare('DELETE FROM rank_config WHERE guild_id = ?')
  const ins = db.prepare('INSERT INTO rank_config (guild_id, rank_key, rank_label, rank_order, rp_threshold, cp_multiplier, color, icon) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
  const tx = db.transaction(() => {
    del.run(guildId)
    for (const r of ranks) {
      ins.run(guildId, r.rank_key, r.rank_label, r.rank_order, r.rp_threshold ?? 0, r.cp_multiplier, r.color || '#808080', r.icon || '⭐')
    }
  })
  tx()
}

/**
 * ランク階層を1つ追加する
 */
export function addRankTier(guildId, data) {
  const db = getDb()
  db.prepare('INSERT INTO rank_config (guild_id, rank_key, rank_label, rank_order, rp_threshold, cp_multiplier, color, icon) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(guildId, data.rank_key, data.rank_label, data.rank_order, data.rp_threshold ?? 0, data.cp_multiplier, data.color || '#808080', data.icon || '⭐')
}

/**
 * ランク階層を1つ削除する
 */
export function removeRankTier(guildId, rankKey) {
  const db = getDb()
  db.prepare('DELETE FROM rank_config WHERE guild_id = ? AND rank_key = ?').run(guildId, rankKey)
}

// --- Xランク専用設定 ---

/**
 * Xランク設定を取得する（なければデフォルトを作成）
 */
export function getXRankConfig(guildId) {
  const db = getDb()
  let row = db.prepare('SELECT * FROM x_rank_config WHERE guild_id = ?').get(guildId)
  if (!row) {
    db.prepare('INSERT INTO x_rank_config (guild_id, max_rp, entry_rp, demotion_threshold, tiers) VALUES (?, ?, ?, ?, ?)')
      .run(guildId, DEFAULT_X_RANK_CONFIG.max_rp, DEFAULT_X_RANK_CONFIG.entry_rp, DEFAULT_X_RANK_CONFIG.demotion_threshold, JSON.stringify(DEFAULT_X_RANK_CONFIG.tiers))
    row = db.prepare('SELECT * FROM x_rank_config WHERE guild_id = ?').get(guildId)
  }
  return { ...row, tiers: JSON.parse(row.tiers || '[]') }
}

/**
 * Xランク設定を更新する
 */
export function updateXRankConfig(guildId, data) {
  const db = getDb()
  getXRankConfig(guildId) // ensure exists
  db.prepare('UPDATE x_rank_config SET max_rp = ?, entry_rp = ?, demotion_threshold = ?, tiers = ? WHERE guild_id = ?')
    .run(data.max_rp ?? 3000, data.entry_rp ?? 1000, data.demotion_threshold ?? 0, JSON.stringify(data.tiers || []), guildId)
}

/**
 * Xランク内のCP倍率をサブティアから判定する
 */
function resolveXCpMultiplier(xRankConfig, xRp, fallbackMultiplier) {
  if (!xRankConfig || !xRankConfig.tiers || xRankConfig.tiers.length === 0) return fallbackMultiplier
  for (const tier of xRankConfig.tiers) {
    if (xRp >= tier.min && xRp <= tier.max) return tier.cp_multiplier
  }
  // 範囲外なら最後のティアの倍率
  return xRankConfig.tiers[xRankConfig.tiers.length - 1].cp_multiplier
}

/**
 * Xランク内のサブティアラベルを判定する
 */
function resolveXTierLabel(xRankConfig, xRp) {
  if (!xRankConfig || !xRankConfig.tiers || xRankConfig.tiers.length === 0) return null
  for (const tier of xRankConfig.tiers) {
    if (xRp >= tier.min && xRp <= tier.max) return tier.label
  }
  return xRankConfig.tiers[xRankConfig.tiers.length - 1].label
}

// --- 減衰設定 ---

/**
 * ギルドの減衰設定を取得する（なければデフォルトを作成）
 */
export function getRankSettings(guildId) {
  const db = getDb()
  let settings = db.prepare('SELECT * FROM rank_settings WHERE guild_id = ?').get(guildId)
  if (!settings) {
    db.prepare('INSERT INTO rank_settings (guild_id) VALUES (?)').run(guildId)
    settings = db.prepare('SELECT * FROM rank_settings WHERE guild_id = ?').get(guildId)
  }
  return settings
}

/**
 * ギルドの減衰設定を更新する
 */
export function updateRankSettings(guildId, s) {
  const db = getDb()
  db.prepare('UPDATE rank_settings SET decay_rate = ?, decay_grace_days = ?, decay_floor = ? WHERE guild_id = ?')
    .run(s.decay_rate ?? 0.02, s.decay_grace_days ?? 5, s.decay_floor ?? 0, guildId)
}

// --- RPルール ---

/**
 * ギルドのRPルールを取得する（なければデフォルトをシードする）
 */
export function getRpRules(guildId) {
  const db = getDb()
  let rows = db.prepare('SELECT * FROM rp_rules WHERE guild_id = ? ORDER BY id ASC').all(guildId)
  if (rows.length === 0) {
    const stmt = db.prepare('INSERT INTO rp_rules (guild_id, action, label, icon, rp_amount, cooldown, daily_cap, enabled) VALUES (?, ?, ?, ?, ?, ?, ?, 1)')
    const tx = db.transaction(() => {
      for (const r of DEFAULT_RP_RULES) {
        stmt.run(guildId, r.action, r.label, r.icon, r.rp_amount, r.cooldown, r.daily_cap || 0)
      }
    })
    tx()
    rows = db.prepare('SELECT * FROM rp_rules WHERE guild_id = ? ORDER BY id ASC').all(guildId)
  }
  return rows.map(r => ({ ...r, enabled: !!r.enabled }))
}

/**
 * ギルドのRPルールを一括更新する
 */
export function updateRpRules(guildId, rules) {
  const db = getDb()
  const stmt = db.prepare('UPDATE rp_rules SET rp_amount = ?, cooldown = ?, daily_cap = ?, enabled = ? WHERE guild_id = ? AND action = ?')
  for (const r of rules) {
    stmt.run(r.rp_amount, r.cooldown || 0, r.daily_cap || 0, r.enabled ? 1 : 0, guildId, r.action)
  }
}

/**
 * RPルールを1つ追加する
 */
export function createRpRule(guildId, data) {
  const db = getDb()
  const result = db.prepare('INSERT INTO rp_rules (guild_id, action, label, icon, rp_amount, cooldown, daily_cap, enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(guildId, data.action, data.label, data.icon || '⭐', data.rp_amount || 10, data.cooldown || 0, data.daily_cap || 0, data.enabled !== false ? 1 : 0)
  return db.prepare('SELECT * FROM rp_rules WHERE id = ?').get(result.lastInsertRowid)
}

/**
 * RPルールを1つ削除する
 */
export function deleteRpRule(guildId, ruleId) {
  const db = getDb()
  db.prepare('DELETE FROM rp_rules WHERE id = ? AND guild_id = ?').run(ruleId, guildId)
}

// --- ランク情報取得 ---

/**
 * rank_keyからランク設定情報を取得する
 */
export function getRankInfo(guildId, rankKey) {
  const config = getRankConfig(guildId)
  return config.find(r => r.rank_key === rankKey) || config[0]
}

/**
 * 累積RPからランクを判定する
 */
export function determineRank(guildId, currentRp) {
  const config = getRankConfig(guildId)
  return resolveRank(config, currentRp).rank
}

// --- メンバーランク ---

/**
 * メンバーのランク情報を取得する（なければ作成）
 * 累積RPからランクを再判定し、ズレがあれば自動修正する
 * Xランクの場合はサブティア情報も返す
 */
export function getMemberRank(guildId, userId) {
  const db = getDb()
  let row = db.prepare('SELECT * FROM member_ranks WHERE guild_id = ? AND user_id = ?').get(guildId, userId)
  if (!row) {
    db.prepare('INSERT INTO member_ranks (guild_id, user_id) VALUES (?, ?)').run(guildId, userId)
    row = db.prepare('SELECT * FROM member_ranks WHERE guild_id = ? AND user_id = ?').get(guildId, userId)
  }

  const config = getRankConfig(guildId)
  const { rank: currentRank, index: currentIdx } = resolveRank(config, row.current_rp)

  // ランクキーがズレていたら自動修正
  if (row.current_rank_key !== currentRank.rank_key) {
    db.prepare('UPDATE member_ranks SET current_rank_key = ?, last_recalculated = CURRENT_TIMESTAMP WHERE guild_id = ? AND user_id = ?')
      .run(currentRank.rank_key, guildId, userId)
    row.current_rank_key = currentRank.rank_key
  }

  const nextRank = currentIdx < config.length - 1 ? config[currentIdx + 1] : null
  const isMaxRank = !nextRank
  const isXRank = currentRank.rank_key === 'x'

  // Xランクの場合: サブティア情報を追加
  let xRankInfo = null
  let effectiveCpMultiplier = currentRank.cp_multiplier
  if (isXRank) {
    const xConfig = getXRankConfig(guildId)
    const xRp = row.x_rp ?? 0
    effectiveCpMultiplier = resolveXCpMultiplier(xConfig, xRp, currentRank.cp_multiplier)
    xRankInfo = {
      x_rp: xRp,
      x_max_rp: xConfig.max_rp,
      x_tier_label: resolveXTierLabel(xConfig, xRp),
      x_demotion_threshold: xConfig.demotion_threshold,
    }
  }

  return {
    ...row,
    decay_exempt: !!row.decay_exempt,
    rank_label: currentRank.rank_label,
    cp_multiplier: effectiveCpMultiplier,
    base_cp_multiplier: currentRank.cp_multiplier,
    color: currentRank.color,
    icon: currentRank.icon,
    rank_order: currentRank.rank_order,
    rp_threshold: currentRank.rp_threshold ?? 0,
    next_rp_threshold: nextRank ? (nextRank.rp_threshold ?? 0) : null,
    next_rank_label: nextRank ? nextRank.rank_label : null,
    is_max_rank: isMaxRank,
    is_x_rank: isXRank,
    ...xRankInfo,
  }
}

// --- RP付与 ---

/**
 * RPを付与し、累積RPに基づいてランクを再判定する
 * Xランクの場合はx_rpに加算し、降格チェックも行う
 *
 * @param {string} guildId - ギルドID
 * @param {string} userId - ユーザーID
 * @param {number} amount - 付与するRP（負の値で減算）
 * @param {string} source - RP獲得元（例: 'message', 'admin'）
 * @param {string} description - 説明テキスト
 * @returns {Object} 結果
 */
export function addRp(guildId, userId, amount, source, description = '') {
  const db = getDb()
  getMemberRank(guildId, userId)

  const beforeRow = db.prepare('SELECT current_rp, current_rank_key, x_rp FROM member_ranks WHERE guild_id = ? AND user_id = ?').get(guildId, userId)
  const previousRankKey = beforeRow.current_rank_key
  const config = getRankConfig(guildId)
  const xConfig = getXRankConfig(guildId)

  // Xランク判定用の閾値を取得
  const xRankConfig = config.find(r => r.rank_key === 'x')
  const xThreshold = xRankConfig ? (xRankConfig.rp_threshold ?? 0) : Infinity

  let newRp = beforeRow.current_rp
  let newXRp = beforeRow.x_rp
  let newRankKey

  if (beforeRow.current_rank_key === 'x' && beforeRow.x_rp !== null) {
    // === Xランク中: x_rpに加算 ===
    newXRp = Math.max(0, Math.min((beforeRow.x_rp || 0) + amount, xConfig.max_rp))

    // 降格チェック: x_rp <= demotion_threshold で S+ に降格
    if (newXRp <= xConfig.demotion_threshold) {
      // S+に降格: 累積RPをX閾値の1つ下に設定、x_rpをクリア
      const s_plus = config.find(r => r.rank_key === 's_plus')
      newRp = xThreshold - 1
      newXRp = null
      newRankKey = s_plus ? s_plus.rank_key : resolveRank(config, newRp).rank.rank_key
    } else {
      newRankKey = 'x'
    }
  } else {
    // === 通常ランク: 累積RPに加算 ===
    newRp = Math.max(0, beforeRow.current_rp + amount)
    const { rank: newRankConfig } = resolveRank(config, newRp)
    newRankKey = newRankConfig.rank_key

    // Xランク昇格チェック: 累積RPがX閾値に到達
    if (newRankKey === 'x' && previousRankKey !== 'x') {
      newXRp = xConfig.entry_rp
    }
  }

  // DB更新
  db.prepare('UPDATE member_ranks SET current_rp = ?, current_rank_key = ?, x_rp = ?, last_recalculated = CURRENT_TIMESTAMP WHERE guild_id = ? AND user_id = ?')
    .run(newRp, newRankKey, newXRp, guildId, userId)

  // トランザクション記録
  db.prepare('INSERT INTO rp_transactions (guild_id, user_id, amount, source, description) VALUES (?, ?, ?, ?, ?)')
    .run(guildId, userId, amount, source, description)

  // CP倍率はXランクの場合サブティアで決まる
  let cpMultiplier
  if (newRankKey === 'x' && newXRp !== null) {
    cpMultiplier = resolveXCpMultiplier(xConfig, newXRp, xRankConfig?.cp_multiplier ?? 1.75)
  } else {
    const { rank } = resolveRank(config, newRp)
    cpMultiplier = rank.cp_multiplier
  }

  return {
    rp_added: amount,
    current_rp: newRp,
    x_rp: newXRp,
    rank_key: newRankKey,
    rank_label: config.find(r => r.rank_key === newRankKey)?.rank_label || newRankKey,
    cp_multiplier: cpMultiplier,
    rank_changed: newRankKey !== previousRankKey,
    previous_rank_key: previousRankKey,
  }
}

// --- CP倍率取得 ---

/**
 * メンバーのCP倍率を取得する（Xランクはサブティアで判定）
 */
export function getCpMultiplier(guildId, userId) {
  const db = getDb()
  const row = db.prepare('SELECT current_rp, current_rank_key, x_rp FROM member_ranks WHERE guild_id = ? AND user_id = ?').get(guildId, userId)
  if (!row) return 1.0
  const config = getRankConfig(guildId)
  const { rank } = resolveRank(config, row.current_rp)

  if (row.current_rank_key === 'x' && row.x_rp !== null) {
    const xConfig = getXRankConfig(guildId)
    return resolveXCpMultiplier(xConfig, row.x_rp, rank.cp_multiplier)
  }
  return rank.cp_multiplier
}

// --- 日次RP上限チェック ---

/**
 * 特定アクションの今日のRP獲得合計を取得する
 */
export function getDailyRpTotal(guildId, userId, source) {
  const db = getDb()
  const today = new Date().toISOString().split('T')[0]
  const result = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM rp_transactions
    WHERE guild_id = ? AND user_id = ? AND source = ? AND DATE(created_at) = ?
  `).get(guildId, userId, source, today)
  return result.total
}

// --- 減衰処理 ---

/**
 * ギルド全体のRP減衰を適用する
 * 累積RPに減衰率を適用し、ランクを再判定する
 */
export function applyDecay(guildId) {
  const db = getDb()
  const settings = getRankSettings(guildId)
  const config = getRankConfig(guildId)
  const graceDate = new Date()
  graceDate.setDate(graceDate.getDate() - settings.decay_grace_days)
  const graceDateStr = graceDate.toISOString().split('T')[0]

  // 免除期限切れの処理
  db.prepare(`UPDATE member_ranks SET decay_exempt = 0
    WHERE guild_id = ? AND decay_exempt = 1 AND decay_exempt_until IS NOT NULL AND decay_exempt_until <= ?`)
    .run(guildId, new Date().toISOString())

  // 減衰対象のメンバーを取得（非免除 & 猶予期間超過）
  const members = db.prepare(`
    SELECT mr.user_id, mr.current_rp, mr.current_rank_key, mr.x_rp FROM member_ranks mr
    LEFT JOIN member_points mp ON mr.guild_id = mp.guild_id AND mr.user_id = mp.user_id
    WHERE mr.guild_id = ? AND mr.decay_exempt = 0
    AND (mp.last_active IS NULL OR DATE(mp.last_active) < ?)
  `).all(guildId, graceDateStr)

  const updateStmt = db.prepare('UPDATE member_ranks SET current_rp = ?, current_rank_key = ?, x_rp = ?, last_recalculated = CURRENT_TIMESTAMP WHERE guild_id = ? AND user_id = ?')
  const xConfig = getXRankConfig(guildId)
  const xRankConfig = config.find(r => r.rank_key === 'x')
  const xThreshold = xRankConfig ? (xRankConfig.rp_threshold ?? 0) : Infinity

  let decayedCount = 0
  for (const m of members) {
    let newRp = m.current_rp
    let newXRp = m.x_rp
    let newRankKey = m.current_rank_key

    if (m.current_rank_key === 'x' && m.x_rp !== null) {
      // Xランク: x_rpに減衰適用
      newXRp = Math.floor(m.x_rp * (1 - settings.decay_rate))
      newXRp = Math.max(newXRp, 0)

      // 降格チェック
      if (newXRp <= xConfig.demotion_threshold) {
        const s_plus = config.find(r => r.rank_key === 's_plus')
        newRp = xThreshold - 1
        newXRp = null
        newRankKey = s_plus ? s_plus.rank_key : resolveRank(config, newRp).rank.rank_key
      }
    } else {
      // 通常ランク: 累積RPに減衰適用
      newRp = Math.floor(m.current_rp * (1 - settings.decay_rate))
      newRp = Math.max(newRp, settings.decay_floor)
      const { rank: newRankConfig } = resolveRank(config, newRp)
      newRankKey = newRankConfig.rank_key
    }

    if (newRp !== m.current_rp || newXRp !== m.x_rp || newRankKey !== m.current_rank_key) {
      updateStmt.run(newRp, newRankKey, newXRp, guildId, m.user_id)
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

/**
 * RPリーダーボードを取得する（累積RP降順）
 */
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
    db.prepare('INSERT INTO season_config (guild_id, cycle_value, bonus_distribution) VALUES (?, ?, ?)')
      .run(guildId, 1, JSON.stringify(DEFAULT_BONUS_DISTRIBUTION))
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
    data.enabled ? 1 : 0, data.cycle_type || 'months', data.cycle_value || 1,
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

/**
 * シーズン終了チェック＆実行
 * ボーナスはCPとして配布する（addPoints経由）
 */
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
  const seasonNum = getSeasonNumber(guildId)

  for (let i = 0; i < members.length; i++) {
    const m = members[i]
    const position = i + 1
    let bonus = 0

    // ランク帯ボーナス（CP）
    if (dist.rank_bonuses && dist.rank_bonuses[m.current_rank_key]) {
      bonus += dist.rank_bonuses[m.current_rank_key]
    }

    // TOP順位ボーナス（CP）
    if (dist.top_bonuses) {
      for (const tb of dist.top_bonuses) {
        if (position >= tb.rank_from && position <= tb.rank_to) {
          bonus += tb.bonus
          break
        }
      }
    }

    if (bonus > 0) {
      // CPとして配布（addPoints経由）
      getOrCreateMember(guildId, m.user_id, m.username || '', m.display_name || '', m.avatar || '')
      addPoints(guildId, m.user_id, bonus, 'season_bonus', `シーズン${seasonNum} ボーナスCP`)
    }

    results.push({
      user_id: m.user_id,
      username: m.username || m.display_name || m.user_id,
      rank_key: m.current_rank_key,
      rp: m.current_rp,
      position,
      bonus_cp: bonus,
    })
  }

  // 履歴記録
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

/**
 * 全メンバーのランクを累積RPから再判定する（Xランクのx_rpは維持）
 */
export function recalculateAllRanks(guildId) {
  const db = getDb()
  const config = getRankConfig(guildId)
  const members = db.prepare('SELECT * FROM member_ranks WHERE guild_id = ?').all(guildId)
  const stmt = db.prepare('UPDATE member_ranks SET current_rank_key = ?, last_recalculated = CURRENT_TIMESTAMP WHERE guild_id = ? AND user_id = ?')
  let fixedCount = 0
  for (const m of members) {
    // Xランクでx_rpがある場合はそのまま維持
    if (m.current_rank_key === 'x' && m.x_rp !== null) continue

    const { rank: correctRank } = resolveRank(config, m.current_rp)
    if (m.current_rank_key !== correctRank.rank_key) {
      stmt.run(correctRank.rank_key, guildId, m.user_id)
      fixedCount++
    }
  }
  return members.length
}
