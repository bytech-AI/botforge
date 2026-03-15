/**
 * メッセージ送信イベントのハンドラー
 * メッセージ送信時のポイント付与と自動応答を処理する
 */
import { Events } from 'discord.js'
import { checkCooldown } from '../points/cooldown.js'
import { earnPoints } from '../points/earning.js'
import { checkMessage } from './moderation.js'
import { enqueueForScoring } from './ai-scoring.js'
import { recordMessageActivity } from './voice.js'

/**
 * MessageCreateイベントハンドラーを登録する
 * @param {import('discord.js').Client} client - Discordクライアント
 * @param {object} dbHelpers - db.jsのエクスポート
 * @param {Function} getPointRules - ポイントルール取得関数
 */
export function setupMessageHandler(client, dbHelpers, getPointRules) {
    client.on(Events.MessageCreate, async (message) => {
        if (message.author.bot || !message.guild) return

        // ボイスチャンネルのアクティビティ追跡用
        recordMessageActivity(message.guild.id, message.author.id)

        // モデレーションチェック（ブロックされた場合はポイント付与・自動応答をスキップ）
        try {
            const modResult = await checkMessage(message, dbHelpers)
            if (modResult.blocked) return
        } catch (err) {
            console.error('Moderation check error:', err.message)
        }

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
                'メッセージ送信',
                'message'
            )
        } catch (err) {
            console.error('Point earn error (message):', err.message)
        }

        // AI採点キューに追加（非同期、メッセージ処理をブロックしない）
        try {
            enqueueForScoring(message, dbHelpers)
        } catch { }

        // 自動応答の処理
        try {
            const autoResponses = dbHelpers.getAllAutoResponses(message.guild.id)
            for (const ar of autoResponses) {
                if (!ar.enabled) continue
                let matched = false
                const content = message.content
                switch (ar.match_type) {
                    case 'exact': matched = content === ar.trigger_text; break
                    case 'contains': matched = content.includes(ar.trigger_text); break
                    case 'startsWith': matched = content.startsWith(ar.trigger_text); break
                    case 'regex':
                        try { matched = new RegExp(ar.trigger_text, 'i').test(content) } catch { }
                        break
                }
                if (matched) {
                    message.channel.send(ar.response).catch(() => { })
                    break
                }
            }
        } catch (err) {
            console.error('Auto response error:', err.message)
        }
    })
}
