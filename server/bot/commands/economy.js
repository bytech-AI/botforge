/**
 * 経済系コマンド: /transfer, /pay, /daily
 */
import { EmbedBuilder } from 'discord.js'

/**
 * economy系コマンドを処理する
 * @param {object} interaction - Discordインタラクション
 * @param {object} dbHelpers - db.jsのエクスポート
 * @param {string} subCommand - 'transfer' | 'pay' | 'daily'
 */
export async function handleEconomy(interaction, dbHelpers, subCommand) {
    const guildId = interaction.guild?.id
    if (!guildId) {
        await interaction.reply({ content: '❌ このコマンドはサーバー内でのみ使用できます。', ephemeral: true })
        return
    }

    switch (subCommand) {
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

            const dailyTotal = dbHelpers.getDailyTransferTotal(guildId, interaction.user.id)
            if (dailyTotal + amount > settings.daily_transfer_limit) {
                await interaction.reply({
                    content: `❌ 1日の送金上限 (**${settings.daily_transfer_limit.toLocaleString()}pt**) を超えます。\n今日の送金済み: **${dailyTotal.toLocaleString()}pt** / 残り: **${(settings.daily_transfer_limit - dailyTotal).toLocaleString()}pt**`,
                    ephemeral: true
                })
                return
            }

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
    }
}
