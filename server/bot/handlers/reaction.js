/**
 * リアクションイベントのハンドラー
 * リアクション付与・受信時のポイント付与を処理する
 */
import { Events } from 'discord.js'
import { checkCooldown } from '../points/cooldown.js'
import { earnPoints } from '../points/earning.js'

/**
 * MessageReactionAddイベントハンドラーを登録する
 * @param {import('discord.js').Client} client - Discordクライアント
 * @param {object} dbHelpers - db.jsのエクスポート
 * @param {Function} getPointRules - ポイントルール取得関数
 */
export function setupReactionHandler(client, dbHelpers, getPointRules) {
    client.on(Events.MessageReactionAdd, async (reaction, user) => {
        if (user.bot || !reaction.message.guild) return

        const guildId = reaction.message.guild.id
        const channelId = reaction.message.channel?.id
        const rules = getPointRules()

        // チャンネル倍率を取得
        const chMultiplier = channelId ? dbHelpers.getChannelMultiplier(guildId, channelId) : 1.0

        // リアクションを付けた人にポイント
        const giveRule = rules.find(r => r.action === 'reaction_give' && r.enabled)
        if (giveRule && checkCooldown(guildId, user.id, 'reaction_give', giveRule.cooldown)) {
            try {
                earnPoints(
                    dbHelpers, guildId, user.id,
                    user.username, user.username,
                    user.displayAvatarURL({ size: 32 }),
                    giveRule.points * chMultiplier, 'リアクション付与', 'reaction_give',
                    giveRule
                )
            } catch (err) {
                console.error('Point earn error (reaction_give):', err.message)
            }
        }

        // リアクションを受けた人にポイント
        const receiveRule = rules.find(r => r.action === 'reaction_receive' && r.enabled)
        if (receiveRule && reaction.message.author && !reaction.message.author.bot) {
            const receiverId = reaction.message.author.id
            if (receiverId !== user.id && checkCooldown(guildId, receiverId, 'reaction_receive', receiveRule.cooldown)) {
                try {
                    earnPoints(
                        dbHelpers, guildId, receiverId,
                        reaction.message.author.username,
                        reaction.message.author.username,
                        reaction.message.author.displayAvatarURL({ size: 32 }),
                        receiveRule.points * chMultiplier, 'リアクション受信', 'reaction_receive',
                        receiveRule
                    )
                } catch (err) {
                    console.error('Point earn error (reaction_receive):', err.message)
                }
            }
        }
    })
}
