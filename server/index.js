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
    getLevelTitle, calculateLevel, pointsForNextLevel,
    getGachaSettings, updateGachaSettings
} from './db.js'

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
        // Add level titles to leaderboard data
        const enriched = leaderboard.map(m => ({
            ...m,
            ...getLevelTitle(m.level),
            nextLevelPoints: pointsForNextLevel(m.level)
        }))
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
        const titleInfo = getLevelTitle(member.level)
        res.json({ ...member, rank, ...titleInfo })
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
// Level Info API
// ============================
app.get('/api/levels/info', (req, res) => {
    const levels = [1, 2, 3, 5, 8, 10, 15, 20, 25, 35, 45, 60, 80, 100]
    const info = levels.map(lv => ({
        level: lv,
        ...getLevelTitle(lv),
        totalPointsNeeded: pointsForNextLevel(lv - 1)
    }))
    res.json(info)
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
