/**
 * スラッシュコマンドの登録・取得・削除を管理するモジュール
 */
import { REST, Routes, SlashCommandBuilder } from 'discord.js'
import { getClient, getBotToken } from './client.js'

/**
 * ビルトインのポイント系スラッシュコマンド定義を返す
 * @returns {Array<object>} コマンド定義のJSON配列
 */
export function getBuiltinCommands() {
    return [
        new SlashCommandBuilder()
            .setName('balance')
            .setDescription('ポイント残高を確認します')
            .addUserOption(opt => opt.setName('user').setDescription('確認するユーザー（省略で自分）').setRequired(false))
            .toJSON(),
        new SlashCommandBuilder()
            .setName('transfer')
            .setDescription('ポイントを他のユーザーに送金します')
            .addUserOption(opt => opt.setName('user').setDescription('送金先ユーザー').setRequired(true))
            .addNumberOption(opt => opt.setName('amount').setDescription('送金額').setRequired(true).setMinValue(1))
            .addStringOption(opt => opt.setName('message').setDescription('メッセージ（任意）').setRequired(false))
            .toJSON(),
        new SlashCommandBuilder()
            .setName('pay')
            .setDescription('ポイントで支払います（手数料なし）')
            .addUserOption(opt => opt.setName('user').setDescription('支払い先ユーザー').setRequired(true))
            .addNumberOption(opt => opt.setName('amount').setDescription('支払額').setRequired(true).setMinValue(1))
            .addStringOption(opt => opt.setName('message').setDescription('メッセージ（任意）').setRequired(false))
            .toJSON(),
        new SlashCommandBuilder()
            .setName('ranking')
            .setDescription('ポイントランキングを表示します')
            .addStringOption(opt => opt.setName('period').setDescription('期間').setRequired(false)
                .addChoices(
                    { name: '全期間', value: 'all' },
                    { name: '今月', value: 'month' },
                    { name: '今週', value: 'week' }
                ))
            .toJSON(),
        new SlashCommandBuilder()
            .setName('daily')
            .setDescription('デイリーボーナスを受け取ります')
            .toJSON(),
        new SlashCommandBuilder()
            .setName('history')
            .setDescription('自分の取引履歴を表示します')
            .addIntegerOption(opt => opt.setName('count').setDescription('表示件数（デフォルト10）').setRequired(false).setMinValue(1).setMaxValue(25))
            .toJSON(),
        new SlashCommandBuilder()
            .setName('actions')
            .setDescription('ポイントを獲得できるアクション一覧を表示します')
            .toJSON(),
        new SlashCommandBuilder()
            .setName('gacha')
            .setDescription('ポイントを使ってガチャを引きます')
            .toJSON(),
        new SlashCommandBuilder()
            .setName('coinflip')
            .setDescription('コインフリップでポイントを賭けます')
            .addNumberOption(opt => opt.setName('amount').setDescription('賭けるポイント').setRequired(true).setMinValue(1))
            .toJSON(),
        new SlashCommandBuilder()
            .setName('rank')
            .setDescription('自分またはユーザーのランク詳細を表示します')
            .addUserOption(opt => opt.setName('user').setDescription('確認するユーザー（省略で自分）').setRequired(false))
            .toJSON(),
        new SlashCommandBuilder()
            .setName('rp-ranking')
            .setDescription('RPランキングTOP10を表示します')
            .toJSON(),
        new SlashCommandBuilder()
            .setName('season')
            .setDescription('現在のシーズン情報を表示します')
            .toJSON(),
        new SlashCommandBuilder()
            .setName('shop')
            .setDescription('報酬ショップを表示します')
            .toJSON(),
        new SlashCommandBuilder()
            .setName('buy')
            .setDescription('ショップから報酬を購入します')
            .addIntegerOption(opt => opt.setName('item').setDescription('商品番号（/shopで確認）').setRequired(true).setMinValue(1))
            .toJSON(),
        new SlashCommandBuilder()
            .setName('mypoints')
            .setDescription('ポイント・ランク・獲得履歴をまとめて表示します')
            .toJSON(),
    ]
}

/** ビルトインと衝突するユーザー定義コマンドを同期対象から除外する。 */
export function filterCustomCommands(commands) {
    const builtinNames = new Set(getBuiltinCommands().map(command => command.name))
    const enabled = commands.filter(command => command.enabled)
    return {
        commands: enabled.filter(command => !builtinNames.has(command.name)),
        conflicts: enabled.filter(command => builtinNames.has(command.name)).map(command => command.name),
    }
}

/**
 * ユーザー定義コマンドとビルトインコマンドをDiscordに登録する
 * @param {Array<{name: string, description?: string, enabled?: boolean, options?: Array<{name: string, type: string, description?: string, required?: boolean, choices?: string[]}>}>} commands - ユーザー定義コマンドの配列
 * @param {string} [guildId] - サーバーID（指定しなければグローバル登録）
 * @returns {Promise<{success: boolean, count: number}>} 登録結果
 */
export async function registerSlashCommands(commands, guildId) {
    const client = getClient()
    const botToken = getBotToken()
    if (!client || !botToken) throw new Error('ボットが接続されていません')

    const rest = new REST().setToken(botToken)

    // ビルトイン名を常に優先し、重複名による Discord 側の同期全体失敗を防ぐ
    const filtered = filterCustomCommands(commands)
    const slashCommands = filtered.commands
        .map(cmd => {
            const builder = new SlashCommandBuilder()
                .setName(cmd.name)
                .setDescription(cmd.description || 'BotForge コマンド')

            if (cmd.options && Array.isArray(cmd.options)) {
                cmd.options.forEach(opt => {
                    switch (opt.type) {
                        case 'string':
                            builder.addStringOption(o => {
                                o.setName(opt.name).setDescription(opt.description || 'オプション').setRequired(opt.required || false)
                                if (opt.choices && opt.choices.length > 0) {
                                    o.addChoices(...opt.choices.map(c => ({ name: c, value: c })))
                                }
                                return o
                            })
                            break
                        case 'user':
                            builder.addUserOption(o =>
                                o.setName(opt.name).setDescription(opt.description || 'ユーザー').setRequired(opt.required || false)
                            )
                            break
                        case 'integer':
                            builder.addIntegerOption(o =>
                                o.setName(opt.name).setDescription(opt.description || '数値').setRequired(opt.required || false)
                            )
                            break
                        case 'number':
                            builder.addNumberOption(o =>
                                o.setName(opt.name).setDescription(opt.description || '数値').setRequired(opt.required || false)
                            )
                            break
                        case 'channel':
                            builder.addChannelOption(o =>
                                o.setName(opt.name).setDescription(opt.description || 'チャンネル').setRequired(opt.required || false)
                            )
                            break
                        case 'boolean':
                            builder.addBooleanOption(o =>
                                o.setName(opt.name).setDescription(opt.description || '真偽値').setRequired(opt.required || false)
                            )
                            break
                        case 'role':
                            builder.addRoleOption(o =>
                                o.setName(opt.name).setDescription(opt.description || 'ロール').setRequired(opt.required || false)
                            )
                            break
                    }
                })
            }

            return builder.toJSON()
        })

    // ビルトインコマンドと結合
    const builtinCommands = getBuiltinCommands()
    const allCommands = [...slashCommands, ...builtinCommands]

    try {
        if (guildId) {
            const result = await rest.put(
                Routes.applicationGuildCommands(client.user.id, guildId),
                { body: allCommands }
            )
            return { success: true, count: result.length, conflicts: filtered.conflicts }
        } else {
            const result = await rest.put(
                Routes.applicationCommands(client.user.id),
                { body: allCommands }
            )
            return { success: true, count: result.length, conflicts: filtered.conflicts }
        }
    } catch (err) {
        throw new Error(`コマンド登録に失敗: ${err.message}`)
    }
}

/**
 * Discordに登録済みのスラッシュコマンドを取得する
 * @param {string} [guildId] - サーバーID
 * @returns {Promise<Array<object>>} 登録済みコマンド一覧
 */
export async function fetchRegisteredCommands(guildId) {
    const client = getClient()
    const botToken = getBotToken()
    if (!client || !botToken) throw new Error('ボットが接続されていません')

    const rest = new REST().setToken(botToken)
    try {
        let commands
        if (guildId) {
            commands = await rest.get(
                Routes.applicationGuildCommands(client.user.id, guildId)
            )
        } else {
            commands = await rest.get(
                Routes.applicationCommands(client.user.id)
            )
        }
        return commands.map(cmd => ({
            id: cmd.id,
            name: cmd.name,
            description: cmd.description,
            type: cmd.type,
        }))
    } catch (err) {
        console.error('Failed to fetch commands:', err.message)
        return []
    }
}

/**
 * Discordから登録済みスラッシュコマンドを削除する
 * @param {string} commandId - コマンドID
 * @param {string} [guildId] - サーバーID
 * @returns {Promise<object>} 削除結果
 */
export async function deleteRegisteredCommand(commandId, guildId) {
    const client = getClient()
    const botToken = getBotToken()
    if (!client || !botToken) throw new Error('ボットが接続されていません')

    const rest = new REST().setToken(botToken)
    try {
        if (guildId) {
            await rest.delete(
                Routes.applicationGuildCommands(client.user.id, guildId) + `/${commandId}`
            )
        } else {
            await rest.delete(
                Routes.applicationCommands(client.user.id) + `/${commandId}`
            )
        }
        return { success: true }
    } catch (err) {
        throw new Error(`コマンド削除に失敗: ${err.message}`)
    }
}
