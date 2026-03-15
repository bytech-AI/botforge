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
            const rankInfo = dbHelpers.getMemberRank(guildId, targetUser.id)

            // RP進捗バー
            let rpDisplay, progressLine
            if (rankInfo.is_x_rank && rankInfo.x_rp !== null && rankInfo.x_rp !== undefined) {
                // Xランク: パワーゲージ表示
                const xProgress = rankInfo.x_max_rp > 0 ? Math.min(100, Math.floor((rankInfo.x_rp / rankInfo.x_max_rp) * 100)) : 100
                const filled = Math.floor(xProgress / 10)
                const progressBar = '█'.repeat(filled) + '░'.repeat(10 - filled)
                rpDisplay = `**${rankInfo.x_rp.toLocaleString()}** / ${rankInfo.x_max_rp.toLocaleString()} XP${rankInfo.x_tier_label ? ` (${rankInfo.x_tier_label})` : ''}`
                progressLine = `${progressBar} ${xProgress}%`
            } else if (rankInfo.is_max_rank) {
                rpDisplay = `**${rankInfo.current_rp.toLocaleString()}** RP`
                progressLine = '█'.repeat(10) + ' MAX'
            } else {
                const currentThreshold = rankInfo.rp_threshold
                const nextThreshold = rankInfo.next_rp_threshold
                const rangeSize = nextThreshold - currentThreshold
                const progressInRange = rankInfo.current_rp - currentThreshold
                const rpProgress = rangeSize > 0 ? Math.min(100, Math.floor((progressInRange / rangeSize) * 100)) : 100
                const filled = Math.floor(rpProgress / 10)
                const progressBar = '█'.repeat(filled) + '░'.repeat(10 - filled)
                rpDisplay = `**${rankInfo.current_rp.toLocaleString()}** / ${nextThreshold.toLocaleString()} RP${rankInfo.next_rank_label ? ` (次: ${rankInfo.next_rank_label})` : ''}`
                progressLine = `${progressBar} ${rpProgress}%`
            }

            const embed = new EmbedBuilder()
                .setColor(parseInt((rankInfo.color || '#7c5cfc').replace('#', ''), 16))
                .setTitle(`💰 ${targetUser.username} のウォレット`)
                .setThumbnail(targetUser.displayAvatarURL({ size: 64 }))
                .setDescription(`**${rankInfo.icon} ${rankInfo.rank_label}** (倍率 ×${rankInfo.cp_multiplier})`)
                .addFields(
                    { name: '📊 RP', value: rpDisplay, inline: false },
                    { name: '進捗', value: progressLine, inline: false },
                    { name: '💎 ポイント残高', value: `**${Math.floor(member.total_points).toLocaleString()}** pt`, inline: true },
                    { name: '🏆 ランキング', value: `#${rank}`, inline: true },
                    { name: '🔥 連続ログイン', value: `${member.streak_days}日`, inline: true },
                    { name: '💬 メッセージ', value: `${member.messages.toLocaleString()}`, inline: true },
                    { name: '⭐ リアクション', value: `${member.reactions.toLocaleString()}`, inline: true },
                    { name: '🎤 ボイス', value: `${member.voice_minutes.toLocaleString()}分`, inline: true },
                )
                .setFooter({ text: `累計獲得: ${Math.floor(member.total_earned || 0).toLocaleString()}pt | 最終: ${new Date(member.last_active).toLocaleDateString('ja-JP')}` })

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

        case 'mypoints': {
            // ポイント残高 + ランク + 直近履歴を1画面にまとめた統合ビュー
            const user = interaction.user
            const member = dbHelpers.getOrCreateMember(
                guildId, user.id, user.username,
                user.username, user.displayAvatarURL({ size: 32 })
            )
            const rank = dbHelpers.getUserRank(guildId, user.id)
            const rankInfo = dbHelpers.getMemberRank(guildId, user.id)
            const history = dbHelpers.getTransactionHistory(guildId, user.id, 5)

            // RP進捗を1行で表示
            let rpLine
            if (rankInfo.is_x_rank && rankInfo.x_rp !== null) {
                const pct = rankInfo.x_max_rp > 0 ? Math.min(100, Math.floor((rankInfo.x_rp / rankInfo.x_max_rp) * 100)) : 100
                const bar = '█'.repeat(Math.floor(pct / 10)) + '░'.repeat(10 - Math.floor(pct / 10))
                rpLine = `${bar} ${rankInfo.x_rp.toLocaleString()}/${rankInfo.x_max_rp.toLocaleString()} XP (${pct}%)`
            } else if (rankInfo.is_max_rank) {
                rpLine = '█'.repeat(10) + ` ${rankInfo.current_rp.toLocaleString()} RP — MAX`
            } else {
                const range = rankInfo.next_rp_threshold - rankInfo.rp_threshold
                const progress = rankInfo.current_rp - rankInfo.rp_threshold
                const pct = range > 0 ? Math.min(100, Math.floor((progress / range) * 100)) : 100
                const bar = '█'.repeat(Math.floor(pct / 10)) + '░'.repeat(10 - Math.floor(pct / 10))
                rpLine = `${bar} ${rankInfo.current_rp.toLocaleString()}/${rankInfo.next_rp_threshold.toLocaleString()} RP (${pct}%)`
            }

            // 直近の履歴
            let historyLines = '取引履歴がありません'
            if (history.length > 0) {
                historyLines = history.map(t => {
                    const time = new Date(t.created_at).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                    const sign = t.amount >= 0 ? '+' : ''
                    const emoji = t.type === 'earn' ? '⬆️' : t.type === 'transfer' ? '💸' : t.type === 'daily' ? '🎁' : t.type === 'reward' ? '🛒' : t.type === 'ai_scoring' ? '🤖' : '📝'
                    return `${emoji} \`${time}\` ${sign}**${t.amount.toLocaleString()}**pt — ${t.description || t.type}`
                }).join('\n')
            }

            // 活動サマリー
            const totalActivity = member.messages + member.reactions + member.voice_minutes
            let activityBreakdown = '活動記録なし'
            if (totalActivity > 0) {
                const msgPct = Math.round((member.messages / Math.max(1, totalActivity)) * 100)
                const reactPct = Math.round((member.reactions / Math.max(1, totalActivity)) * 100)
                const voicePct = 100 - msgPct - reactPct
                activityBreakdown = `💬 ${member.messages.toLocaleString()} (${msgPct}%) ⭐ ${member.reactions.toLocaleString()} (${reactPct}%) 🎤 ${member.voice_minutes.toLocaleString()}分 (${voicePct}%)`
            }

            const embed = new EmbedBuilder()
                .setColor(parseInt((rankInfo.color || '#7c5cfc').replace('#', ''), 16))
                .setAuthor({ name: `${user.username} のマイポイント`, iconURL: user.displayAvatarURL({ size: 32 }) })
                .addFields(
                    { name: `${rankInfo.icon} ${rankInfo.rank_label}`, value: rpLine, inline: false },
                    { name: '💎 ポイント', value: `**${Math.floor(member.total_points).toLocaleString()}** pt`, inline: true },
                    { name: '🏆 順位', value: `#${rank}`, inline: true },
                    { name: '🔥 連続', value: `${member.streak_days}日`, inline: true },
                    { name: '📊 活動内訳', value: activityBreakdown, inline: false },
                    { name: '📜 最近の獲得・消費', value: historyLines, inline: false },
                )
                .setFooter({ text: `累計: ${Math.floor(member.total_earned || 0).toLocaleString()}pt | /history で詳細表示` })
                .setTimestamp()

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
            lines.push('`/rank` — ランク詳細')
            lines.push('`/rp-ranking` — RPランキング')
            lines.push('`/season` — シーズン情報')
            lines.push('`/history` — 取引履歴')
            lines.push('`/gacha` — ガチャ')
            lines.push('`/coinflip` — コインフリップ')

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
