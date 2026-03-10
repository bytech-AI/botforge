/**
 * ランキングコマンド: /ranking, /rank, /rp-ranking, /season
 */
import { EmbedBuilder } from 'discord.js'

/**
 * rankingコマンドを処理する（CPベース）
 * @param {object} interaction - Discordインタラクション
 * @param {object} dbHelpers - db.jsのエクスポート
 */
export async function handleRanking(interaction, dbHelpers) {
    const guildId = interaction.guild?.id
    if (!guildId) {
        await interaction.reply({ content: '❌ このコマンドはサーバー内でのみ使用できます。', ephemeral: true })
        return
    }

    const leaderboard = dbHelpers.getLeaderboard(guildId, 10)
    if (leaderboard.length === 0) {
        await interaction.reply({ content: '📊 まだランキングデータがありません。アクティブに活動してポイントを貯めましょう！', ephemeral: true })
        return
    }

    const medals = ['🥇', '🥈', '🥉']
    const lines = leaderboard.map((m, i) => {
        const medal = i < 3 ? medals[i] : `\`${i + 1}.\``
        const rankInfo = dbHelpers.getMemberRank(guildId, m.user_id)
        return `${medal} **${m.display_name || m.username}** — ${Math.floor(m.total_points).toLocaleString()} pt\n　　${rankInfo.icon} ${rankInfo.rank_label} (×${rankInfo.cp_multiplier}) | RP: ${rankInfo.current_rp.toLocaleString()}`
    })

    const embed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle('🏆 ポイントランキング TOP10')
        .setDescription(lines.join('\n'))
        .setFooter({ text: `${interaction.guild.name} のランキング` })
        .setTimestamp()

    await interaction.reply({ embeds: [embed] })
}

/**
 * /rank コマンド: ランク詳細表示
 */
export async function handleRank(interaction, dbHelpers) {
    const guildId = interaction.guild?.id
    if (!guildId) {
        await interaction.reply({ content: '❌ このコマンドはサーバー内でのみ使用できます。', ephemeral: true })
        return
    }

    const targetUser = interaction.options.getUser('user') || interaction.user
    const rankInfo = dbHelpers.getMemberRank(guildId, targetUser.id)
    const config = dbHelpers.getRankConfig(guildId)
    const currentIdx = config.findIndex(r => r.rank_key === rankInfo.current_rank_key)
    const nextRank = currentIdx < config.length - 1 ? config[currentIdx + 1] : null

    // per-rank方式: 通常ランクは0〜promotion_threshold、Xランクは上限なし
    let rpProgress, progressBar
    if (rankInfo.is_special) {
        rpProgress = 100
        progressBar = '█'.repeat(14) + ' MAX'
    } else {
        const threshold = rankInfo.promotion_threshold || 99
        rpProgress = Math.min(100, Math.floor((rankInfo.current_rp / threshold) * 100))
        const filled = Math.floor(rpProgress / 7)
        progressBar = '█'.repeat(filled) + '░'.repeat(14 - filled)
    }

    let exemptText = ''
    if (rankInfo.decay_exempt) {
        exemptText = rankInfo.decay_exempt_until
            ? `\n🛡️ 減衰免除中（${new Date(rankInfo.decay_exempt_until).toLocaleDateString('ja-JP')}まで）`
            : '\n🛡️ 減衰免除中（無期限）'
    }

    const embed = new EmbedBuilder()
        .setColor(parseInt((rankInfo.color || '#808080').replace('#', ''), 16))
        .setTitle(`${rankInfo.icon} ${targetUser.username} のランク`)
        .setThumbnail(targetUser.displayAvatarURL({ size: 64 }))
        .setDescription(
            `**${rankInfo.rank_label}** (CP倍率 ×${rankInfo.cp_multiplier})\n` +
            `📊 RP: **${rankInfo.current_rp.toLocaleString()}**` +
            (rankInfo.is_special ? '' : ` / ${rankInfo.promotion_threshold || 99}`) +
            (nextRank ? ` (次: ${nextRank.rank_label})` : '') + '\n' +
            `[${progressBar}]` + (rankInfo.is_special ? '' : ` ${rpProgress}%`) +
            exemptText
        )

    await interaction.reply({ embeds: [embed], ephemeral: true })
}

/**
 * /rp-ranking コマンド: RPベースランキング
 */
export async function handleRpRanking(interaction, dbHelpers) {
    const guildId = interaction.guild?.id
    if (!guildId) {
        await interaction.reply({ content: '❌ このコマンドはサーバー内でのみ使用できます。', ephemeral: true })
        return
    }

    const leaderboard = dbHelpers.getRpLeaderboard(guildId, 10)
    if (leaderboard.length === 0) {
        await interaction.reply({ content: '📊 まだランキングデータがありません。', ephemeral: true })
        return
    }

    const config = dbHelpers.getRankConfig(guildId)
    const medals = ['🥇', '🥈', '🥉']
    const lines = leaderboard.map((m, i) => {
        const medal = i < 3 ? medals[i] : `\`${i + 1}.\``
        const ri = config.find(r => r.rank_key === m.current_rank_key) || config[0]
        return `${medal} **${m.display_name || m.username || m.user_id}** — RP: ${m.current_rp.toLocaleString()}\n　　${ri.icon} ${ri.rank_label} (×${ri.cp_multiplier})`
    })

    const embed = new EmbedBuilder()
        .setColor(0xff6b6b)
        .setTitle('🏅 RPランキング TOP10')
        .setDescription(lines.join('\n'))
        .setFooter({ text: `${interaction.guild.name} のRPランキング` })
        .setTimestamp()

    await interaction.reply({ embeds: [embed] })
}

/**
 * /season コマンド: シーズン情報表示
 */
export async function handleSeason(interaction, dbHelpers) {
    const guildId = interaction.guild?.id
    if (!guildId) {
        await interaction.reply({ content: '❌ このコマンドはサーバー内でのみ使用できます。', ephemeral: true })
        return
    }

    const config = dbHelpers.getSeasonConfig(guildId)
    if (!config.enabled) {
        await interaction.reply({ content: '⏸️ シーズンボーナスは現在無効です。', ephemeral: true })
        return
    }

    const nextEnd = dbHelpers.getNextSeasonEnd(guildId)
    const daysLeft = Math.ceil((new Date(nextEnd) - new Date()) / 86400000)

    // 自分のRP順位を取得
    const lb = dbHelpers.getRpLeaderboard(guildId, 9999)
    const myIdx = lb.findIndex(m => m.user_id === interaction.user.id)
    const myPosition = myIdx >= 0 ? myIdx + 1 : '-'
    const myRankInfo = dbHelpers.getMemberRank(guildId, interaction.user.id)

    // 予想ボーナス計算
    let expectedBonus = 0
    const dist = config.bonus_distribution || {}
    if (dist.rank_bonuses && dist.rank_bonuses[myRankInfo.current_rank_key]) {
        expectedBonus += dist.rank_bonuses[myRankInfo.current_rank_key]
    }
    if (dist.top_bonuses && myIdx >= 0) {
        for (const tb of dist.top_bonuses) {
            if (myPosition >= tb.rank_from && myPosition <= tb.rank_to) {
                expectedBonus += tb.bonus
                break
            }
        }
    }

    const cycleLabel = config.cycle_type === 'months' ? `${config.cycle_value}ヶ月` : `${config.cycle_value}日`

    const embed = new EmbedBuilder()
        .setColor(0xf39c12)
        .setTitle('🏆 シーズン情報')
        .setDescription(
            `**周期:** ${cycleLabel}ごと\n` +
            `**シーズン終了:** ${nextEnd}（残り${daysLeft}日）\n\n` +
            `**あなたの現在:**\n` +
            `${myRankInfo.icon} ${myRankInfo.rank_label} | RP: ${myRankInfo.current_rp.toLocaleString()} | 順位: ${myPosition}位\n\n` +
            `**予想シーズンボーナス:** +${expectedBonus.toLocaleString()} RP`
        )
        .setFooter({ text: '頑張ってランクを上げよう！' })

    await interaction.reply({ embeds: [embed], ephemeral: true })
}
