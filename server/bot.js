/**
 * bot.js — 後方互換のためのファサード
 * 実際のロジックは server/bot/ 以下に分割済み。
 * index.js からのimportをそのまま維持するためにここで再エクスポートする。
 */
export { connectBot, disconnectBot, getClient, getBotToken, getBotStatus, autoReconnect, clearToken, getGuilds, getGuildMembers } from './bot/client.js'
export { registerSlashCommands, fetchRegisteredCommands, deleteRegisteredCommand } from './bot/register.js'

import { getClient } from './bot/client.js'
import { Events, EmbedBuilder } from 'discord.js'
import * as dbModule from './db.js'
import { setupMessageHandler } from './bot/handlers/message.js'
import { setupReactionHandler } from './bot/handlers/reaction.js'
import { setupVoiceHandler } from './bot/handlers/voice.js'
import { setupInteractionHandler } from './bot/handlers/interaction.js'

/**
 * すべてのイベントハンドラーをセットアップする
 * index.jsから呼ばれる既存インターフェースを維持
 * @param {Function} commandsGetter - ユーザー定義コマンドを取得する関数
 * @param {object} db - SQLiteデータベースインスタンス
 */
export function setupHandlers(commandsGetter, db) {
    const client = getClient()
    if (!client) return

    const dbHelpers = dbModule

    /** @returns {Array<object>} 有効なポイントルール */
    const getPointRules = () => {
        try {
            return dbHelpers.getAllPointRules()
        } catch { return [] }
    }

    // 各ハンドラーにdbHelpersを依存性注入
    setupMessageHandler(client, dbHelpers, getPointRules)
    setupReactionHandler(client, dbHelpers, getPointRules)
    setupVoiceHandler(client, dbHelpers, getPointRules)
    setupInteractionHandler(client, commandsGetter, dbHelpers, getPointRules)

    // ウェルカム/退出メッセージハンドラー
    setupWelcomeHandler(client, dbHelpers)

    console.log('📡 Command handlers set up (with point tracking + rank system)')
}

/**
 * メンバー参加/退出時のメッセージ送信ハンドラー
 * @param {import('discord.js').Client} client
 * @param {object} dbHelpers
 */
function setupWelcomeHandler(client, dbHelpers) {
    /** テンプレート変数を置換する */
    const replaceVars = (text, member) => {
        return text
            .replace(/\{user\}/g, `<@${member.user.id}>`)
            .replace(/\{username\}/g, member.user.username)
            .replace(/\{server\}/g, member.guild.name)
            .replace(/\{memberCount\}/g, String(member.guild.memberCount))
    }

    client.on(Events.GuildMemberAdd, async (member) => {
        if (member.user.bot) return
        try {
            const settings = dbHelpers.getWelcomeSettings(member.guild.id)
            const w = settings.welcome
            if (!w.enabled || !w.channelId) return

            const channel = member.guild.channels.cache.get(w.channelId)
            if (!channel) return

            if (w.embedEnabled) {
                const embed = new EmbedBuilder()
                    .setColor(parseInt((w.embedColor || '#7c5cfc').replace('#', ''), 16))
                if (w.embedTitle) embed.setTitle(replaceVars(w.embedTitle, member))
                if (w.embedDescription) embed.setDescription(replaceVars(w.embedDescription, member))
                if (w.embedThumbnail) embed.setThumbnail(member.user.displayAvatarURL({ size: 128 }))
                await channel.send({ content: w.message ? replaceVars(w.message, member) : undefined, embeds: [embed] })
            } else if (w.message) {
                await channel.send(replaceVars(w.message, member))
            }

            // DM
            if (w.dmEnabled && w.dmMessage) {
                try {
                    await member.user.send(replaceVars(w.dmMessage, member))
                } catch { }
            }
        } catch (err) {
            console.error('Welcome message error:', err.message)
        }
    })

    client.on(Events.GuildMemberRemove, async (member) => {
        if (member.user.bot) return
        try {
            const settings = dbHelpers.getWelcomeSettings(member.guild.id)
            const l = settings.leave
            if (!l.enabled || !l.channelId || !l.message) return

            const channel = member.guild.channels.cache.get(l.channelId)
            if (!channel) return
            await channel.send(replaceVars(l.message, member))
        } catch (err) {
            console.error('Leave message error:', err.message)
        }
    })
}
