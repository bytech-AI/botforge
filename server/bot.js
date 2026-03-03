import { Client, GatewayIntentBits, Events, REST, Routes, SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js'
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const tokenPath = join(__dirname, '..', 'data', 'token.enc')

let client = null
let botToken = null

// Cooldown tracking for point earning
const pointCooldowns = new Map() // key: `${guildId}:${userId}:${action}`, value: timestamp
// Voice tracking
const voiceJoinTimes = new Map() // key: `${guildId}:${userId}`, value: join timestamp

// --- Token Persistence ---
function saveToken(token) {
    try {
        mkdirSync(join(__dirname, '..', 'data'), { recursive: true })
        writeFileSync(tokenPath, Buffer.from(token).toString('base64'), 'utf8')
    } catch (err) {
        console.error('Failed to save token:', err.message)
    }
}

function loadToken() {
    try {
        if (existsSync(tokenPath)) {
            const encoded = readFileSync(tokenPath, 'utf8')
            return Buffer.from(encoded, 'base64').toString('utf8')
        }
    } catch { }
    return null
}

export function clearToken() {
    try {
        if (existsSync(tokenPath)) {
            unlinkSync(tokenPath)
        }
    } catch { }
}

// --- Bot Connection ---
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

export async function disconnectBot() {
    if (client) {
        await client.destroy()
        client = null
        botToken = null
    }
}

export function getClient() {
    return client
}

// --- Auto-reconnect on server start ---
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

// --- Bot Status ---
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

// --- Guild (Server) List ---
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

// --- Guild Members ---
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

// ============================
// Built-in Point Commands
// ============================
function getBuiltinCommands() {
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
    ]
}

// --- Register Slash Commands ---
export async function registerSlashCommands(commands, guildId) {
    if (!client || !botToken) throw new Error('ボットが接続されていません')

    const rest = new REST().setToken(botToken)

    // Build user-defined commands
    const slashCommands = commands
        .filter(cmd => cmd.enabled)
        .map(cmd => {
            const builder = new SlashCommandBuilder()
                .setName(cmd.name)
                .setDescription(cmd.description || 'BotForge コマンド')

            // Add options
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

    // Add built-in point commands
    const builtinCommands = getBuiltinCommands()
    const allCommands = [...slashCommands, ...builtinCommands]

    try {
        if (guildId) {
            const result = await rest.put(
                Routes.applicationGuildCommands(client.user.id, guildId),
                { body: allCommands }
            )
            return { success: true, count: result.length }
        } else {
            const result = await rest.put(
                Routes.applicationCommands(client.user.id),
                { body: allCommands }
            )
            return { success: true, count: result.length }
        }
    } catch (err) {
        throw new Error(`コマンド登録に失敗: ${err.message}`)
    }
}

// --- Fetch existing registered commands ---
export async function fetchRegisteredCommands(guildId) {
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

export async function deleteRegisteredCommand(commandId, guildId) {
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

// ============================
// Point Cooldown Check
// ============================
function checkCooldown(guildId, userId, action, cooldownSeconds) {
    if (cooldownSeconds <= 0) return true
    const key = `${guildId}:${userId}:${action}`
    const now = Date.now()
    const last = pointCooldowns.get(key)
    if (last && (now - last) < cooldownSeconds * 1000) return false
    pointCooldowns.set(key, now)
    return true
}

// ============================
// Set up message/interaction handlers
// ============================
export function setupHandlers(commandsGetter, db) {
    if (!client) return

    // Import db helpers dynamically
    let dbHelpers = null
    import('./db.js').then(mod => {
        dbHelpers = mod
    })

    // Get point rules from DB
    const getPointRules = () => {
        try {
            if (dbHelpers) return dbHelpers.getAllPointRules()
            return []
        } catch { return [] }
    }

    // ============================
    // Point Auto-Earning: Messages
    // ============================
    client.on(Events.MessageCreate, (message) => {
        if (message.author.bot || !message.guild || !dbHelpers) return

        const rules = getPointRules()
        const msgRule = rules.find(r => r.action === 'message' && r.enabled)
        if (!msgRule) return

        if (!checkCooldown(message.guild.id, message.author.id, 'message', msgRule.cooldown)) return

        try {
            dbHelpers.getOrCreateMember(
                message.guild.id, message.author.id,
                message.author.username,
                message.member?.displayName || message.author.username,
                message.author.displayAvatarURL({ size: 32 })
            )
            dbHelpers.addPoints(message.guild.id, message.author.id, msgRule.points, 'earn', 'メッセージ送信')
        } catch (err) {
            console.error('Point earn error (message):', err.message)
        }
    })

    // ============================
    // Point Auto-Earning: Reactions
    // ============================
    client.on(Events.MessageReactionAdd, async (reaction, user) => {
        if (user.bot || !reaction.message.guild || !dbHelpers) return

        const guildId = reaction.message.guild.id
        const rules = getPointRules()

        // Points for giving a reaction
        const giveRule = rules.find(r => r.action === 'reaction_give' && r.enabled)
        if (giveRule && checkCooldown(guildId, user.id, 'reaction_give', giveRule.cooldown)) {
            try {
                dbHelpers.getOrCreateMember(guildId, user.id, user.username, user.username, user.displayAvatarURL({ size: 32 }))
                dbHelpers.addPoints(guildId, user.id, giveRule.points, 'earn', 'リアクション付与')
            } catch (err) {
                console.error('Point earn error (reaction_give):', err.message)
            }
        }

        // Points for receiving a reaction
        const receiveRule = rules.find(r => r.action === 'reaction_receive' && r.enabled)
        if (receiveRule && reaction.message.author && !reaction.message.author.bot) {
            const receiverId = reaction.message.author.id
            if (receiverId !== user.id && checkCooldown(guildId, receiverId, 'reaction_receive', receiveRule.cooldown)) {
                try {
                    dbHelpers.getOrCreateMember(guildId, receiverId,
                        reaction.message.author.username,
                        reaction.message.author.username,
                        reaction.message.author.displayAvatarURL({ size: 32 })
                    )
                    dbHelpers.addPoints(guildId, receiverId, receiveRule.points, 'earn', 'リアクション受信')
                } catch (err) {
                    console.error('Point earn error (reaction_receive):', err.message)
                }
            }
        }
    })

    // ============================
    // Point Auto-Earning: Voice
    // ============================
    client.on(Events.VoiceStateUpdate, (oldState, newState) => {
        if (!dbHelpers) return

        const userId = newState.member?.user?.id || oldState.member?.user?.id
        const guildId = newState.guild?.id || oldState.guild?.id
        if (!userId || !guildId) return

        const member = newState.member || oldState.member
        if (member?.user?.bot) return

        const key = `${guildId}:${userId}`

        // User joined voice channel
        if (!oldState.channelId && newState.channelId) {
            voiceJoinTimes.set(key, Date.now())
        }

        // User left voice channel
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
                            // Update voice minutes
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

    // ============================
    // Handle slash command interactions
    // ============================
    client.on(Events.InteractionCreate, async (interaction) => {
        if (!interaction.isChatInputCommand()) return

        const builtinNames = ['balance', 'transfer', 'pay', 'ranking', 'daily', 'history', 'actions', 'gacha', 'coinflip']

        // Handle built-in point commands
        if (builtinNames.includes(interaction.commandName) && dbHelpers) {
            try {
                await handleBuiltinCommand(interaction, dbHelpers, getPointRules)
            } catch (err) {
                console.error(`Builtin command ${interaction.commandName} error:`, err.message)
                try {
                    const reply = interaction.replied || interaction.deferred
                        ? interaction.followUp.bind(interaction)
                        : interaction.reply.bind(interaction)
                    await reply({ content: '❌ コマンドの実行中にエラーが発生しました。', ephemeral: true })
                } catch { }
            }
            return
        }

        // Handle user-defined commands
        const commands = commandsGetter()
        const cmd = commands.find(c => c.name === interaction.commandName && c.enabled)
        if (!cmd) return

        try {
            // Permission check
            if (cmd.requiredPermissions && cmd.requiredPermissions.length > 0) {
                const hasPermission = cmd.requiredPermissions.every(perm => {
                    try {
                        return interaction.memberPermissions?.has(PermissionFlagsBits[perm])
                    } catch { return false }
                })
                if (!hasPermission) {
                    await interaction.reply({ content: '❌ このコマンドを実行する権限がありません。', ephemeral: true })
                    return
                }
            }

            // Role check
            if (cmd.allowedRoles && cmd.allowedRoles.length > 0) {
                const hasRole = cmd.allowedRoles.some(roleId =>
                    interaction.member?.roles?.cache?.has(roleId)
                )
                if (!hasRole) {
                    await interaction.reply({ content: '❌ このコマンドを実行するロールがありません。', ephemeral: true })
                    return
                }
            }

            // --- Point Cost Check ---
            if (cmd.pointCost > 0 && dbHelpers && interaction.guild) {
                const member = dbHelpers.getOrCreateMember(
                    interaction.guild.id, interaction.user.id,
                    interaction.user.username, interaction.user.username,
                    interaction.user.displayAvatarURL({ size: 32 })
                )
                if (member.total_points < cmd.pointCost) {
                    await interaction.reply({
                        content: `❌ ポイントが不足しています。このコマンドには **${cmd.pointCost}pt** 必要です（残高: ${Math.floor(member.total_points)}pt）`,
                        ephemeral: true
                    })
                    return
                }
                // Deduct points
                dbHelpers.addPoints(interaction.guild.id, interaction.user.id, -cmd.pointCost, 'command_cost', `コマンド /${cmd.name} 使用料`)
            }

            // --- Point Reward ---
            let pointRewardAmount = 0
            if ((cmd.pointRewardMin > 0 || cmd.pointRewardMax > 0) && dbHelpers && interaction.guild) {
                const min = cmd.pointRewardMin || 0
                const max = cmd.pointRewardMax || min
                pointRewardAmount = min === max ? min : Math.floor(Math.random() * (max - min + 1)) + min
                if (pointRewardAmount > 0) {
                    dbHelpers.getOrCreateMember(
                        interaction.guild.id, interaction.user.id,
                        interaction.user.username, interaction.user.username,
                        interaction.user.displayAvatarURL({ size: 32 })
                    )
                    dbHelpers.addPoints(interaction.guild.id, interaction.user.id, pointRewardAmount, 'command_reward', `コマンド /${cmd.name} 報酬`)
                }
            }

            // Build response text
            let responseText = cmd.responseText || ''

            // Handle random responses
            if (cmd.responseType === 'random' && cmd.randomResponses && cmd.randomResponses.length > 0) {
                responseText = cmd.randomResponses[Math.floor(Math.random() * cmd.randomResponses.length)]
            }

            // Replace variables
            responseText = replaceVariables(responseText, interaction, cmd)

            // Add point reward/cost info
            if (cmd.pointCost > 0) {
                responseText += `\n💸 -${cmd.pointCost}pt 消費`
            }
            if (pointRewardAmount > 0) {
                responseText += `\n🎁 +${pointRewardAmount}pt 獲得！`
            }

            // Replace option variables
            if (cmd.options && Array.isArray(cmd.options)) {
                cmd.options.forEach(opt => {
                    let val = ''
                    switch (opt.type) {
                        case 'string': val = interaction.options.getString(opt.name) || ''; break
                        case 'user': {
                            const u = interaction.options.getUser(opt.name)
                            val = u ? `<@${u.id}>` : ''
                            break
                        }
                        case 'integer': val = String(interaction.options.getInteger(opt.name) || ''); break
                        case 'number': val = String(interaction.options.getNumber(opt.name) || ''); break
                        case 'channel': {
                            const ch = interaction.options.getChannel(opt.name)
                            val = ch ? `<#${ch.id}>` : ''
                            break
                        }
                        case 'boolean': val = String(interaction.options.getBoolean(opt.name) ?? ''); break
                        case 'role': {
                            const r = interaction.options.getRole(opt.name)
                            val = r ? `<@&${r.id}>` : ''
                            break
                        }
                    }
                    responseText = responseText.replace(new RegExp(`\\{option:${opt.name}\\}`, 'g'), val)
                })
            }

            if (cmd.responseType === 'embed') {
                let embedDesc = (cmd.embedDescription || responseText)
                embedDesc = replaceVariables(embedDesc, interaction, cmd)

                const embed = new EmbedBuilder()
                    .setColor(parseInt((cmd.embedColor || '#7c5cfc').replace('#', ''), 16))

                if (cmd.embedTitle) embed.setTitle(cmd.embedTitle)
                if (embedDesc) embed.setDescription(embedDesc)

                // Add point info to embed footer if applicable
                const pointInfo = []
                if (cmd.pointCost > 0) pointInfo.push(`💸 -${cmd.pointCost}pt`)
                if (pointRewardAmount > 0) pointInfo.push(`🎁 +${pointRewardAmount}pt`)
                if (pointInfo.length > 0) embed.setFooter({ text: pointInfo.join(' | ') })

                const replyOpts = {
                    embeds: [embed],
                    ephemeral: cmd.ephemeral || false,
                }

                if (cmd.dmResponse) {
                    await interaction.user.send(replyOpts).catch(() => { })
                    await interaction.reply({ content: '📩 DMに送信しました！', ephemeral: true })
                } else {
                    await interaction.reply(replyOpts)
                }
            } else {
                const replyOpts = {
                    content: responseText,
                    ephemeral: cmd.ephemeral || false,
                }

                if (cmd.dmResponse) {
                    await interaction.user.send(replyOpts).catch(() => { })
                    await interaction.reply({ content: '📩 DMに送信しました！', ephemeral: true })
                } else {
                    await interaction.reply(replyOpts)
                }
            }
        } catch (err) {
            console.error(`Command ${cmd.name} error:`, err.message)
            try {
                await interaction.reply({ content: 'コマンドの実行中にエラーが発生しました。', ephemeral: true })
            } catch { }
        }
    })

    console.log('📡 Command handlers set up (with point tracking)')
}

// ============================
// Variable Replacement Helper
// ============================
function replaceVariables(text, interaction, cmd) {
    return text
        .replace(/\{user\}/g, `<@${interaction.user.id}>`)
        .replace(/\{username\}/g, interaction.user.username)
        .replace(/\{server\}/g, interaction.guild?.name || '')
        .replace(/\{memberCount\}/g, String(interaction.guild?.memberCount || 0))
        .replace(/\{channelCount\}/g, String(interaction.guild?.channels?.cache?.size || 0))
        .replace(/\{date\}/g, new Date().toLocaleDateString('ja-JP'))
        .replace(/\{time\}/g, new Date().toLocaleTimeString('ja-JP'))
        .replace(/\{random:(\d+)-(\d+)\}/g, (_, min, max) =>
            String(Math.floor(Math.random() * (parseInt(max) - parseInt(min) + 1)) + parseInt(min))
        )
}

// ============================
// Built-in Command Handler
// ============================
async function handleBuiltinCommand(interaction, dbHelpers, getPointRules) {
    const guildId = interaction.guild?.id
    if (!guildId) {
        await interaction.reply({ content: '❌ このコマンドはサーバー内でのみ使用できます。', ephemeral: true })
        return
    }

    switch (interaction.commandName) {
        case 'balance': {
            const targetUser = interaction.options.getUser('user') || interaction.user
            const member = dbHelpers.getOrCreateMember(
                guildId, targetUser.id, targetUser.username,
                targetUser.username, targetUser.displayAvatarURL({ size: 32 })
            )
            const rank = dbHelpers.getUserRank(guildId, targetUser.id)
            const titleInfo = dbHelpers.getLevelTitle(member.level)
            const nextLevelPts = dbHelpers.pointsForNextLevel(member.level)
            const currentEarned = member.total_earned || 0
            const prevLevelPts = dbHelpers.pointsForNextLevel(member.level - 1)
            const progress = nextLevelPts > prevLevelPts
                ? Math.min(100, Math.floor(((currentEarned - prevLevelPts) / (nextLevelPts - prevLevelPts)) * 100))
                : 100

            // Create visual progress bar
            const filled = Math.floor(progress / 10)
            const progressBar = '█'.repeat(filled) + '░'.repeat(10 - filled)

            const embed = new EmbedBuilder()
                .setColor(parseInt(titleInfo.color.replace('#', ''), 16))
                .setTitle(`💰 ${targetUser.username} のウォレット`)
                .setThumbnail(targetUser.displayAvatarURL({ size: 64 }))
                .setDescription(`**${titleInfo.title}**`)
                .addFields(
                    { name: '💎 ポイント残高', value: `**${Math.floor(member.total_points).toLocaleString()}** pt`, inline: true },
                    { name: '🏆 ランキング', value: `#${rank}`, inline: true },
                    { name: '📊 レベル', value: `Lv.${member.level}`, inline: true },
                    { name: `⬆️ 次のレベルまで`, value: `${progressBar} ${progress}%\n${Math.floor(currentEarned).toLocaleString()} / ${nextLevelPts.toLocaleString()} XP`, inline: false },
                    { name: '💬 メッセージ', value: `${member.messages.toLocaleString()}`, inline: true },
                    { name: '⭐ リアクション', value: `${member.reactions.toLocaleString()}`, inline: true },
                    { name: '🔥 連続ログイン', value: `${member.streak_days}日`, inline: true },
                )
                .setFooter({ text: `累計獲得: ${Math.floor(currentEarned).toLocaleString()}pt | 最終: ${new Date(member.last_active).toLocaleDateString('ja-JP')}` })

            await interaction.reply({ embeds: [embed], ephemeral: true })
            break
        }

        case 'transfer': {
            const targetUser = interaction.options.getUser('user')
            const amount = interaction.options.getNumber('amount')
            const message = interaction.options.getString('message') || ''

            if (targetUser.id === interaction.user.id) {
                await interaction.reply({ content: '❌ 自分自身にポイントを送金することはできません。', ephemeral: true })
                return
            }
            if (targetUser.bot) {
                await interaction.reply({ content: '❌ ボットにポイントを送金することはできません。', ephemeral: true })
                return
            }

            const settings = dbHelpers.getEconomySettings(guildId)
            if (amount < settings.min_transfer_amount) {
                await interaction.reply({ content: `❌ 最低送金額は **${settings.min_transfer_amount}pt** です。`, ephemeral: true })
                return
            }

            // Check daily transfer limit
            const dailyTotal = dbHelpers.getDailyTransferTotal(guildId, interaction.user.id)
            if (dailyTotal + amount > settings.daily_transfer_limit) {
                await interaction.reply({
                    content: `❌ 1日の送金上限 (**${settings.daily_transfer_limit.toLocaleString()}pt**) を超えます。\n今日の送金済み: **${dailyTotal.toLocaleString()}pt** / 残り: **${(settings.daily_transfer_limit - dailyTotal).toLocaleString()}pt**`,
                    ephemeral: true
                })
                return
            }

            // Ensure both users exist
            dbHelpers.getOrCreateMember(guildId, interaction.user.id, interaction.user.username, interaction.user.username, interaction.user.displayAvatarURL({ size: 32 }))
            dbHelpers.getOrCreateMember(guildId, targetUser.id, targetUser.username, targetUser.username, targetUser.displayAvatarURL({ size: 32 }))

            const result = dbHelpers.transferPoints(guildId, interaction.user.id, targetUser.id, amount, settings.transfer_fee_percent, message)
            if (!result.success) {
                await interaction.reply({ content: `❌ ${result.error}`, ephemeral: true })
                return
            }

            const embed = new EmbedBuilder()
                .setColor(0x00d4aa)
                .setTitle('💸 送金完了')
                .setDescription(message ? `📝 "${message}"` : '')
                .addFields(
                    { name: '送金先', value: `<@${targetUser.id}>`, inline: true },
                    { name: '送金額', value: `**${amount.toLocaleString()}** pt`, inline: true },
                    { name: '手数料', value: `**${result.fee.toLocaleString()}** pt (${settings.transfer_fee_percent}%)`, inline: true },
                    { name: '相手の受取額', value: `**${result.received.toLocaleString()}** pt`, inline: true },
                    { name: 'あなたの残高', value: `**${result.senderBalance.toLocaleString()}** pt`, inline: true },
                )

            await interaction.reply({ embeds: [embed] })
            break
        }

        case 'pay': {
            const targetUser = interaction.options.getUser('user')
            const amount = interaction.options.getNumber('amount')
            const message = interaction.options.getString('message') || ''

            if (targetUser.id === interaction.user.id) {
                await interaction.reply({ content: '❌ 自分自身に支払うことはできません。', ephemeral: true })
                return
            }

            dbHelpers.getOrCreateMember(guildId, interaction.user.id, interaction.user.username, interaction.user.username, interaction.user.displayAvatarURL({ size: 32 }))
            dbHelpers.getOrCreateMember(guildId, targetUser.id, targetUser.username, targetUser.username, targetUser.displayAvatarURL({ size: 32 }))

            // Pay has no fee
            const result = dbHelpers.transferPoints(guildId, interaction.user.id, targetUser.id, amount, 0, message || 'ポイント支払い')
            if (!result.success) {
                await interaction.reply({ content: `❌ ${result.error}`, ephemeral: true })
                return
            }

            const embed = new EmbedBuilder()
                .setColor(0x4db8ff)
                .setTitle('💳 支払い完了')
                .setDescription(message ? `📝 "${message}"` : '')
                .addFields(
                    { name: '支払い先', value: `<@${targetUser.id}>`, inline: true },
                    { name: '支払額', value: `**${amount.toLocaleString()}** pt`, inline: true },
                    { name: 'あなたの残高', value: `**${result.senderBalance.toLocaleString()}** pt`, inline: true },
                )

            await interaction.reply({ embeds: [embed] })
            break
        }

        case 'ranking': {
            const leaderboard = dbHelpers.getLeaderboard(guildId, 10)
            if (leaderboard.length === 0) {
                await interaction.reply({ content: '📊 まだランキングデータがありません。アクティブに活動してポイントを貯めましょう！', ephemeral: true })
                return
            }

            const medals = ['🥇', '🥈', '🥉']
            const lines = leaderboard.map((m, i) => {
                const medal = i < 3 ? medals[i] : `\`${i + 1}.\``
                const titleInfo = dbHelpers.getLevelTitle(m.level)
                return `${medal} **${m.display_name || m.username}** — ${Math.floor(m.total_points).toLocaleString()} pt\n　　${titleInfo.title} Lv.${m.level}`
            })

            const embed = new EmbedBuilder()
                .setColor(0xffd700)
                .setTitle('🏆 ポイントランキング TOP10')
                .setDescription(lines.join('\n'))
                .setFooter({ text: `${interaction.guild.name} のランキング` })
                .setTimestamp()

            await interaction.reply({ embeds: [embed] })
            break
        }

        case 'daily': {
            dbHelpers.getOrCreateMember(guildId, interaction.user.id, interaction.user.username, interaction.user.username, interaction.user.displayAvatarURL({ size: 32 }))
            const result = dbHelpers.claimDaily(guildId, interaction.user.id)

            if (!result.success) {
                const nextClaim = new Date(result.nextClaim)
                await interaction.reply({
                    content: `⏰ ${result.error}\n次のボーナスは <t:${Math.floor(nextClaim.getTime() / 1000)}:R> 受け取れます。`,
                    ephemeral: true
                })
                return
            }

            const embed = new EmbedBuilder()
                .setColor(0xffb347)
                .setTitle('🎁 デイリーボーナス')
                .addFields(
                    { name: '獲得ポイント', value: `**+${result.amount.toLocaleString()}** pt`, inline: true },
                    { name: '連続ログイン', value: `🔥 **${result.streak}日**`, inline: true },
                )
                .setFooter({ text: '毎日ログインすると連続ボーナスがアップ！' })

            await interaction.reply({ embeds: [embed] })
            break
        }

        case 'history': {
            const count = interaction.options.getInteger('count') || 10
            const history = dbHelpers.getTransactionHistory(guildId, interaction.user.id, count)

            if (history.length === 0) {
                await interaction.reply({ content: '📜 取引履歴がありません。', ephemeral: true })
                return
            }

            const lines = history.map(t => {
                const date = new Date(t.created_at).toLocaleDateString('ja-JP')
                const sign = t.amount >= 0 ? '+' : ''
                const emoji = t.type === 'earn' ? '⬆️' : t.type === 'transfer' ? '💸' : t.type === 'daily' ? '🎁' : t.type === 'reward' ? '🎁' : '📝'
                return `${emoji} \`${date}\` ${sign}**${t.amount.toLocaleString()}** pt — ${t.description || t.type}`
            })

            const embed = new EmbedBuilder()
                .setColor(0x7c5cfc)
                .setTitle('📜 取引履歴')
                .setDescription(lines.join('\n'))
                .setFooter({ text: `最新${history.length}件を表示` })

            await interaction.reply({ embeds: [embed], ephemeral: true })
            break
        }

        case 'actions': {
            const rules = getPointRules().filter(r => r.enabled)

            const descriptions = {
                'message': '💬 テキストチャンネルでメッセージを送信',
                'reaction_give': '👍 他のメンバーのメッセージにリアクション',
                'reaction_receive': '⭐ 自分のメッセージにリアクションをもらう',
                'voice_join': '🎤 ボイスチャンネルに参加（毎分）',
                'invite': '📨 サーバーに新しいメンバーを招待',
                'thread_create': '🧵 スレッドを作成',
            }

            const lines = rules.map(r => {
                const desc = descriptions[r.action] || r.label
                const cd = r.cooldown > 0 ? ` (⏱ ${r.cooldown}秒間隔)` : ''
                return `${desc}\n┗ **+${r.points} pt**${cd}`
            })

            // Add built-in commands info
            lines.push('\n**🤖 ポイント関連コマンド:**')
            lines.push('`/balance` — 残高確認')
            lines.push('`/transfer` — ポイント送金')
            lines.push('`/pay` — ポイント支払い')
            lines.push('`/daily` — デイリーボーナス')
            lines.push('`/ranking` — ランキング')
            lines.push('`/history` — 取引履歴')
            lines.push('`/gacha` — ガチャ（ポイント消費）')
            lines.push('`/coinflip` — コインフリップ賭け')

            const embed = new EmbedBuilder()
                .setColor(0x00d4aa)
                .setTitle('📋 ポイント獲得アクション一覧')
                .setDescription(lines.join('\n'))
                .setFooter({ text: 'アクティブに活動してポイントを貯めよう！' })

            await interaction.reply({ embeds: [embed] })
            break
        }

        case 'gacha': {
            const gachaSettings = dbHelpers.getGachaSettings()
            const gacha = gachaSettings[0]
            if (!gacha || !gacha.enabled) {
                await interaction.reply({ content: '🎰 ガチャは現在利用できません。', ephemeral: true })
                return
            }

            // Check balance
            const member = dbHelpers.getOrCreateMember(guildId, interaction.user.id, interaction.user.username, interaction.user.username, interaction.user.displayAvatarURL({ size: 32 }))
            if (member.total_points < gacha.cost) {
                await interaction.reply({
                    content: `❌ ポイントが不足しています。ガチャには **${gacha.cost}pt** 必要です（残高: ${Math.floor(member.total_points)}pt）`,
                    ephemeral: true
                })
                return
            }

            // Deduct cost
            dbHelpers.addPoints(guildId, interaction.user.id, -gacha.cost, 'gacha', `ガチャ使用 (${gacha.name})`)

            // Roll
            const result = dbHelpers.rollGacha(gacha.items)

            // Award points
            if (result.points > 0) {
                dbHelpers.addPoints(guildId, interaction.user.id, result.points, 'gacha_reward', `ガチャ報酬: ${result.name}`)
            }

            // Determine rarity color
            const rarityColors = {
                0: 0x808080,      // Gray for miss
                50: 0xcd7f32,     // Bronze
                150: 0xc0c0c0,    // Silver
                300: 0xffd700,    // Gold
                500: 0x00d4ff,    // Diamond blue
                1000: 0xff4500,   // Legendary red
            }
            const color = rarityColors[result.points] || (result.points >= 500 ? 0xff4500 : result.points >= 100 ? 0xffd700 : 0x808080)

            const profit = result.points - gacha.cost
            const profitText = profit >= 0 ? `+${profit}` : `${profit}`

            const embed = new EmbedBuilder()
                .setColor(color)
                .setTitle('🎰 ガチャ結果')
                .setDescription(`\n# ${result.emoji} ${result.name}\n\n**${result.points > 0 ? `+${result.points}pt 獲得！` : 'ハズレ...'}**`)
                .addFields(
                    { name: '💰 消費', value: `${gacha.cost}pt`, inline: true },
                    { name: '🎁 獲得', value: `${result.points}pt`, inline: true },
                    { name: '📊 損益', value: `${profitText}pt`, inline: true },
                )
                .setFooter({ text: `${gacha.name} | 残高: ${Math.floor(member.total_points - gacha.cost + result.points)}pt` })

            await interaction.reply({ embeds: [embed] })
            break
        }

        case 'coinflip': {
            const betAmount = interaction.options.getNumber('amount')
            if (!betAmount || betAmount <= 0) {
                await interaction.reply({ content: '❌ 賭けるポイントを正しく入力してください。', ephemeral: true })
                return
            }

            // Check balance
            const member = dbHelpers.getOrCreateMember(guildId, interaction.user.id, interaction.user.username, interaction.user.username, interaction.user.displayAvatarURL({ size: 32 }))
            if (member.total_points < betAmount) {
                await interaction.reply({
                    content: `❌ ポイントが不足しています（残高: ${Math.floor(member.total_points)}pt）`,
                    ephemeral: true
                })
                return
            }

            // Flip!
            const won = Math.random() < 0.5
            const resultText = won ? '🎉 表（WIN）' : '💀 裏（LOSE）'
            const winAmount = won ? betAmount : -betAmount

            // Process points
            dbHelpers.addPoints(guildId, interaction.user.id, winAmount, 'coinflip', won ? `コインフリップ勝利 (+${betAmount}pt)` : `コインフリップ敗北 (-${betAmount}pt)`)

            const newBalance = member.total_points + winAmount

            const embed = new EmbedBuilder()
                .setColor(won ? 0x00ff88 : 0xff4444)
                .setTitle('🪙 コインフリップ')
                .setDescription(`# ${resultText}\n\n${won ? `**+${betAmount}pt** 獲得！🎊` : `**-${betAmount}pt** 失った... 😢`}`)
                .addFields(
                    { name: '🎲 賭け金', value: `${betAmount}pt`, inline: true },
                    { name: won ? '💰 獲得' : '💸 損失', value: `${Math.abs(winAmount)}pt`, inline: true },
                    { name: '💎 残高', value: `${Math.floor(newBalance)}pt`, inline: true },
                )
                .setFooter({ text: won ? 'おめでとう！次も挑戦しよう！' : '次こそはきっと...！' })

            await interaction.reply({ embeds: [embed] })
            break
        }
    }
}
