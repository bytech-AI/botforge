/**
 * ショップ系コマンド: /shop, /buy
 */
import { EmbedBuilder } from 'discord.js'

export async function handleShop(interaction, dbHelpers) {
    const guildId = interaction.guild?.id
    if (!guildId) {
        await interaction.reply({ content: '❌ このコマンドはサーバー内でのみ使用できます。', ephemeral: true })
        return
    }

    const rewards = dbHelpers.getAllRewards().filter(r => r.enabled)
    if (rewards.length === 0) {
        await interaction.reply({ content: '🏪 ショップには商品がありません。', ephemeral: true })
        return
    }

    const lines = rewards.map((r, i) => {
        const stock = r.stock === -1 ? '∞' : Math.max(0, r.stock - (r.claimed || 0))
        return `**${i + 1}.** ${r.icon} **${r.name}** — ${r.cost.toLocaleString()}pt\n┗ ${r.description || 'No description'} (在庫: ${stock})`
    })

    const embed = new EmbedBuilder()
        .setColor(0x7c5cfc)
        .setTitle('🏪 報酬ショップ')
        .setDescription(lines.join('\n\n'))
        .setFooter({ text: '購入: /buy <番号>' })

    await interaction.reply({ embeds: [embed], ephemeral: true })
}

export async function handleBuy(interaction, dbHelpers) {
    const guildId = interaction.guild?.id
    if (!guildId) {
        await interaction.reply({ content: '❌ このコマンドはサーバー内でのみ使用できます。', ephemeral: true })
        return
    }

    const itemNumber = interaction.options.getInteger('item')
    const rewards = dbHelpers.getAllRewards().filter(r => r.enabled)

    if (!itemNumber || itemNumber < 1 || itemNumber > rewards.length) {
        await interaction.reply({ content: `❌ 1〜${rewards.length} の番号を指定してください。`, ephemeral: true })
        return
    }

    const reward = rewards[itemNumber - 1]

    // 在庫チェック
    if (reward.stock !== -1 && (reward.claimed || 0) >= reward.stock) {
        await interaction.reply({ content: '❌ この商品は売り切れです。', ephemeral: true })
        return
    }

    // ポイントチェック
    const member = dbHelpers.getOrCreateMember(guildId, interaction.user.id, interaction.user.username, interaction.user.username, interaction.user.displayAvatarURL({ size: 32 }))
    if (member.total_points < reward.cost) {
        await interaction.reply({ content: `❌ ポイントが不足しています（必要: ${reward.cost}pt / 残高: ${Math.floor(member.total_points)}pt）`, ephemeral: true })
        return
    }

    // ポイント消費
    dbHelpers.addPoints(guildId, interaction.user.id, -reward.cost, 'reward', `報酬交換: ${reward.name}`)

    // claimed カウント増加
    dbHelpers.updateReward(reward.id, { ...reward, claimed: (reward.claimed || 0) + 1 })

    // ロール付与（type === 'role' && role_id がある場合）
    let roleGranted = false
    if (reward.type === 'role' && reward.role_id) {
        try {
            const guildObj = interaction.guild
            const memberObj = await guildObj.members.fetch(interaction.user.id)
            const role = guildObj.roles.cache.get(reward.role_id)
            if (role && memberObj) {
                await memberObj.roles.add(role)
                roleGranted = true
            }
        } catch (err) {
            console.error('Role grant error:', err.message)
        }
    }

    const embed = new EmbedBuilder()
        .setColor(0x00d4aa)
        .setTitle('🎁 購入完了！')
        .setDescription(`${reward.icon} **${reward.name}** を交換しました！\n\n💸 -${reward.cost}pt${roleGranted ? '\n✅ ロールが付与されました！' : ''}`)
        .setFooter({ text: `残高: ${Math.floor(member.total_points - reward.cost)}pt` })

    await interaction.reply({ embeds: [embed], ephemeral: true })
}
