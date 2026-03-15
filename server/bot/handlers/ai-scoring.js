/**
 * AI発言品質採点エンジン
 * メッセージをキューに入れ、バックグラウンドでAI APIを呼んで採点する
 */

import { decryptSecret, getClient } from '../client.js'
import { EmbedBuilder } from 'discord.js'

// In-memory queue: array of { guildId, userId, channelId, messageId, content }
const scoringQueue = []

// キューの最大サイズ（メモリ保護）
const MAX_QUEUE_SIZE = 1000

// ワーカーのインターバルID（クリーンアップ用）
let workerIntervalId = null

/**
 * ワーカーを開始する（Bot起動時に1回呼ぶ）
 * @param {object} dbHelpers - DB操作ヘルパー
 * @returns {NodeJS.Timeout} インターバルID
 */
export function startScoringWorker(dbHelpers) {
  // 既存のワーカーがあればクリア
  if (workerIntervalId) clearInterval(workerIntervalId)

  workerIntervalId = setInterval(async () => {
    if (scoringQueue.length === 0) return
    const item = scoringQueue.shift()
    try {
      await processScoring(item, dbHelpers)
    } catch (err) {
      console.error('AI scoring error:', err.message)
    }
  }, 5000) // 5秒ごと

  return workerIntervalId
}

/**
 * ワーカーを停止する（Bot切断時に呼ぶ）
 */
export function stopScoringWorker() {
  if (workerIntervalId) {
    clearInterval(workerIntervalId)
    workerIntervalId = null
  }
}

/**
 * メッセージを採点キューに追加する（メッセージハンドラから呼ばれる）
 * 対象チェック: 有効化、チャンネルモード、最低文字数、サンプリング率、日次上限
 * @param {import('discord.js').Message} message
 * @param {object} dbHelpers
 */
export function enqueueForScoring(message, dbHelpers) {
  const guildId = message.guild?.id
  if (!guildId) return

  // キューサイズ上限チェック
  if (scoringQueue.length >= MAX_QUEUE_SIZE) return

  let settings
  try {
    settings = dbHelpers.getAiScoringSettings(guildId)
  } catch { return }

  if (!settings || !settings.enabled || !settings.apiKeyEncrypted) return

  const content = message.content || ''

  // 最低文字数チェック
  if (content.length < settings.minLength) return

  // チャンネルモードチェック
  const channelId = message.channel.id
  if (settings.channelMode === 'whitelist') {
    if (!settings.channels.includes(channelId)) return
  } else if (settings.channelMode === 'blacklist') {
    if (settings.channels.includes(channelId)) return
  }

  // サンプリング率（パーセンテージ）
  if (settings.samplingRate < 100 && Math.random() * 100 > settings.samplingRate) return

  // 日次API上限
  const dailyCount = dbHelpers.getDailyApiCount(guildId)
  if (dailyCount >= settings.dailyApiLimit) return

  // ユーザー日次上限
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
 * 1件の採点を処理する: AI APIを呼び、結果をパースし、RPを付与する
 * @param {object} item - { guildId, userId, channelId, messageId, content }
 * @param {object} dbHelpers - DB操作ヘルパー
 */
async function processScoring(item, dbHelpers) {
  const settings = dbHelpers.getAiScoringSettings(item.guildId)
  if (!settings || !settings.enabled) return

  const apiKey = decryptSecret(settings.apiKeyEncrypted)
  if (!apiKey) return

  const { score, reason } = await callAiApi(settings, apiKey, item)

  // スコアを1-10にクランプ（AIが範囲外の値を返す場合の対策）
  const clampedScore = Math.max(1, Math.min(10, score))

  // ボーナスティアからRP付与量を決定（スコアが高い方から順にマッチ）
  let rpAwarded = 0
  if (settings.bonusTiers && settings.bonusTiers.length > 0) {
    const sorted = [...settings.bonusTiers].sort((a, b) => b.min_score - a.min_score)
    for (const tier of sorted) {
      if (clampedScore >= tier.min_score) {
        rpAwarded = tier.rp
        break
      }
    }
  }

  // 低品質閾値以下: RP付与なし
  if (clampedScore <= settings.lowQualityThreshold) {
    rpAwarded = 0
  }

  // RP付与
  if (rpAwarded > 0) {
    dbHelpers.addRp(
      item.guildId,
      item.userId,
      rpAwarded,
      'ai_scoring',
      `AI採点ボーナス (スコア: ${clampedScore})`
    )
  }

  // 採点結果を保存
  dbHelpers.addScoringResult(
    item.guildId, item.userId, item.channelId, item.messageId,
    item.content.substring(0, 200), clampedScore, reason, rpAwarded
  )

  // ログチャンネルへ通知
  await sendScoringNotification(settings, item, clampedScore, reason, rpAwarded)
}

/**
 * 採点結果をログチャンネルに送信する
 */
async function sendScoringNotification(settings, item, score, reason, rpAwarded) {
  if (settings.notifyMode === 'none') return
  if (settings.notifyMode === 'low_only' && score > settings.lowQualityThreshold) return
  if (!settings.logChannelId) return

  const client = getClient()
  if (!client) return

  try {
    const channel = await client.channels.fetch(settings.logChannelId)
    if (!channel) return

    const scoreColor = score <= 3 ? 0xed4245 : score <= 6 ? 0xfee75c : 0x57f287
    const embed = new EmbedBuilder()
      .setTitle('AI採点結果')
      .setColor(scoreColor)
      .addFields(
        { name: 'スコア', value: `${score}/10`, inline: true },
        { name: 'RP付与', value: rpAwarded > 0 ? `+${rpAwarded}` : '-', inline: true },
        { name: 'チャンネル', value: `<#${item.channelId}>`, inline: true },
        { name: 'ユーザー', value: `<@${item.userId}>`, inline: true },
        { name: '理由', value: reason.substring(0, 200) || '不明' },
      )
      .setTimestamp()

    if (item.content) {
      embed.setDescription(item.content.substring(0, 300))
    }

    await channel.send({ embeds: [embed] })
  } catch (err) {
    console.error('AI scoring notification error:', err.message)
  }
}

/**
 * AI APIを呼び出してメッセージを採点する（Anthropic / OpenAI両対応）
 * @param {object} settings - AI採点設定（provider, model, prompt）
 * @param {string} apiKey - 復号済みAPIキー
 * @param {object} item - { content }
 * @returns {Promise<{ score: number, reason: string }>}
 */
async function callAiApi(settings, apiKey, item) {
  const { provider, model, prompt } = settings
  let responseText

  try {
    let res
    if (provider === 'anthropic') {
      res = await fetch('https://api.anthropic.com/v1/messages', {
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
    } else {
      // OpenAI
      res = await fetch('https://api.openai.com/v1/chat/completions', {
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
    }

    // HTTPステータスチェック
    if (!res.ok) {
      const statusText = `${res.status} ${res.statusText}`
      if (res.status === 429) {
        // レートリミット: アイテムをキューの末尾に戻す（リトライ）
        console.warn(`AI scoring rate limited (${statusText}), requeueing`)
        scoringQueue.push(item)
      } else {
        console.error(`AI scoring API error: ${statusText}`)
      }
      return { score: 5, reason: `APIエラー: ${statusText}` }
    }

    const data = await res.json()
    if (provider === 'anthropic') {
      responseText = data.content?.[0]?.text || ''
    } else {
      responseText = data.choices?.[0]?.message?.content || ''
    }
  } catch (err) {
    console.error('AI scoring fetch error:', err.message)
    return { score: 5, reason: `通信エラー: ${err.message}` }
  }

  return parseAiResponse(responseText)
}

/**
 * AIレスポンステキストからスコアと理由を抽出する
 * @param {string} text - 生のAIレスポンス
 * @returns {{ score: number, reason: string }}
 */
function parseAiResponse(text) {
  // JSON形式のパースを試行
  try {
    const parsed = JSON.parse(text)
    if (typeof parsed.score === 'number' && typeof parsed.reason === 'string') {
      return { score: Math.max(1, Math.min(10, parsed.score)), reason: parsed.reason }
    }
  } catch {
    // JSON失敗 → regex抽出を試行
  }

  // 正規表現でスコアを抽出
  const match = text.match(/\d+/)
  if (match) {
    return { score: Math.max(1, Math.min(10, parseInt(match[0], 10))), reason: text }
  }

  // デフォルトフォールバック
  return { score: 5, reason: 'スコア解析に失敗しました' }
}
