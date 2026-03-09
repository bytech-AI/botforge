/**
 * メッセージ送信イベントのハンドラー
 * メッセージ送信時のポイント付与と自動応答を処理する
 */
import { Events } from 'discord.js'
import { checkCooldown } from '../points/cooldown.js'
import { earnPoints } from '../points/earning.js'

/**
 * MessageCreateイベントハンドラーを登録する
 * @param {import('discord.js').Client} client - Discordクライアント
 * @param {object} dbHelpers - db.jsのエクスポート
 * @param {Function} getPointRules - ポイントルール取得関数
 */
export function setupMessageHandler(client, dbHelpers, getPointRules) {
    client.on(Events.MessageCreate, (message) => {
        if (message.author.bot || !message.guild) return

        const rules = getPointRules()
        const msgRule = rules.find(r => r.action === 'message' && r.enabled)
        if (!msgRule) return

        if (!checkCooldown(message.guild.id, message.author.id, 'message', msgRule.cooldown)) return

        try {
            earnPoints(
                dbHelpers,
                message.guild.id,
                message.author.id,
                message.author.username,
                message.member?.displayName || message.author.username,
                message.author.displayAvatarURL({ size: 32 }),
                msgRule.points,
                'メッセージ送信'
            )
        } catch (err) {
            console.error('Point earn error (message):', err.message)
        }
    })
}
