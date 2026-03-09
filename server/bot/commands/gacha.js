/**
 * ガチャ系コマンド: /gacha, /coinflip
 */
import { EmbedBuilder } from 'discord.js'

/**
 * gacha系コマンドを処理する
 * @param {object} interaction - Discordインタラクション
 * @param {object} dbHelpers - db.jsのエクスポート
 * @param {string} subCommand - 'gacha' | 'coinflip'
 */
export async function handleGacha(interaction, dbHelpers, subCommand) {
    const guildId = interaction.guild?.id
    if (!guildId) {
        await interaction.reply({ content: '❌ このコマンドはサーバー内でのみ使用できます。', ephemeral: true })
        return
    }

    switch (subCommand) {
        case 'gacha': {
            const gachaSettings = dbHelpers.getGachaSettings()
            const gacha = gachaSettings[0]
            if (!gacha || !gacha.enabled) {
                await interaction.reply({ content: '🎰 ガチャは現在利用できません。', ephemeral: true })
                return
            }

            const member = dbHelpers.getOrCreateMember(guildId, interaction.user.id, interaction.user.username, interaction.user.username, interaction.user.displayAvatarURL({ size: 32 }))
            if (member.total_points < gacha.cost) {
                await interaction.reply({
                    content: `❌ ポイントが不足しています。ガチャには **${gacha.cost}pt** 必要です（残高: ${Math.floor(member.total_points)}pt）`,
                    ephemeral: true
                })
                return
            }

            // コスト消費
            dbHelpers.addPoints(guildId, interaction.user.id, -gacha.cost, 'gacha', `ガチャ使用 (${gacha.name})`)

            // 抽選
            const result = dbHelpers.rollGacha(gacha.items)

            // 報酬付与
            if (result.points > 0) {
                dbHelpers.addPoints(guildId, interaction.user.id, result.points, 'gacha_reward', `ガチャ報酬: ${result.name}`)
            }

            // レアリティに応じた色
            const color = result.points >= 500 ? 0xff4500 : result.points >= 100 ? 0xffd700 : 0x808080
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

            const member = dbHelpers.getOrCreateMember(guildId, interaction.user.id, interaction.user.username, interaction.user.username, interaction.user.displayAvatarURL({ size: 32 }))
            if (member.total_points < betAmount) {
                await interaction.reply({
                    content: `❌ ポイントが不足しています（残高: ${Math.floor(member.total_points)}pt）`,
                    ephemeral: true
                })
                return
            }

            // コインフリップ
            const won = Math.random() < 0.5
            const winAmount = won ? betAmount : -betAmount

            dbHelpers.addPoints(guildId, interaction.user.id, winAmount, 'coinflip', won ? `コインフリップ勝利 (+${betAmount}pt)` : `コインフリップ敗北 (-${betAmount}pt)`)

            const newBalance = member.total_points + winAmount
            const resultText = won ? '🎉 表（WIN）' : '💀 裏（LOSE）'

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
