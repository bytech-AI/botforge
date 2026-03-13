/**
 * ボイスチャンネルイベントのハンドラー
 * ボイスチャンネル参加時間に応じたポイント付与を処理する
 * 条件: 2人以上 & ミュート解除 & AFKチャンネル除外
 */
import { Events, ChannelType } from 'discord.js'

/**
 * VoiceStateUpdateイベントハンドラーとボイス監視タイマーを登録する
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

                for (const [, channel] of guild.channels.cache) {
                    // ボイスチャンネルのみ
                    if (channel.type !== ChannelType.GuildVoice && channel.type !== ChannelType.GuildStageVoice) continue
                    // AFKチャンネル除外
                    if (channel.id === guild.afkChannelId) continue

                    // 条件を満たすメンバーをフィルタ
                    const eligible = channel.members.filter(m =>
                        !m.user.bot &&
                        !m.voice.selfMute &&
                        !m.voice.selfDeaf &&
                        !m.voice.serverMute &&
                        !m.voice.serverDeaf
                    )

                    // 2人以上いないとカウントしない
                    if (eligible.size < 2) continue

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
                                    let rpToAdd = rpRule.rp_amount // 1分あたり
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

                            // CP付与（ランク倍率適用）
                            let multiplier = 1.0
                            try { multiplier = dbHelpers.getCpMultiplier(guildId, userId) } catch { }
                            const points = voiceRule.points * multiplier
                            dbHelpers.addPoints(guildId, userId, points, 'earn', 'ボイス参加 (1分)')
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
    }, 60000) // 60秒ごと
}
