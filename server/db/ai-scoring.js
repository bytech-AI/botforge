import { getDb } from './connection.js'

// ============================
// AI Scoring System DB Helpers
// ============================

const DEFAULT_PROMPT = `あなたはDiscordサーバーのメッセージ品質採点者です。
以下のメッセージを1〜10のスケールで採点してください。

採点基準:
- 会話への貢献度（質問、回答、議論への参加）
- 内容の質（情報量、有用性、具体性）
- コミュニティへの価値

低評価の対象:
- スパム、意味のない連投
- 単語のみの反応の繰り返し
- コピペ、無意味な文字列

必ず以下のJSON形式のみで回答してください:
{"score": <1-10の整数>, "reason": "<20文字以内の短い理由>"}`

const DEFAULT_BONUS_TIERS = [
  { min_score: 7, rp: 3 },
  { min_score: 9, rp: 8 },
]

/**
 * AI採点設定を取得する（なければデフォルトを作成）
 */
export function getAiScoringSettings(guildId) {
  const db = getDb()
  let row = db.prepare('SELECT * FROM ai_scoring_settings WHERE guild_id = ?').get(guildId)
  if (!row) {
    db.prepare(`INSERT INTO ai_scoring_settings (guild_id, prompt, bonus_tiers) VALUES (?, ?, ?)`)
      .run(guildId, DEFAULT_PROMPT, JSON.stringify(DEFAULT_BONUS_TIERS))
    row = db.prepare('SELECT * FROM ai_scoring_settings WHERE guild_id = ?').get(guildId)
  }
  let channels = []
  let bonusTiers = []
  try { channels = JSON.parse(row.channels || '[]') } catch { channels = [] }
  try { bonusTiers = JSON.parse(row.bonus_tiers || '[]') } catch { bonusTiers = [] }

  return {
    enabled: !!row.enabled,
    provider: row.provider,
    apiKeyEncrypted: row.api_key_encrypted,
    model: row.model,
    prompt: row.prompt,
    channelMode: row.channel_mode,
    channels,
    minLength: row.min_length,
    samplingRate: row.sampling_rate,
    bonusTiers,
    lowQualityThreshold: row.low_quality_threshold,
    dailyApiLimit: row.daily_api_limit,
    perUserDailyLimit: row.per_user_daily_limit,
    notifyMode: row.notify_mode,
    logChannelId: row.log_channel_id,
  }
}

/**
 * AI採点設定を更新する
 */
export function updateAiScoringSettings(guildId, settings) {
  const db = getDb()
  // ensure row exists
  getAiScoringSettings(guildId)
  db.prepare(`UPDATE ai_scoring_settings SET
    enabled = ?, provider = ?, api_key_encrypted = ?, model = ?, prompt = ?,
    channel_mode = ?, channels = ?, min_length = ?, sampling_rate = ?,
    bonus_tiers = ?, low_quality_threshold = ?, daily_api_limit = ?,
    per_user_daily_limit = ?, notify_mode = ?, log_channel_id = ?
    WHERE guild_id = ?`).run(
    settings.enabled ? 1 : 0,
    settings.provider || 'anthropic',
    settings.apiKeyEncrypted || '',
    settings.model || '',
    settings.prompt || DEFAULT_PROMPT,
    settings.channelMode || 'all',
    JSON.stringify(settings.channels || []),
    settings.minLength || 10,
    settings.samplingRate ?? 1.0,
    JSON.stringify(settings.bonusTiers || []),
    settings.lowQualityThreshold || 3,
    settings.dailyApiLimit || 1000,
    settings.perUserDailyLimit || 50,
    settings.notifyMode || 'none',
    settings.logChannelId || '',
    guildId
  )
}

/**
 * 採点結果を追加する
 */
export function addScoringResult(guildId, userId, channelId, messageId, messagePreview, score, reasoning, rpAwarded) {
  const db = getDb()
  db.prepare(`INSERT INTO ai_scoring_history (guild_id, user_id, channel_id, message_id, message_preview, score, reasoning, rp_awarded)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    guildId, userId, channelId, messageId, messagePreview, score, reasoning, rpAwarded
  )
}

/**
 * 採点履歴を取得する
 */
export function getScoringHistory(guildId, limit = 50) {
  const db = getDb()
  return db.prepare('SELECT * FROM ai_scoring_history WHERE guild_id = ? ORDER BY created_at DESC LIMIT ?')
    .all(guildId, limit)
}

/**
 * 採点統計を取得する
 */
export function getScoringStats(guildId) {
  const db = getDb()
  const today = new Date().toISOString().split('T')[0]
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total_scored,
      COALESCE(AVG(score), 0) as average_score,
      COALESCE(SUM(rp_awarded), 0) as total_rp_awarded
    FROM ai_scoring_history WHERE guild_id = ?
  `).get(guildId)
  const todayResult = db.prepare(`
    SELECT COUNT(*) as today_count
    FROM ai_scoring_history WHERE guild_id = ? AND created_at >= ? AND created_at < ?
  `).get(guildId, today + 'T00:00:00.000Z', today + 'T23:59:59.999Z')
  return {
    totalScored: stats.total_scored,
    averageScore: Math.round(stats.average_score * 100) / 100,
    totalRpAwarded: stats.total_rp_awarded,
    todayCount: todayResult.today_count,
  }
}

/**
 * 今日のギルドのAPI呼び出し回数を取得する
 */
export function getDailyApiCount(guildId) {
  const db = getDb()
  const today = new Date().toISOString().split('T')[0]
  const result = db.prepare(`
    SELECT COUNT(*) as count
    FROM ai_scoring_history WHERE guild_id = ? AND created_at >= ? AND created_at < ?
  `).get(guildId, today + 'T00:00:00.000Z', today + 'T23:59:59.999Z')
  return result.count
}

/**
 * 今日のユーザーの採点回数を取得する
 */
export function getUserDailyScoringCount(guildId, userId) {
  const db = getDb()
  const today = new Date().toISOString().split('T')[0]
  const result = db.prepare(`
    SELECT COUNT(*) as count
    FROM ai_scoring_history WHERE guild_id = ? AND user_id = ? AND created_at >= ? AND created_at < ?
  `).get(guildId, userId, today + 'T00:00:00.000Z', today + 'T23:59:59.999Z')
  return result.count
}
