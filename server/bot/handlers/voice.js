/**
 * ボイスチャンネルイベントのハンドラー
 * ボイスチャンネル参加時間に応じたポイント付与を処理する
 */
import { Events } from 'discord.js'

// ボイス参加時刻の追跡用Map: key=`${guildId}:${userId}`, value=参加時のタイムスタンプ
const voiceJoinTimes = new Map()

/**
 * VoiceStateUpdateイベントハンドラーを登録する
 * @param {import('discord.js').Client} client - Discordクライアント
 * @param {object} dbHelpers - db.jsのエクスポート
 * @param {Function} getPointRules - ポイントルール取得関数
 */
export function setupVoiceHandler(client, dbHelpers, getPointRules) {
    client.on(Events.VoiceStateUpdate, (oldState, newState) => {
        const userId = newState.member?.user?.id || oldState.member?.user?.id
        const guildId = newState.guild?.id || oldState.guild?.id
        if (!userId || !guildId) return

        const member = newState.member || oldState.member
        if (member?.user?.bot) return

        const key = `${guildId}:${userId}`

        // ボイスチャンネルに参加した
        if (!oldState.channelId && newState.channelId) {
            voiceJoinTimes.set(key, Date.now())
        }

        // ボイスチャンネルから退出した
        if (oldState.channelId && !newState.channelId) {
            const joinTime = voiceJoinTimes.get(key)
            if (joinTime) {
                const minutes = Math.floor((Date.now() - joinTime) / 60000)
                voiceJoinTimes.delete(key)

                if (minutes > 0) {
                    const rules = getPointRules()
                    const voiceRule = rules.find(r => r.action === 'voice_join' && r.enabled)
                    if (voiceRule) {
                        try {
                            dbHelpers.getOrCreateMember(guildId, userId,
                                member.user.username,
                                member.displayName || member.user.username,
                                member.user.displayAvatarURL({ size: 32 })
                            )
                            // RP付与（分数分、日次上限チェック付き）
                            try {
                                const rpRules = dbHelpers.getRpRules(guildId)
                                const rpRule = rpRules.find(r => r.action === 'voice_join' && r.enabled)
                                if (rpRule) {
                                    let rpToAdd = rpRule.rp_amount * minutes
                                    // 日次上限チェック（daily_cap > 0 の場合）
                                    const dailyCap = rpRule.daily_cap || 0
                                    if (dailyCap > 0) {
                                        const todayTotal = dbHelpers.getDailyRpTotal(guildId, userId, 'voice_join')
                                        const remaining = Math.max(0, dailyCap - todayTotal)
                                        rpToAdd = Math.min(rpToAdd, remaining)
                                    }
                                    if (rpToAdd > 0) {
                                        dbHelpers.addRp(guildId, userId, rpToAdd, 'voice_join', `ボイス参加 (${minutes}分)`)
                                    }
                                }
                            } catch { }
                            // CP付与（ランク倍率適用）
                            let multiplier = 1.0
                            try { multiplier = dbHelpers.getCpMultiplier(guildId, userId) } catch { }
                            const points = voiceRule.points * minutes * multiplier
                            dbHelpers.addPoints(guildId, userId, points, 'earn', `ボイス参加 (${minutes}分)`)
                            dbHelpers.addVoiceMinutes(guildId, userId, minutes)
                        } catch (err) {
                            console.error('Point earn error (voice):', err.message)
                        }
                    }
                }
            }
        }
    })
}
