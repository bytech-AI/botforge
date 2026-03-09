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
 * @param {object} db - SQLiteデータベースインスタンス
 */
export function setupVoiceHandler(client, dbHelpers, getPointRules, db) {
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
                            const points = voiceRule.points * minutes
                            dbHelpers.addPoints(guildId, userId, points, 'earn', `ボイス参加 (${minutes}分)`)
                            // ボイス参加時間を更新
                            db.prepare('UPDATE member_points SET voice_minutes = voice_minutes + ? WHERE guild_id = ? AND user_id = ?')
                                .run(minutes, guildId, userId)
                        } catch (err) {
                            console.error('Point earn error (voice):', err.message)
                        }
                    }
                }
            }
        }
    })
}
