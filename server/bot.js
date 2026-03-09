/**
 * bot.js — 後方互換のためのファサード
 * 実際のロジックは server/bot/ 以下に分割済み。
 * index.js からのimportをそのまま維持するためにここで再エクスポートする。
 */
export { connectBot, disconnectBot, getClient, getBotToken, getBotStatus, autoReconnect, clearToken, getGuilds, getGuildMembers } from './bot/client.js'
export { registerSlashCommands, fetchRegisteredCommands, deleteRegisteredCommand } from './bot/register.js'

import { getClient } from './bot/client.js'
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
    setupVoiceHandler(client, dbHelpers, getPointRules, db)
    setupInteractionHandler(client, commandsGetter, dbHelpers, getPointRules)

    console.log('📡 Command handlers set up (with point tracking)')
}
