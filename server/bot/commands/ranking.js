/**
 * ランキングコマンド: /ranking
 */
import { EmbedBuilder } from 'discord.js'

/**
 * rankingコマンドを処理する
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
}
