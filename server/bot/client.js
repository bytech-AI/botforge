/**
 * Discord.js クライアントの生成・接続・切断・自動再接続を管理するモジュール
 */
import { Client, GatewayIntentBits, Events } from 'discord.js'
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'fs'
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const dataDir = join(__dirname, '..', '..', 'data')
const tokenPath = join(dataDir, 'token.enc')
const keyPath = join(dataDir, 'encryption.key')

let client = null
let botToken = null

// --- 暗号化ヘルパー ---

/**
 * 暗号化キーを取得する（優先順位: 環境変数 → 永続化ファイル → 新規生成）
 * @returns {Buffer} 32バイトのAES-256用キー
 */
function getEncryptionKey() {
  // 1. 環境変数が設定されていればSHA-256で32バイトに正規化
  const customKey = process.env.BOTFORGE_ENCRYPTION_KEY
  if (customKey) {
    return createHash('sha256').update(customKey).digest()
  }

  // 2. 永続化された鍵ファイルがあれば読み込む
  try {
    if (existsSync(keyPath)) {
      const key = readFileSync(keyPath)
      if (key.length === 32) return key
    }
  } catch { }

  // 3. 安全なランダムキーを生成し永続化
  try {
    mkdirSync(dataDir, { recursive: true })
  } catch { }
  const newKey = randomBytes(32)
  writeFileSync(keyPath, newKey, { mode: 0o600 })
  console.log('🔑 New encryption key generated and saved to data/encryption.key')
  return newKey
}

/**
 * トークンをAES-256-GCMで暗号化する
 * @param {string} token - 暗号化するトークン
 * @returns {string} Base64エンコードされた暗号文（iv:tag:ciphertext）
 */
function encryptToken(token) {
  const key = getEncryptionKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // iv(12) + tag(16) + ciphertext をBase64で保存
  const combined = Buffer.concat([iv, tag, encrypted])
  return combined.toString('base64')
}

/**
 * AES-256-GCMで暗号化されたトークンを復号する
 * @param {string} encoded - Base64エンコードされた暗号文
 * @returns {string} 復号されたトークン
 */
function decryptToken(encoded) {
  const key = getEncryptionKey()
  const combined = Buffer.from(encoded, 'base64')
  const iv = combined.subarray(0, 12)
  const tag = combined.subarray(12, 28)
  const encrypted = combined.subarray(28)
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(encrypted) + decipher.final('utf8')
}

// 暗号化ユーティリティをexport（APIキー等の暗号化にも使用）
export { encryptToken as encryptSecret, decryptToken as decryptSecret }

// --- トークンの永続化 ---

/** @param {string} token - 保存するDiscordボットトークン */
function saveToken(token) {
  try {
    mkdirSync(join(__dirname, '..', '..', 'data'), { recursive: true })
    writeFileSync(tokenPath, encryptToken(token), 'utf8')
  } catch (err) {
    console.error('Failed to save token:', err.message)
  }
}

/**
 * トークンを読み込む（優先順位: 環境変数 → 暗号化ファイル → 旧base64ファイル）
 * @returns {string|null} トークン、なければnull
 */
function loadToken() {
  // 1. 環境変数が設定されていればファイル不要
  if (process.env.DISCORD_BOT_TOKEN) {
    return process.env.DISCORD_BOT_TOKEN
  }

  // 2. 暗号化ファイルから読み込み
  try {
    if (existsSync(tokenPath)) {
      const encoded = readFileSync(tokenPath, 'utf8')
      try {
        // 新しい暗号化形式で復号を試みる
        return decryptToken(encoded)
      } catch {
        // 旧base64形式へのフォールバック（マイグレーション対応）
        const decoded = Buffer.from(encoded, 'base64').toString('utf8')
        // 旧形式から読めた場合、新形式で再保存
        if (decoded && decoded.length > 10) {
          console.log('🔄 Migrating token to encrypted format...')
          saveToken(decoded)
          return decoded
        }
      }
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
