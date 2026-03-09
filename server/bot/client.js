/**
 * Discord.js クライアントの生成・接続・切断・自動再接続を管理するモジュール
 */
import { Client, GatewayIntentBits, Events } from 'discord.js'
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const tokenPath = join(__dirname, '..', '..', 'data', 'token.enc')

let client = null
let botToken = null

// --- トークンの永続化 ---

/** @param {string} token - 保存するDiscordボットトークン */
function saveToken(token) {
    try {
        mkdirSync(join(__dirname, '..', '..', 'data'), { recursive: true })
        writeFileSync(tokenPath, Buffer.from(token).toString('base64'), 'utf8')
    } catch (err) {
        console.error('Failed to save token:', err.message)
    }
}

/** @returns {string|null} 保存されたトークン、なければnull */
function loadToken() {
    try {
        if (existsSync(tokenPath)) {
            const encoded = readFileSync(tokenPath, 'utf8')
            return Buffer.from(encoded, 'base64').toString('utf8')
        }
    } catch { }
    return null
}

/** 保存済みトークンファイルを削除する */
export function clearToken() {
    try {
        if (existsSync(tokenPath)) {
            unlinkSync(tokenPath)
        }
    } catch { }
}

/**
 * ボットをDiscordに接続する
 * @param {string} token - Discordボットトークン
 * @returns {Promise<object>} 接続結果（ボット情報）
 */
export async function connectBot(token) {
    if (client) {
        await disconnectBot()
    }

    botToken = token
    client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.GuildPresences,
            GatewayIntentBits.GuildMessageReactions,
            GatewayIntentBits.GuildVoiceStates,
            GatewayIntentBits.MessageContent,
        ]
    })

    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('接続がタイムアウトしました'))
        }, 15000)

        client.once(Events.ClientReady, (c) => {
            clearTimeout(timeout)
            console.log(`✅ Bot connected: ${c.user.tag}`)
            saveToken(token)
            resolve({
                success: true,
                botName: c.user.username,
                botTag: c.user.tag,
                botId: c.user.id,
                avatarUrl: c.user.displayAvatarURL({ size: 64 }),
                guildCount: c.guilds.cache.size,
                memberCount: c.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0),
            })
        })

        client.once(Events.Error, (err) => {
            clearTimeout(timeout)
            reject(err)
        })

        client.login(token).catch((err) => {
            clearTimeout(timeout)
            reject(err)
        })
    })
}

/** ボットを切断する */
export async function disconnectBot() {
    if (client) {
        await client.destroy()
        client = null
        botToken = null
    }
}

/** @returns {import('discord.js').Client|null} 現在のクライアントインスタンス */
export function getClient() {
    return client
}

/** @returns {string|null} 現在のボットトークン */
export function getBotToken() {
    return botToken
}

/**
 * サーバー起動時に保存済みトークンで自動再接続する
 * @returns {Promise<object|null>} 接続結果、失敗時はnull
 */
export async function autoReconnect() {
    const savedToken = loadToken()
    if (savedToken) {
        console.log('🔄 Saved token found, auto-reconnecting...')
        try {
            const result = await connectBot(savedToken)
            console.log(`✅ Auto-reconnected as ${result.botTag}`)
            return result
        } catch (err) {
            console.error('❌ Auto-reconnect failed:', err.message)
        }
    }
    return null
}

/** @returns {object} ボットのステータス情報 */
export function getBotStatus() {
    if (!client || !client.user) return { status: 'offline' }
    return {
        status: 'online',
        username: client.user.username,
        tag: client.user.tag,
        id: client.user.id,
        avatarUrl: client.user.displayAvatarURL({ size: 64 }),
        guildCount: client.guilds.cache.size,
        memberCount: client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0),
    }
}

/** @returns {Array<object>} ボットが参加しているサーバー一覧 */
export function getGuilds() {
    if (!client) return []
    return client.guilds.cache.map(g => ({
        id: g.id,
        name: g.name,
        icon: g.iconURL({ size: 64 }),
        memberCount: g.memberCount,
        ownerId: g.ownerId,
        channels: g.channels.cache
            .filter(c => c.type === 0)
            .map(c => ({ id: c.id, name: c.name }))
            .slice(0, 50),
        roles: g.roles.cache
            .filter(r => r.name !== '@everyone')
            .map(r => ({ id: r.id, name: r.name, color: r.hexColor }))
            .slice(0, 50),
    }))
}

/**
 * サーバーのメンバー一覧を取得する
 * @param {string} guildId - サーバーID
 * @returns {Promise<Array<object>>} メンバー一覧
 */
export async function getGuildMembers(guildId) {
    if (!client) return []
    const guild = client.guilds.cache.get(guildId)
    if (!guild) return []

    try {
        const members = await guild.members.fetch({ limit: 200 })
        return members
            .filter(m => !m.user.bot)
            .map(m => ({
                id: m.user.id,
                username: m.user.username,
                displayName: m.displayName,
                discriminator: m.user.discriminator,
                avatar: m.user.displayAvatarURL({ size: 32 }),
                joinedAt: m.joinedAt?.toISOString(),
                roles: m.roles.cache
                    .filter(r => r.name !== '@everyone')
                    .map(r => ({ id: r.id, name: r.name, color: r.hexColor })),
            }))
            .sort((a, b) => a.username.localeCompare(b.username))
    } catch (err) {
        console.error('Failed to fetch members:', err.message)
        return []
    }
}
