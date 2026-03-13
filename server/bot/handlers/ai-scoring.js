/**
 * AI発言品質採点エンジン
 * メッセージをキューに入れ、バックグラウンドでAI APIを呼んで採点する
 */

import { decryptSecret } from '../client.js'

// In-memory queue: array of { guildId, userId, channelId, messageId, content }
const scoringQueue = []

/**
 * Start the scoring worker (call once on bot setup)
 * @param {object} dbHelpers - DB functions
 */
export function startScoringWorker(dbHelpers) {
  setInterval(async () => {
    if (scoringQueue.length === 0) return
    const item = scoringQueue.shift()
    try {
      await processScoring(item, dbHelpers)
    } catch (err) {
      console.error('AI scoring error:', err.message)
    }
  }, 5000) // every 5 seconds
}

/**
 * Add a message to the scoring queue (called from message handler)
 * Checks eligibility: enabled, channel mode, min length, sampling rate, daily limits
 * @param {import('discord.js').Message} message
 * @param {object} dbHelpers
 */
export function enqueueForScoring(message, dbHelpers) {
  const guildId = message.guild?.id
  if (!guildId) return

  let settings
  try {
    settings = dbHelpers.getAiScoringSettings(guildId)
  } catch { return }

  if (!settings || !settings.enabled || !settings.apiKeyEncrypted) return

  const content = message.content || ''

  // Min length check
  if (content.length < settings.minLength) return

  // Channel mode check
  const channelId = message.channel.id
  if (settings.channelMode === 'whitelist') {
    if (!settings.channels.includes(channelId)) return
  } else if (settings.channelMode === 'blacklist') {
    if (settings.channels.includes(channelId)) return
  }

  // Sampling rate (percentage)
  if (settings.samplingRate < 100 && Math.random() * 100 > settings.samplingRate) return

  // Daily API limit
  const dailyCount = dbHelpers.getDailyApiCount(guildId)
  if (dailyCount >= settings.dailyApiLimit) return

  // Per-user daily limit
  const userCount = dbHelpers.getUserDailyScoringCount(guildId, message.author.id)
  if (userCount >= settings.perUserDailyLimit) return

  scoringQueue.push({
    guildId,
    userId: message.author.id,
    channelId,
    messageId: message.id,
    content
  })
}

/**
 * Process a single scoring item: call AI API, parse result, award RP
 * @param {object} item - { guildId, userId, channelId, messageId, content }
 * @param {object} dbHelpers - DB functions
 */
async function processScoring(item, dbHelpers) {
  const settings = dbHelpers.getAiScoringSettings(item.guildId)
  if (!settings || !settings.enabled) return

  const apiKey = decryptSecret(settings.apiKeyEncrypted)
  if (!apiKey) return

  const { score, reason } = await callAiApi(settings, apiKey, item)

  // Determine RP bonus from bonusTiers (find highest tier where score >= min_score)
  let rpAwarded = 0
  if (settings.bonusTiers && settings.bonusTiers.length > 0) {
    const sorted = [...settings.bonusTiers].sort((a, b) => b.min_score - a.min_score)
    for (const tier of sorted) {
      if (score >= tier.min_score) {
        rpAwarded = tier.rp
        break
      }
    }
  }

  // Low quality threshold: no RP
  if (score <= settings.lowQualityThreshold) {
    rpAwarded = 0
  }

  // Award RP if earned
  if (rpAwarded > 0) {
    dbHelpers.addRp(
      item.guildId,
      item.userId,
      rpAwarded,
      'ai_scoring',
      `AI採点ボーナス (スコア: ${score})`
    )
  }

  // Save scoring result
  dbHelpers.addScoringResult(
    item.guildId, item.userId, item.channelId, item.messageId,
    item.content.substring(0, 200), score, reason, rpAwarded
  )
}

/**
 * Call the AI API (Anthropic or OpenAI) to score a message
 * @param {object} settings - AI scoring settings including provider, model, prompt
 * @param {string} apiKey - Decrypted API key
 * @param {object} item - { content }
 * @returns {Promise<{ score: number, reason: string }>}
 */
async function callAiApi(settings, apiKey, item) {
  const { provider, model, prompt } = settings
  let responseText

  if (provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model,
        max_tokens: 100,
        messages: [
          { role: 'user', content: `${prompt}\n\nメッセージ: "${item.content}"` }
        ]
      })
    })
    const data = await res.json()
    responseText = data.content?.[0]?.text || ''
  } else {
    // OpenAI
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model,
        max_tokens: 100,
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: item.content }
        ]
      })
    })
    const data = await res.json()
    responseText = data.choices?.[0]?.message?.content || ''
  }

  return parseAiResponse(responseText)
}

/**
 * Parse AI response text to extract score and reason
 * @param {string} text - Raw AI response
 * @returns {{ score: number, reason: string }}
 */
function parseAiResponse(text) {
  // Try JSON parse first
  try {
    const parsed = JSON.parse(text)
    if (typeof parsed.score === 'number' && typeof parsed.reason === 'string') {
      return { score: parsed.score, reason: parsed.reason }
    }
  } catch {
    // JSON parse failed, try regex extraction
  }

  // Try to extract score with regex
  const match = text.match(/\d+/)
  if (match) {
    return { score: parseInt(match[0], 10), reason: text }
  }

  // Default fallback
  return { score: 5, reason: 'スコア解析に失敗しました' }
}
