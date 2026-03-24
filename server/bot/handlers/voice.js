/**
 * ボイスチャンネルイベントのハンドラー
 * ボイスチャンネル参加時間に応じたポイント付与を処理する
 *
 * 不正取得対策:
 * - 最低人数チェック（設定可能、デフォルト2人）
 * - ミュート/デフ状態チェック
 * - AFKチャンネル除外
 * - アクティビティ要件（設定可能、最後のメッセージ送信からN分以内）
 */
import { ChannelType } from 'discord.js'

/** ユーザーごとの最終メッセージ送信時刻を追跡 */
const lastMessageTime = new Map()

/** デバッグログのリングバッファ（直近100件） */
const voiceDebugLog = []
const MAX_LOG_SIZE = 100

/** デバッグモードのON/OFF */
let debugMode = false

/** デバッグモードを切り替える */
export function setVoiceDebugMode(enabled) { debugMode = enabled }

/** デバッグモードの状態を返す */
export function getVoiceDebugMode() { return debugMode }

/** デバッグログを取得する */
export function getVoiceDebugLog() { return [...voiceDebugLog] }

/** デバッグログをクリアする */
export function clearVoiceDebugLog() { voiceDebugLog.length = 0 }

/** Mapの上限（メモリリーク防止） */
const MAX_MAP_SIZE = 10000

/**
 * メッセージ送信時刻を記録する（外部から呼ばれる）
 * @param {string} guildId
 * @param {string} userId
 */
export function recordMessageActivity(guildId, userId) {
  const key = `${guildId}:${userId}`
  lastMessageTime.set(key, Date.now())
  if (lastMessageTime.size > MAX_MAP_SIZE) {
    const oldest = lastMessageTime.keys().next().value
    lastMessageTime.delete(oldest)
  }
}

/**
 * ボイス監視タイマーを登録する
 */
export function setupVoiceHandler(client, dbHelpers, getPointRules) {
  // 毎分チェックで eligible なユーザーにポイント付与
  setInterval(() => {
    try {
      for (const [, guild] of client.guilds.cache) {
        const guildId = guild.id
        const rules = getPointRules()
        const voiceRule = rules.find(r => r.action === 'voice_join' && r.enabled)
        if (!voiceRule) continue

        // ボイス設定を取得
        let voiceSettings
        try {
          voiceSettings = dbHelpers.getEconomySettings(guildId)
        } catch {
          voiceSettings = {}
        }
        const minMembers = voiceSettings.voice_min_members || 2
        const requireActivity = !!voiceSettings.voice_require_activity
        const activityTimeout = (voiceSettings.voice_activity_timeout_minutes || 30) * 60 * 1000
        const now = Date.now()

        for (const [, channel] of guild.channels.cache) {
          // ボイスチャンネルのみ
          if (channel.type !== ChannelType.GuildVoice && channel.type !== ChannelType.GuildStageVoice) continue
          // AFKチャンネル除外
          if (channel.id === guild.afkChannelId) continue

          // 条件を満たすメンバーをフィルタ
          const allMembers = channel.members.filter(m => !m.user.bot)
          const eligible = allMembers.filter(m => {
            if (m.voice.selfMute || m.voice.selfDeaf) return false
            if (m.voice.serverMute || m.voice.serverDeaf) return false

            // アクティビティ要件チェック
            if (requireActivity) {
              const key = `${guildId}:${m.id}`
              const lastMsg = lastMessageTime.get(key)
              if (!lastMsg || (now - lastMsg) > activityTimeout) return false
            }

            return true
          })

          // デバッグログ（ON時のみ、チャンネルに人がいる場合のみ）
          if (debugMode && allMembers.size > 0) {
            const excluded = allMembers.filter(m => !eligible.has(m.id))
            const details = {
              timestamp: new Date().toISOString(),
              channel: channel.name,
              total: allMembers.size,
              eligible: eligible.size,
              minRequired: minMembers,
              awarded: eligible.size >= minMembers,
              members: allMembers.map(m => ({
                username: m.user.username,
                eligible: eligible.has(m.id),
                selfMute: m.voice.selfMute,
                selfDeaf: m.voice.selfDeaf,
                serverMute: m.voice.serverMute,
                serverDeaf: m.voice.serverDeaf,
              })),
            }
            voiceDebugLog.push(details)
            if (voiceDebugLog.length > MAX_LOG_SIZE) voiceDebugLog.shift()
          }

          // 最低人数チェック
          if (eligible.size < minMembers) continue

          for (const [userId, member] of eligible) {
            try {
              dbHelpers.getOrCreateMember(guildId, userId,
                member.user.username,
                member.displayName || member.user.username,
                member.user.displayAvatarURL({ size: 32 })
              )

              // RP付与（日次上限チェック付き）
              try {
                const rpRules = dbHelpers.getRpRules(guildId)
                const rpRule = rpRules.find(r => r.action === 'voice_join' && r.enabled)
                if (rpRule) {
                  let rpToAdd = rpRule.rp_amount
                  const dailyCap = rpRule.daily_cap || 0
                  if (dailyCap > 0) {
                    const todayTotal = dbHelpers.getDailyRpTotal(guildId, userId, 'voice_join')
                    const remaining = Math.max(0, dailyCap - todayTotal)
                    rpToAdd = Math.min(rpToAdd, remaining)
                  }
                  if (rpToAdd > 0) {
                    dbHelpers.addRp(guildId, userId, rpToAdd, 'voice_join', 'ボイス参加 (1分)')
                  }
                }
              } catch { }

              // CP付与（ランク倍率を先に適用し、倍率後の値で日次上限チェック）
              let multiplier = 1.0
              try { multiplier = dbHelpers.getCpMultiplier(guildId, userId) } catch { }
              let finalPoints = voiceRule.points * multiplier

              const capCount = voiceRule.daily_cap_count || 0
              const capPoints = voiceRule.daily_cap_points || 0
              if (capCount > 0 || capPoints > 0) {
                const stats = dbHelpers.getDailyCpStats(guildId, userId, 'ボイス参加 (1分)')
                if (capCount > 0 && stats.count >= capCount) { dbHelpers.addVoiceMinutes(guildId, userId, 1); continue }
                if (capPoints > 0) {
                  const remaining = capPoints - stats.total
                  if (remaining <= 0) { dbHelpers.addVoiceMinutes(guildId, userId, 1); continue }
                  finalPoints = Math.min(finalPoints, remaining)
                }
              }

              dbHelpers.addPoints(guildId, userId, finalPoints, 'earn', 'ボイス参加 (1分)')
              dbHelpers.addVoiceMinutes(guildId, userId, 1)
            } catch (err) {
              console.error('Voice point error:', err.message)
            }
          }
        }
      }
    } catch (err) {
      console.error('Voice interval error:', err.message)
    }
  }, 60000)
}
