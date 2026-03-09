/**
 * 残高確認系コマンド: /balance, /history, /actions
 */
import { EmbedBuilder } from 'discord.js'

/**
 * balance系コマンドを処理する
 * @param {object} interaction - Discordインタラクション
 * @param {object} dbHelpers - db.jsのエクスポート
 * @param {string} subCommand - 'balance' | 'history' | 'actions'
 * @param {Function} [getPointRules] - actionsコマンド用のルール取得関数
 */
export async function handleBalance(interaction, dbHelpers, subCommand, getPointRules) {
    const guildId = interaction.guild?.id
    if (!guildId) {
        await interaction.reply({ content: '❌ このコマンドはサーバー内でのみ使用できます。', ephemeral: true })
        return
    }

    switch (subCommand) {
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
    }
}
