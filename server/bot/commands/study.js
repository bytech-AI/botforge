/**
 * /study: 学習サイト（LMS）での学習状況を表示する（本人にだけ見える）
 */
import { EmbedBuilder } from 'discord.js'
import { fetchLmsStudy, getLmsBaseUrl } from '../../integrations/lms.js'

/** 進み具合のバー（10マス） */
export function progressBar(percent) {
    const filled = Math.max(0, Math.min(10, Math.round(percent / 10)))
    return '▰'.repeat(filled) + '▱'.repeat(10 - filled)
}

/** LMS が返した学習状況から、表示する Embed を作る */
export function buildStudyEmbed(data, rank) {
    const courses = Array.isArray(data.courses) ? data.courses.slice(0, 5) : []
    const courseLines = courses.length
        ? courses.map(c => `**${c.title}**\n${progressBar(c.progressPercent)} ${c.progressPercent}%`).join('\n')
        : 'まだ受講中のコースはありません'
    const lastStudied = data.lastStudiedAt ? `<t:${Math.floor(new Date(data.lastStudiedAt).getTime() / 1000)}:R>` : 'まだありません'

    const embed = new EmbedBuilder()
        .setColor(0x4f7cff)
        .setTitle(`📚 ${data.displayName || ''}さんの学習状況`.trim())
        .addFields(
            { name: '受講中のコース', value: courseLines },
            { name: '完了したレッスン', value: `${data.completedLessons ?? 0} 本`, inline: true },
            { name: '最後に学習した日', value: lastStudied, inline: true },
        )
        .setTimestamp()
    if (rank) embed.addFields({ name: 'ランク', value: `${rank.icon} ${rank.rank_label}（RP ${rank.current_rp.toLocaleString()}）`, inline: true })
    if (data.mypageUrl) embed.setURL(data.mypageUrl)
    return embed
}

export async function handleStudy(interaction, dbHelpers) {
    await interaction.deferReply({ ephemeral: true })
    const result = await fetchLmsStudy(interaction.user.id)

    if (!result.ok) {
        const content = result.error === 'not_configured'
            ? '❌ 学習サイトとの連携がまだ設定されていません。運営にお知らせください。'
            : '⚠️ 学習サイトから学習状況を受け取れませんでした。少し時間をおいてもう一度お試しください。'
        await interaction.editReply({ content })
        return
    }

    const data = result.data
    if (!data.linked) {
        await interaction.editReply({
            content: `🔗 この Discord アカウントは、まだ学習サイトと連携されていません。\n学習サイトのマイページの「Discord と連携」から連携すると、学習するたびに RP とポイントが貯まります。\n${getLmsBaseUrl()}/mypage`,
        })
        return
    }

    let rank = null
    try {
        if (interaction.guild?.id) rank = dbHelpers.getMemberRank(interaction.guild.id, interaction.user.id)
    } catch { }
    await interaction.editReply({ embeds: [buildStudyEmbed(data, rank)] })
}
