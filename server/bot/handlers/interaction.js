/**
 * InteractionCreateイベントのハンドラー（ルーター）
 * スラッシュコマンドの実行を振り分ける
 */
import { Events, PermissionFlagsBits, EmbedBuilder } from 'discord.js'
import { handleBalance } from '../commands/balance.js'
import { handleEconomy } from '../commands/economy.js'
import { handleGacha } from '../commands/gacha.js'
import { handleRanking, handleRank, handleRpRanking, handleSeason } from '../commands/ranking.js'
import { handleShop, handleBuy } from '../commands/shop.js'

// ビルトインコマンドのMap: コマンド名 → ハンドラー関数
const builtinCommands = new Map()

/** ビルトインコマンドをMapに登録する */
function initBuiltinCommands() {
    // balance.js: balance, history, actions
    builtinCommands.set('balance', (interaction, dbHelpers, getPointRules) =>
        handleBalance(interaction, dbHelpers, 'balance'))
    builtinCommands.set('history', (interaction, dbHelpers, getPointRules) =>
        handleBalance(interaction, dbHelpers, 'history'))
    builtinCommands.set('actions', (interaction, dbHelpers, getPointRules) =>
        handleBalance(interaction, dbHelpers, 'actions', getPointRules))

    // economy.js: transfer, pay, daily
    builtinCommands.set('transfer', (interaction, dbHelpers) =>
        handleEconomy(interaction, dbHelpers, 'transfer'))
    builtinCommands.set('pay', (interaction, dbHelpers) =>
        handleEconomy(interaction, dbHelpers, 'pay'))
    builtinCommands.set('daily', (interaction, dbHelpers) =>
        handleEconomy(interaction, dbHelpers, 'daily'))

    // gacha.js: gacha, coinflip
    builtinCommands.set('gacha', (interaction, dbHelpers) =>
        handleGacha(interaction, dbHelpers, 'gacha'))
    builtinCommands.set('coinflip', (interaction, dbHelpers) =>
        handleGacha(interaction, dbHelpers, 'coinflip'))

    // ranking.js: ranking, rank, rp-ranking, season
    builtinCommands.set('ranking', (interaction, dbHelpers) =>
        handleRanking(interaction, dbHelpers))
    builtinCommands.set('rank', (interaction, dbHelpers) =>
        handleRank(interaction, dbHelpers))
    builtinCommands.set('rp-ranking', (interaction, dbHelpers) =>
        handleRpRanking(interaction, dbHelpers))
    builtinCommands.set('season', (interaction, dbHelpers) =>
        handleSeason(interaction, dbHelpers))

    // shop.js: shop, buy
    builtinCommands.set('shop', (interaction, dbHelpers) =>
        handleShop(interaction, dbHelpers))
    builtinCommands.set('buy', (interaction, dbHelpers) =>
        handleBuy(interaction, dbHelpers))

    // balance.js: mypoints（統合ビュー）
    builtinCommands.set('mypoints', (interaction, dbHelpers) =>
        handleBalance(interaction, dbHelpers, 'mypoints'))
}

// 初期化
initBuiltinCommands()

/**
 * テキスト内の変数を実際の値に置換する
 * @param {string} text - 置換対象のテキスト
 * @param {object} interaction - Discordインタラクション
 * @returns {string} 置換後のテキスト
 */
function replaceVariables(text, interaction) {
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

/**
 * InteractionCreateイベントハンドラーを登録する
 * @param {import('discord.js').Client} client - Discordクライアント
 * @param {Function} commandsGetter - ユーザー定義コマンドを取得する関数
 * @param {object} dbHelpers - db.jsのエクスポート
 * @param {Function} getPointRules - ポイントルール取得関数
 */
export function setupInteractionHandler(client, commandsGetter, dbHelpers, getPointRules) {
    client.on(Events.InteractionCreate, async (interaction) => {
        if (!interaction.isChatInputCommand()) return

        // ビルトインコマンドの処理
        const builtinHandler = builtinCommands.get(interaction.commandName)
        if (builtinHandler) {
            try {
                await builtinHandler(interaction, dbHelpers, getPointRules)
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

        // ユーザー定義コマンドの処理
        const commands = commandsGetter()
        const cmd = commands.find(c => c.name === interaction.commandName && c.enabled)
        if (!cmd) return

        try {
            await handleUserCommand(interaction, cmd, dbHelpers)
        } catch (err) {
            console.error(`Command ${cmd.name} error:`, err.message)
            try {
                await interaction.reply({ content: 'コマンドの実行中にエラーが発生しました。', ephemeral: true })
            } catch { }
        }
    })
}

/**
 * ユーザー定義コマンドを実行する
 * @param {object} interaction - Discordインタラクション
 * @param {object} cmd - コマンド定義
 * @param {object} dbHelpers - db.jsのエクスポート
 */
async function handleUserCommand(interaction, cmd, dbHelpers) {
    // 権限チェック
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

    // ロールチェック
    if (cmd.allowedRoles && cmd.allowedRoles.length > 0) {
        const hasRole = cmd.allowedRoles.some(roleId =>
            interaction.member?.roles?.cache?.has(roleId)
        )
        if (!hasRole) {
            await interaction.reply({ content: '❌ このコマンドを実行するロールがありません。', ephemeral: true })
            return
        }
    }

    // ポイントコスト確認・消費
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
        dbHelpers.addPoints(interaction.guild.id, interaction.user.id, -cmd.pointCost, 'command_cost', `コマンド /${cmd.name} 使用料`)
    }

    // ポイント報酬
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

    // レスポンステキストの組み立て
    let responseText = cmd.responseText || ''

    if (cmd.responseType === 'random' && cmd.randomResponses && cmd.randomResponses.length > 0) {
        responseText = cmd.randomResponses[Math.floor(Math.random() * cmd.randomResponses.length)]
    }

    responseText = replaceVariables(responseText, interaction)

    if (cmd.pointCost > 0) responseText += `\n💸 -${cmd.pointCost}pt 消費`
    if (pointRewardAmount > 0) responseText += `\n🎁 +${pointRewardAmount}pt 獲得！`

    // オプション変数の置換
    if (cmd.options && Array.isArray(cmd.options)) {
        cmd.options.forEach(opt => {
            let val = ''
            switch (opt.type) {
                case 'string': val = interaction.options.getString(opt.name) || ''; break
                case 'user': { const u = interaction.options.getUser(opt.name); val = u ? `<@${u.id}>` : ''; break }
                case 'integer': val = String(interaction.options.getInteger(opt.name) || ''); break
                case 'number': val = String(interaction.options.getNumber(opt.name) || ''); break
                case 'channel': { const ch = interaction.options.getChannel(opt.name); val = ch ? `<#${ch.id}>` : ''; break }
                case 'boolean': val = String(interaction.options.getBoolean(opt.name) ?? ''); break
                case 'role': { const r = interaction.options.getRole(opt.name); val = r ? `<@&${r.id}>` : ''; break }
            }
            responseText = responseText.replace(new RegExp(`\\{option:${opt.name}\\}`, 'g'), val)
        })
    }

    // 応答送信
    if (cmd.responseType === 'embed') {
        let embedDesc = (cmd.embedDescription || responseText)
        embedDesc = replaceVariables(embedDesc, interaction)

        const embed = new EmbedBuilder()
            .setColor(parseInt((cmd.embedColor || '#7c5cfc').replace('#', ''), 16))

        if (cmd.embedTitle) embed.setTitle(cmd.embedTitle)
        if (embedDesc) embed.setDescription(embedDesc)

        const pointInfo = []
        if (cmd.pointCost > 0) pointInfo.push(`💸 -${cmd.pointCost}pt`)
        if (pointRewardAmount > 0) pointInfo.push(`🎁 +${pointRewardAmount}pt`)
        if (pointInfo.length > 0) embed.setFooter({ text: pointInfo.join(' | ') })

        const replyOpts = { embeds: [embed], ephemeral: cmd.ephemeral || false }

        if (cmd.dmResponse) {
            await interaction.user.send(replyOpts).catch(() => { })
            await interaction.reply({ content: '📩 DMに送信しました！', ephemeral: true })
        } else {
            await interaction.reply(replyOpts)
        }
    } else {
        const replyOpts = { content: responseText, ephemeral: cmd.ephemeral || false }

        if (cmd.dmResponse) {
            await interaction.user.send(replyOpts).catch(() => { })
            await interaction.reply({ content: '📩 DMに送信しました！', ephemeral: true })
        } else {
            await interaction.reply(replyOpts)
        }
    }
}
