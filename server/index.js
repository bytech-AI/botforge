import express from 'express'
import cors from 'cors'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import {
    connectBot, disconnectBot, getBotStatus, clearToken,
    autoReconnect, getGuilds, getGuildMembers,
    registerSlashCommands, fetchRegisteredCommands, deleteRegisteredCommand, setupHandlers
} from './bot.js'
import {
    initDatabase, getDb,
    getAllCommands, createCommand, updateCommand, deleteCommand,
    getAllPointRules, updatePointRules,
    getAllRewards, createReward, updateReward, deleteReward,
    getLeaderboard, getPointStats, getEconomySettings, updateEconomySettings,
    getOrCreateMember, addPoints, getTransactionHistory, getUserRank,
    getGachaSettings, updateGachaSettings,
    // 6機能バックエンド
    getAllAutoResponses, createAutoResponse, updateAutoResponse, deleteAutoResponse,
    getModerationSettings, updateModerationSettings,
    getAllScheduledMessages, createScheduledMessage, updateScheduledMessage, deleteScheduledMessage,
    getWelcomeSettings, updateWelcomeSettings,
    getAllEmbedTemplates, createEmbedTemplate, updateEmbedTemplate, deleteEmbedTemplate,
    getChannelMultipliers, updateChannelMultipliers,
    getPointDecaySettings, updatePointDecaySettings,
    // RPシステム
    getRankConfig, updateRankConfig, addRankTier, removeRankTier,
    getRankSettings, updateRankSettings,
    getRpRules, updateRpRules,
    getMemberRank, addRp, getRpLeaderboard, getRpHistory,
    getSeasonConfig, updateSeasonConfig, getNextSeasonEnd, getSeasonHistory,
    checkAndExecuteSeason, recalculateAllRanks,
    setDecayExempt, getDecayExemptMembers,
    applyDecay, cleanupOldRpTransactions,
    acquireCronLock, cleanupCronLocks,
} from './db.js'
import cron from 'node-cron'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

// Initialize database
const db = initDatabase()

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(join(__dirname, '..', 'dist')))
}

// ============================
// Bot Connection API
// ============================
app.post('/api/bot/connect', async (req, res) => {
    const { token } = req.body
    if (!token) return res.status(400).json({ error: 'トークンが必要です' })

    try {
        const result = await connectBot(token)
        setupHandlers(() => getAllCommands(), db)
        res.json(result)
    } catch (err) {
        res.status(400).json({ error: err.message || '接続に失敗しました' })
    }
})

app.post('/api/bot/disconnect', async (req, res) => {
    try {
        await disconnectBot()
        clearToken()
        res.json({ success: true })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

app.get('/api/bot/status', (req, res) => {
    res.json(getBotStatus())
})

// ============================
// Guild (Server) API
// ============================
app.get('/api/guilds', (req, res) => {
    res.json(getGuilds())
})

app.get('/api/guilds/:guildId/members', async (req, res) => {
    try {
        const members = await getGuildMembers(req.params.guildId)
        res.json(members)
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// ============================
// Commands API (DB-backed)
// ============================
app.get('/api/commands', (req, res) => {
    try {
        res.json(getAllCommands())
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

app.post('/api/commands', (req, res) => {
    try {
        const cmd = createCommand(req.body)
        res.json(cmd)
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

app.put('/api/commands/:id', (req, res) => {
    try {
        updateCommand(parseInt(req.params.id), req.body)
        res.json({ success: true })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

app.delete('/api/commands/:id', (req, res) => {
    try {
        deleteCommand(parseInt(req.params.id))
        res.json({ success: true })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// Sync commands to Discord
app.post('/api/commands/sync', async (req, res) => {
    const { guildId } = req.body
    try {
        const commands = getAllCommands()
        const result = await registerSlashCommands(commands, guildId)
        res.json(result)
    } catch (err) {
        res.status(400).json({ error: err.message })
    }
})

// Fetch registered commands from Discord
app.get('/api/commands/registered', async (req, res) => {
    const { guildId } = req.query
    try {
        const registered = await fetchRegisteredCommands(guildId)
        res.json(registered)
    } catch (err) {
        res.status(400).json({ error: err.message })
    }
})

// Delete a registered Discord command
app.delete('/api/commands/registered/:commandId', async (req, res) => {
    const { guildId } = req.query
    try {
        const result = await deleteRegisteredCommand(req.params.commandId, guildId)
        res.json(result)
    } catch (err) {
        res.status(400).json({ error: err.message })
    }
})

// ============================
// Points Rules API (DB-backed)
// ============================
app.get('/api/points/rules', (req, res) => {
    try {
        res.json(getAllPointRules())
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

app.put('/api/points/rules', (req, res) => {
    try {
        updatePointRules(req.body)
        res.json({ success: true })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// ============================
// Points Leaderboard API
// ============================
app.get('/api/points/leaderboard', (req, res) => {
    const { guildId } = req.query
    if (!guildId) return res.json([])
    try {
        const leaderboard = getLeaderboard(guildId, 50)
        const enriched = leaderboard.map(m => {
            const rankInfo = getMemberRank(guildId, m.user_id)
            return {
                ...m,
                rank_key: rankInfo.current_rank_key,
                rank_label: rankInfo.rank_label,
                cp_multiplier: rankInfo.cp_multiplier,
                current_rp: rankInfo.current_rp,
                rank_color: rankInfo.color,
                rank_icon: rankInfo.icon,
            }
        })
        res.json(enriched)
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// ============================
// Points Stats API
// ============================
app.get('/api/points/stats', (req, res) => {
    const { guildId } = req.query
    if (!guildId) return res.json({ totalPointsIssued: 0, averagePoints: 0, maxStreak: 0, rewardsClaimed: 0 })
    try {
        const stats = getPointStats(guildId)
        res.json(stats)
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// ============================
// Points Member API
// ============================
app.get('/api/points/members/:userId', (req, res) => {
    const { guildId } = req.query
    if (!guildId) return res.status(400).json({ error: 'guildIdが必要です' })
    try {
        const member = getOrCreateMember(guildId, req.params.userId)
        const rank = getUserRank(guildId, req.params.userId)
        const rankInfo = getMemberRank(guildId, req.params.userId)
        res.json({
            ...member, rank,
            rank_key: rankInfo.current_rank_key,
            rank_label: rankInfo.rank_label,
            cp_multiplier: rankInfo.cp_multiplier,
            current_rp: rankInfo.current_rp,
            rank_color: rankInfo.color,
            rank_icon: rankInfo.icon,
        })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// Admin adjust points
app.post('/api/points/adjust', (req, res) => {
    const { guildId, userId, amount, reason } = req.body
    if (!guildId || !userId || amount === undefined) {
        return res.status(400).json({ error: 'guildId, userId, amountが必要です' })
    }
    try {
        const result = addPoints(guildId, userId, amount, 'admin_adjust', reason || '管理者による調整')
        res.json(result)
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// ============================
// Points Transaction History API
// ============================
app.get('/api/points/transactions', (req, res) => {
    const { guildId, userId, limit } = req.query
    if (!guildId) return res.json([])
    try {
        if (userId) {
            const history = getTransactionHistory(guildId, userId, parseInt(limit) || 20)
            res.json(history)
        } else {
            const history = db.prepare('SELECT * FROM point_transactions WHERE guild_id = ? ORDER BY created_at DESC LIMIT ?')
                .all(guildId, parseInt(limit) || 50)
            res.json(history)
        }
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// ============================
// Points Actions List API
// ============================
app.get('/api/points/actions', (req, res) => {
    try {
        const rules = getAllPointRules()
        const actions = rules.filter(r => r.enabled).map(r => ({
            action: r.action,
            label: r.label,
            icon: r.icon,
            points: r.points,
            cooldown: r.cooldown,
            description: getActionDescription(r.action)
        }))
        res.json(actions)
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

function getActionDescription(action) {
    const descriptions = {
        'message': 'テキストチャンネルでメッセージを送信するとポイントを獲得',
        'reaction_give': '他のメンバーのメッセージにリアクションを付けるとポイントを獲得',
        'reaction_receive': '自分のメッセージにリアクションを付けてもらうとポイントを獲得',
        'voice_join': 'ボイスチャンネルに参加している間、毎分ポイントを獲得',
        'invite': 'サーバーに新しいメンバーを招待するとポイントを獲得',
        'thread_create': 'スレッドを作成するとポイントを獲得',
    }
    return descriptions[action] || 'アクティビティでポイントを獲得'
}

// ============================
// Points Economy Settings API
// ============================
app.get('/api/points/economy', (req, res) => {
    const { guildId } = req.query
    if (!guildId) return res.json({
        transfer_fee_percent: 5, min_transfer_amount: 10,
        daily_transfer_limit: 10000, daily_bonus_amount: 50,
        daily_bonus_streak_multiplier: 1.1, max_daily_bonus: 200, enabled: 1
    })
    try {
        const settings = getEconomySettings(guildId)
        res.json(settings)
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

app.put('/api/points/economy', (req, res) => {
    const { guildId } = req.query
    if (!guildId) return res.status(400).json({ error: 'guildIdが必要です' })
    try {
        const settings = updateEconomySettings(guildId, req.body)
        res.json(settings)
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// ============================
// Rewards API (DB-backed)
// ============================
app.get('/api/rewards', (req, res) => {
    try {
        res.json(getAllRewards())
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

app.post('/api/rewards', (req, res) => {
    try {
        const reward = createReward(req.body)
        res.json(reward)
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

app.put('/api/rewards/:id', (req, res) => {
    try {
        updateReward(parseInt(req.params.id), req.body)
        res.json({ success: true })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

app.delete('/api/rewards/:id', (req, res) => {
    try {
        deleteReward(parseInt(req.params.id))
        res.json({ success: true })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// ============================
// Gacha Settings API
// ============================
app.get('/api/gacha/settings', (req, res) => {
    try {
        res.json(getGachaSettings())
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

app.put('/api/gacha/settings/:id', (req, res) => {
    try {
        updateGachaSettings(parseInt(req.params.id), req.body)
        res.json({ success: true })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// ============================
// Auto Response API
// ============================
app.get('/api/auto-responses', (req, res) => {
    const { guildId } = req.query
    try {
        res.json(getAllAutoResponses(guildId))
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

app.post('/api/auto-responses', (req, res) => {
    try {
        const ar = createAutoResponse(req.body)
        res.json(ar)
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

app.put('/api/auto-responses/:id', (req, res) => {
    try {
        updateAutoResponse(parseInt(req.params.id), req.body)
        res.json({ success: true })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

app.delete('/api/auto-responses/:id', (req, res) => {
    try {
        deleteAutoResponse(parseInt(req.params.id))
        res.json({ success: true })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// ============================
// Moderation Settings API
// ============================
app.get('/api/moderation/settings', (req, res) => {
    const { guildId } = req.query
    if (!guildId) return res.status(400).json({ error: 'guildIdが必要です' })
    try {
        res.json(getModerationSettings(guildId))
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

app.put('/api/moderation/settings', (req, res) => {
    const { guildId } = req.query
    if (!guildId) return res.status(400).json({ error: 'guildIdが必要です' })
    try {
        getModerationSettings(guildId) // ensure exists
        updateModerationSettings(guildId, req.body)
        res.json({ success: true })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// ============================
// Scheduled Messages API
// ============================
app.get('/api/scheduled-messages', (req, res) => {
    const { guildId } = req.query
    if (!guildId) return res.json([])
    try {
        res.json(getAllScheduledMessages(guildId))
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

app.post('/api/scheduled-messages', (req, res) => {
    try {
        const msg = createScheduledMessage(req.body)
        res.json(msg)
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

app.put('/api/scheduled-messages/:id', (req, res) => {
    try {
        updateScheduledMessage(parseInt(req.params.id), req.body)
        res.json({ success: true })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

app.delete('/api/scheduled-messages/:id', (req, res) => {
    try {
        deleteScheduledMessage(parseInt(req.params.id))
        res.json({ success: true })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// ============================
// Welcome Settings API
// ============================
app.get('/api/welcome-settings', (req, res) => {
    const { guildId } = req.query
    if (!guildId) return res.status(400).json({ error: 'guildIdが必要です' })
    try {
        res.json(getWelcomeSettings(guildId))
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

app.put('/api/welcome-settings', (req, res) => {
    const { guildId } = req.query
    if (!guildId) return res.status(400).json({ error: 'guildIdが必要です' })
    try {
        getWelcomeSettings(guildId) // ensure exists
        updateWelcomeSettings(guildId, req.body)
        res.json({ success: true })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// ============================
// Embed Templates API
// ============================
app.get('/api/embed-templates', (req, res) => {
    const { guildId } = req.query
    if (!guildId) return res.json([])
    try {
        res.json(getAllEmbedTemplates(guildId))
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

app.post('/api/embed-templates', (req, res) => {
    try {
        const template = createEmbedTemplate(req.body)
        res.json(template)
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

app.put('/api/embed-templates/:id', (req, res) => {
    try {
        updateEmbedTemplate(parseInt(req.params.id), req.body)
        res.json({ success: true })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

app.delete('/api/embed-templates/:id', (req, res) => {
    try {
        deleteEmbedTemplate(parseInt(req.params.id))
        res.json({ success: true })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// ============================
// Channel Multipliers API
// ============================
app.get('/api/points/channel-multipliers', (req, res) => {
    const { guildId } = req.query
    if (!guildId) return res.json([])
    try {
        res.json(getChannelMultipliers(guildId))
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

app.put('/api/points/channel-multipliers', (req, res) => {
    const { guildId } = req.query
    if (!guildId) return res.status(400).json({ error: 'guildIdが必要です' })
    try {
        updateChannelMultipliers(guildId, req.body.multipliers || [])
        res.json({ success: true })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// ============================
// Point Decay Settings API
// ============================
app.get('/api/points/decay-settings', (req, res) => {
    const { guildId } = req.query
    if (!guildId) return res.status(400).json({ error: 'guildIdが必要です' })
    try {
        res.json(getPointDecaySettings(guildId))
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

app.put('/api/points/decay-settings', (req, res) => {
    const { guildId } = req.query
    if (!guildId) return res.status(400).json({ error: 'guildIdが必要です' })
    try {
        getPointDecaySettings(guildId) // ensure exists
        updatePointDecaySettings(guildId, req.body)
        res.json({ success: true })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// ============================
// Rank System API
// ============================

// ランク設定
app.get('/api/ranks/config', (req, res) => {
    const { guildId } = req.query
    if (!guildId) return res.status(400).json({ error: 'guildIdが必要です' })
    try {
        res.json(getRankConfig(guildId))
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

app.put('/api/ranks/config', (req, res) => {
    const { guildId } = req.query
    if (!guildId) return res.status(400).json({ error: 'guildIdが必要です' })
    try {
        updateRankConfig(guildId, req.body.ranks || [])
        res.json({ success: true })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

app.post('/api/ranks/config/tier', (req, res) => {
    const { guildId } = req.query
    if (!guildId) return res.status(400).json({ error: 'guildIdが必要です' })
    try {
        addRankTier(guildId, req.body)
        res.json({ success: true })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

app.delete('/api/ranks/config/tier/:rankKey', (req, res) => {
    const { guildId } = req.query
    if (!guildId) return res.status(400).json({ error: 'guildIdが必要です' })
    try {
        removeRankTier(guildId, req.params.rankKey)
        res.json({ success: true })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// 減衰設定
app.get('/api/ranks/settings', (req, res) => {
    const { guildId } = req.query
    if (!guildId) return res.status(400).json({ error: 'guildIdが必要です' })
    try {
        res.json(getRankSettings(guildId))
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

app.put('/api/ranks/settings', (req, res) => {
    const { guildId } = req.query
    if (!guildId) return res.status(400).json({ error: 'guildIdが必要です' })
    try {
        getRankSettings(guildId) // ensure exists
        updateRankSettings(guildId, req.body)
        res.json({ success: true })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// 減衰免除
app.get('/api/ranks/exempt', (req, res) => {
    const { guildId } = req.query
    if (!guildId) return res.status(400).json({ error: 'guildIdが必要です' })
    try {
        res.json(getDecayExemptMembers(guildId))
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

app.post('/api/ranks/exempt', (req, res) => {
    const { guildId, userId, exempt, exemptUntil } = req.body
    if (!guildId || !userId) return res.status(400).json({ error: 'guildIdとuserIdが必要です' })
    try {
        setDecayExempt(guildId, userId, exempt, exemptUntil || null)
        res.json({ success: true })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// RPルール
app.get('/api/ranks/rp-rules', (req, res) => {
    const { guildId } = req.query
    if (!guildId) return res.status(400).json({ error: 'guildIdが必要です' })
    try {
        res.json(getRpRules(guildId))
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

app.put('/api/ranks/rp-rules', (req, res) => {
    const { guildId } = req.query
    if (!guildId) return res.status(400).json({ error: 'guildIdが必要です' })
    try {
        updateRpRules(guildId, req.body.rules || [])
        res.json({ success: true })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// メンバーランク情報
app.get('/api/ranks/member/:userId', (req, res) => {
    const { guildId } = req.query
    if (!guildId) return res.status(400).json({ error: 'guildIdが必要です' })
    try {
        const info = getMemberRank(guildId, req.params.userId)
        const config = getRankConfig(guildId)
        const currentIdx = config.findIndex(r => r.rank_key === info.current_rank_key)
        const nextRank = currentIdx < config.length - 1 ? config[currentIdx + 1] : null
        res.json({ ...info, next_rank: nextRank })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

app.get('/api/ranks/leaderboard', (req, res) => {
    const { guildId, limit } = req.query
    if (!guildId) return res.json([])
    try {
        const lb = getRpLeaderboard(guildId, parseInt(limit) || 50)
        const config = getRankConfig(guildId)
        const enriched = lb.map(m => {
            const rankInfo = config.find(r => r.rank_key === m.current_rank_key) || config[0]
            return { ...m, rank_label: rankInfo.rank_label, color: rankInfo.color, icon: rankInfo.icon, cp_multiplier: rankInfo.cp_multiplier }
        })
        res.json(enriched)
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

app.get('/api/ranks/rp-history/:userId', (req, res) => {
    const { guildId, limit } = req.query
    if (!guildId) return res.json([])
    try {
        res.json(getRpHistory(guildId, req.params.userId, parseInt(limit) || 20))
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// シーズン設定
app.get('/api/ranks/season', (req, res) => {
    const { guildId } = req.query
    if (!guildId) return res.status(400).json({ error: 'guildIdが必要です' })
    try {
        res.json(getSeasonConfig(guildId))
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

app.put('/api/ranks/season', (req, res) => {
    const { guildId } = req.query
    if (!guildId) return res.status(400).json({ error: 'guildIdが必要です' })
    try {
        getSeasonConfig(guildId) // ensure exists
        updateSeasonConfig(guildId, req.body)
        res.json({ success: true })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

app.get('/api/ranks/season/next', (req, res) => {
    const { guildId } = req.query
    if (!guildId) return res.status(400).json({ error: 'guildIdが必要です' })
    try {
        res.json({ nextEnd: getNextSeasonEnd(guildId) })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

app.get('/api/ranks/season/history', (req, res) => {
    const { guildId } = req.query
    if (!guildId) return res.json([])
    try {
        res.json(getSeasonHistory(guildId))
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

app.post('/api/ranks/season/execute', (req, res) => {
    const { guildId } = req.query
    if (!guildId) return res.status(400).json({ error: 'guildIdが必要です' })
    try {
        const result = checkAndExecuteSeason(guildId)
        res.json({ success: true, result })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// 管理者操作
app.post('/api/ranks/adjust', (req, res) => {
    const { guildId, userId, amount, source, description } = req.body
    if (!guildId || !userId || amount === undefined) {
        return res.status(400).json({ error: 'guildId, userId, amountが必要です' })
    }
    try {
        const result = addRp(guildId, userId, amount, source || 'admin', description || '管理者による調整')
        res.json(result)
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

app.post('/api/ranks/recalculate', (req, res) => {
    const { guildId } = req.query
    if (!guildId) return res.status(400).json({ error: 'guildIdが必要です' })
    try {
        const count = recalculateAllRanks(guildId)
        res.json({ success: true, count })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// ============================
// Cron Jobs
// ============================
// 毎日AM4:00 JST (= UTC 19:00) に減衰処理 + シーズンチェック
cron.schedule('0 19 * * *', () => {
    try {
        // 冪等性チェック: 今日既に実行済みならスキップ
        if (!acquireCronLock('daily_maintenance')) {
            console.log('🔄 Daily maintenance already executed today, skipping')
            return
        }

        const guilds = getGuilds()
        for (const guild of guilds) {
            applyDecay(guild.id)
            checkAndExecuteSeason(guild.id)
        }
        cleanupOldRpTransactions(120)
        cleanupCronLocks()
        console.log('🔄 Daily rank maintenance completed')
    } catch (err) {
        console.error('Cron error:', err.message)
    }
})

// ============================
// Catch-all for SPA
// ============================
if (process.env.NODE_ENV === 'production') {
    app.get('*', (req, res) => {
        res.sendFile(join(__dirname, '..', 'dist', 'index.html'))
    })
}

// ============================
// Start server + auto-reconnect
// ============================
app.listen(PORT, async () => {
    console.log(`🚀 BotForge server running on http://localhost:${PORT}`)
    const result = await autoReconnect()
    if (result) {
        setupHandlers(() => getAllCommands(), db)
    }
})
