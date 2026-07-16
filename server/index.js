import express from 'express'
import cors from 'cors'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync, copyFileSync, unlinkSync, statSync, openSync, readSync, closeSync } from 'fs'
import multer from 'multer'
import {
    connectBot, disconnectBot, getBotStatus, clearToken,
    autoReconnect, getGuilds, getGuildMembers, getClient,
    registerSlashCommands, fetchRegisteredCommands, deleteRegisteredCommand, getBuiltinCommands, setupHandlers
} from './bot.js'
import { requireGuildId, requireIntParam, requireBody, maxLength, numberRange } from './middleware/validate.js'
import { asyncHandler, notFoundHandler, globalErrorHandler } from './middleware/errorHandler.js'
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
    getXRankConfig, updateXRankConfig,
    getRankSettings, updateRankSettings,
    getRpRules, updateRpRules, createRpRule, deleteRpRule,
    getMemberRank, addRp, getCpMultiplier, getDailyRpTotal,
    getRpLeaderboard, getRpHistory,
    getSeasonConfig, updateSeasonConfig, getNextSeasonEnd, getSeasonHistory,
    checkAndExecuteSeason, recalculateAllRanks,
    setDecayExempt, getDecayExemptMembers,
    applyDecay, cleanupOldRpTransactions,
    acquireCronLock, cleanupCronLocks,
    resetAllPoints, resetUserPoints, purchaseReward,
    resetAllRanks, resetUserRank,
    // AI採点システム
    getAiScoringSettings, updateAiScoringSettings,
    getScoringHistory, getScoringStats,
} from './db.js'
import { encryptSecret, setVoiceDebugMode, getVoiceDebugMode, getVoiceDebugLog, clearVoiceDebugLog } from './bot.js'
import cron from 'node-cron'
import { getAppTimeZone, getDateKey } from './utils/time.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3001
const BUILTIN_COMMAND_NAMES = new Set(getBuiltinCommands().map(command => command.name))

app.use(cors())
app.use(express.json({ limit: '1mb' }))

// 破壊的操作の認可チェック: Bot接続済みであることを要求
function requireBotConnected(req, res, next) {
    const status = getBotStatus()
    if (status.status !== 'online') {
        return res.status(403).json({ error: 'この操作にはBotが接続されている必要があります' })
    }
    next()
}

// Initialize database
const db = initDatabase()

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(join(__dirname, '..', 'dist')))
}

// ============================
// Bot Connection API
// ============================
app.post('/api/bot/connect', requireBody('token'), asyncHandler(async (req, res) => {
    const result = await connectBot(req.body.token)
    setupHandlers(() => getAllCommands(), db)
    res.json(result)
}))

app.post('/api/bot/disconnect', asyncHandler(async (req, res) => {
    await disconnectBot()
    clearToken()
    res.json({ success: true })
}))

app.get('/api/bot/status', (req, res) => {
    res.json(getBotStatus())
})

// ============================
// Guild (Server) API
// ============================
app.get('/api/guilds', (req, res) => {
    res.json(getGuilds())
})

app.get('/api/guilds/:guildId/members', asyncHandler(async (req, res) => {
    const members = await getGuildMembers(req.params.guildId)
    res.json(members)
}))

// ============================
// Commands API (DB-backed)
// ============================
app.get('/api/commands', (req, res, next) => {
    try {
        res.json(getAllCommands())
    } catch (err) { next(err) }
})

app.post('/api/commands', (req, res, next) => {
    try {
        if (BUILTIN_COMMAND_NAMES.has(req.body.name)) {
            return res.status(400).json({ error: `/${req.body.name} はビルトインコマンド名のため使用できません` })
        }
        const cmd = createCommand(req.body)
        res.json(cmd)
    } catch (err) { next(err) }
})

app.put('/api/commands/:id', requireIntParam(), (req, res, next) => {
    try {
        if (BUILTIN_COMMAND_NAMES.has(req.body.name)) {
            return res.status(400).json({ error: `/${req.body.name} はビルトインコマンド名のため使用できません` })
        }
        updateCommand(parseInt(req.params.id), req.body)
        res.json({ success: true })
    } catch (err) { next(err) }
})

app.delete('/api/commands/:id', requireIntParam(), (req, res, next) => {
    try {
        deleteCommand(parseInt(req.params.id))
        res.json({ success: true })
    } catch (err) { next(err) }
})

// Sync commands to Discord
app.post('/api/commands/sync', asyncHandler(async (req, res) => {
    const commands = getAllCommands()
    const result = await registerSlashCommands(commands, req.body.guildId)
    res.json(result)
}))

// Fetch registered commands from Discord
app.get('/api/commands/registered', asyncHandler(async (req, res) => {
    const registered = await fetchRegisteredCommands(req.query.guildId)
    res.json(registered)
}))

// Delete a registered Discord command
app.delete('/api/commands/registered/:commandId', asyncHandler(async (req, res) => {
    const result = await deleteRegisteredCommand(req.params.commandId, req.query.guildId)
    res.json(result)
}))

// ============================
// Points Rules API (DB-backed)
// ============================
app.get('/api/points/rules', (req, res, next) => {
    try {
        res.json(getAllPointRules())
    } catch (err) { next(err) }
})

app.put('/api/points/rules', (req, res, next) => {
    try {
        updatePointRules(req.body)
        res.json({ success: true })
    } catch (err) { next(err) }
})

// ============================
// Points Leaderboard API
// ============================
app.get('/api/points/leaderboard', (req, res, next) => {
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
    } catch (err) { next(err) }
})

// ============================
// Points Stats API
// ============================
app.get('/api/points/stats', (req, res, next) => {
    const { guildId } = req.query
    if (!guildId) return res.json({ totalPointsIssued: 0, averagePoints: 0, maxStreak: 0, rewardsClaimed: 0 })
    try {
        const stats = getPointStats(guildId)
        res.json(stats)
    } catch (err) { next(err) }
})

// ============================
// Points Member API
// ============================
app.get('/api/points/members/:userId', requireGuildId, (req, res, next) => {
    try {
        const { guildId } = req.query
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
    } catch (err) { next(err) }
})

// Admin adjust points
app.post('/api/points/adjust', requireBody('guildId', 'userId'), (req, res, next) => {
    try {
        const { guildId, userId, amount, reason } = req.body
        const result = addPoints(guildId, userId, amount, 'admin_adjust', reason || '管理者による調整')
        res.json(result)
    } catch (err) { next(err) }
})

// ============================
// Points Transaction History API
// ============================
app.get('/api/points/transactions', (req, res, next) => {
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
    } catch (err) { next(err) }
})

// ============================
// Points Actions List API
// ============================
app.get('/api/points/actions', (req, res, next) => {
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
    } catch (err) { next(err) }
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
app.get('/api/points/economy', (req, res, next) => {
    const { guildId } = req.query
    if (!guildId) return res.json({
        transfer_fee_percent: 5, min_transfer_amount: 10,
        daily_transfer_limit: 10000, daily_bonus_amount: 50,
        daily_bonus_streak_multiplier: 1.1, max_daily_bonus: 200, enabled: 1
    })
    try {
        const settings = getEconomySettings(guildId)
        res.json(settings)
    } catch (err) { next(err) }
})

app.put('/api/points/economy', requireGuildId, (req, res, next) => {
    try {
        const settings = updateEconomySettings(req.query.guildId, req.body)
        res.json(settings)
    } catch (err) { next(err) }
})

// ============================
// Rewards API (DB-backed)
// ============================
app.get('/api/rewards', (req, res, next) => {
    try {
        res.json(getAllRewards())
    } catch (err) { next(err) }
})

app.post('/api/rewards', (req, res, next) => {
    try {
        const reward = createReward(req.body)
        res.json(reward)
    } catch (err) { next(err) }
})

app.put('/api/rewards/:id', requireIntParam(), (req, res, next) => {
    try {
        updateReward(parseInt(req.params.id), req.body)
        res.json({ success: true })
    } catch (err) { next(err) }
})

app.delete('/api/rewards/:id', requireIntParam(), (req, res, next) => {
    try {
        deleteReward(parseInt(req.params.id))
        res.json({ success: true })
    } catch (err) { next(err) }
})

// ============================
// Gacha Settings API
// ============================
app.get('/api/gacha/settings', (req, res, next) => {
    try {
        res.json(getGachaSettings())
    } catch (err) { next(err) }
})

app.put('/api/gacha/settings/:id', requireIntParam(), (req, res, next) => {
    try {
        updateGachaSettings(parseInt(req.params.id), req.body)
        res.json({ success: true })
    } catch (err) { next(err) }
})

// ============================
// Auto Response API
// ============================
app.get('/api/auto-responses', (req, res, next) => {
    try {
        res.json(getAllAutoResponses(req.query.guildId))
    } catch (err) { next(err) }
})

app.post('/api/auto-responses', (req, res, next) => {
    try {
        const ar = createAutoResponse(req.body)
        res.json(ar)
    } catch (err) { next(err) }
})

app.put('/api/auto-responses/:id', requireIntParam(), (req, res, next) => {
    try {
        updateAutoResponse(parseInt(req.params.id), req.body)
        res.json({ success: true })
    } catch (err) { next(err) }
})

app.delete('/api/auto-responses/:id', requireIntParam(), (req, res, next) => {
    try {
        deleteAutoResponse(parseInt(req.params.id))
        res.json({ success: true })
    } catch (err) { next(err) }
})

// ============================
// Moderation Settings API
// ============================
app.get('/api/moderation/settings', requireGuildId, (req, res, next) => {
    try {
        res.json(getModerationSettings(req.query.guildId))
    } catch (err) { next(err) }
})

app.put('/api/moderation/settings', requireGuildId, (req, res, next) => {
    try {
        const { guildId } = req.query
        getModerationSettings(guildId) // ensure exists
        updateModerationSettings(guildId, req.body)
        res.json({ success: true })
    } catch (err) { next(err) }
})

// ============================
// Scheduled Messages API
// ============================
app.get('/api/scheduled-messages', (req, res, next) => {
    const { guildId } = req.query
    if (!guildId) return res.json([])
    try {
        res.json(getAllScheduledMessages(guildId))
    } catch (err) { next(err) }
})

app.post('/api/scheduled-messages', (req, res, next) => {
    try {
        const msg = createScheduledMessage(req.body)
        res.json(msg)
    } catch (err) { next(err) }
})

app.put('/api/scheduled-messages/:id', requireIntParam(), (req, res, next) => {
    try {
        updateScheduledMessage(parseInt(req.params.id), req.body)
        res.json({ success: true })
    } catch (err) { next(err) }
})

app.delete('/api/scheduled-messages/:id', requireIntParam(), (req, res, next) => {
    try {
        deleteScheduledMessage(parseInt(req.params.id))
        res.json({ success: true })
    } catch (err) { next(err) }
})

// ============================
// Welcome Settings API
// ============================
app.get('/api/welcome-settings', requireGuildId, (req, res, next) => {
    try {
        res.json(getWelcomeSettings(req.query.guildId))
    } catch (err) { next(err) }
})

app.put('/api/welcome-settings', requireGuildId, (req, res, next) => {
    try {
        const { guildId } = req.query
        getWelcomeSettings(guildId) // ensure exists
        updateWelcomeSettings(guildId, req.body)
        res.json({ success: true })
    } catch (err) { next(err) }
})

// ============================
// Embed Templates API
// ============================
app.get('/api/embed-templates', (req, res, next) => {
    const { guildId } = req.query
    if (!guildId) return res.json([])
    try {
        res.json(getAllEmbedTemplates(guildId))
    } catch (err) { next(err) }
})

app.post('/api/embed-templates', (req, res, next) => {
    try {
        const template = createEmbedTemplate(req.body)
        res.json(template)
    } catch (err) { next(err) }
})

app.put('/api/embed-templates/:id', requireIntParam(), (req, res, next) => {
    try {
        updateEmbedTemplate(parseInt(req.params.id), req.body)
        res.json({ success: true })
    } catch (err) { next(err) }
})

app.delete('/api/embed-templates/:id', requireIntParam(), (req, res, next) => {
    try {
        deleteEmbedTemplate(parseInt(req.params.id))
        res.json({ success: true })
    } catch (err) { next(err) }
})

// ============================
// Channel Multipliers API
// ============================
app.get('/api/points/channel-multipliers', (req, res, next) => {
    const { guildId } = req.query
    if (!guildId) return res.json([])
    try {
        res.json(getChannelMultipliers(guildId))
    } catch (err) { next(err) }
})

app.put('/api/points/channel-multipliers', requireGuildId, (req, res, next) => {
    try {
        updateChannelMultipliers(req.query.guildId, req.body.multipliers || [])
        res.json({ success: true })
    } catch (err) { next(err) }
})

// ============================
// Point Decay Settings API
// ============================
app.get('/api/points/decay-settings', requireGuildId, (req, res, next) => {
    try {
        res.json(getPointDecaySettings(req.query.guildId))
    } catch (err) { next(err) }
})

app.put('/api/points/decay-settings', requireGuildId, (req, res, next) => {
    try {
        const { guildId } = req.query
        getPointDecaySettings(guildId) // ensure exists
        updatePointDecaySettings(guildId, req.body)
        res.json({ success: true })
    } catch (err) { next(err) }
})

// ============================
// Rank System API
// ============================

// ランク設定
app.get('/api/ranks/config', requireGuildId, (req, res, next) => {
    try {
        res.json(getRankConfig(req.query.guildId))
    } catch (err) { next(err) }
})

app.put('/api/ranks/config', requireGuildId, (req, res, next) => {
    try {
        updateRankConfig(req.query.guildId, req.body.ranks || [])
        res.json({ success: true })
    } catch (err) { next(err) }
})

app.post('/api/ranks/config/tier', requireGuildId, (req, res, next) => {
    try {
        addRankTier(req.query.guildId, req.body)
        res.json({ success: true })
    } catch (err) { next(err) }
})

app.delete('/api/ranks/config/tier/:rankKey', requireGuildId, (req, res, next) => {
    try {
        removeRankTier(req.query.guildId, req.params.rankKey)
        res.json({ success: true })
    } catch (err) { next(err) }
})

// Xランク専用設定
app.get('/api/ranks/x-config', requireGuildId, (req, res, next) => {
    try {
        res.json(getXRankConfig(req.query.guildId))
    } catch (err) { next(err) }
})

app.put('/api/ranks/x-config', requireGuildId, (req, res, next) => {
    try {
        updateXRankConfig(req.query.guildId, req.body)
        res.json({ success: true })
    } catch (err) { next(err) }
})

// 減衰設定
app.get('/api/ranks/settings', requireGuildId, (req, res, next) => {
    try {
        res.json(getRankSettings(req.query.guildId))
    } catch (err) { next(err) }
})

app.put('/api/ranks/settings', requireGuildId, (req, res, next) => {
    try {
        const { guildId } = req.query
        getRankSettings(guildId) // ensure exists
        updateRankSettings(guildId, req.body)
        res.json({ success: true })
    } catch (err) { next(err) }
})

// 減衰免除
app.get('/api/ranks/exempt', requireGuildId, (req, res, next) => {
    try {
        res.json(getDecayExemptMembers(req.query.guildId))
    } catch (err) { next(err) }
})

app.post('/api/ranks/exempt', requireBody('guildId', 'userId'), (req, res, next) => {
    try {
        const { guildId, userId, exempt, exemptUntil } = req.body
        setDecayExempt(guildId, userId, exempt, exemptUntil || null)
        res.json({ success: true })
    } catch (err) { next(err) }
})

// RPルール
app.get('/api/ranks/rp-rules', requireGuildId, (req, res, next) => {
    try {
        res.json(getRpRules(req.query.guildId))
    } catch (err) { next(err) }
})

app.put('/api/ranks/rp-rules', requireGuildId, (req, res, next) => {
    try {
        updateRpRules(req.query.guildId, req.body.rules || [])
        res.json({ success: true })
    } catch (err) { next(err) }
})

app.post('/api/ranks/rp-rules', requireGuildId, requireBody('action', 'label'), (req, res, next) => {
    try {
        const rule = createRpRule(req.query.guildId, req.body)
        res.json(rule)
    } catch (err) { next(err) }
})

app.delete('/api/ranks/rp-rules/:id', requireGuildId, requireIntParam(), (req, res, next) => {
    try {
        deleteRpRule(req.query.guildId, parseInt(req.params.id))
        res.json({ success: true })
    } catch (err) { next(err) }
})

// メンバーランク情報
app.get('/api/ranks/member/:userId', requireGuildId, (req, res, next) => {
    try {
        const { guildId } = req.query
        const info = getMemberRank(guildId, req.params.userId)
        const config = getRankConfig(guildId)
        const currentIdx = config.findIndex(r => r.rank_key === info.current_rank_key)
        const nextRank = currentIdx < config.length - 1 ? config[currentIdx + 1] : null
        res.json({ ...info, next_rank: nextRank })
    } catch (err) { next(err) }
})

app.get('/api/ranks/leaderboard', (req, res, next) => {
    const { guildId, limit } = req.query
    if (!guildId) return res.json([])
    try {
        const lb = getRpLeaderboard(guildId, parseInt(limit) || 50)
        const config = getRankConfig(guildId)
        const xConfig = getXRankConfig(guildId)
        const enriched = lb.map(m => {
            const rankInfo = config.find(r => r.rank_key === m.current_rank_key) || config[0]
            let cpMul = rankInfo.cp_multiplier
            let xTierLabel = null
            if (m.current_rank_key === 'x' && m.x_rp !== null) {
                for (const tier of (xConfig.tiers || [])) {
                    if (m.x_rp >= tier.min && m.x_rp <= tier.max) {
                        cpMul = tier.cp_multiplier
                        xTierLabel = tier.label
                        break
                    }
                }
            }
            return { ...m, rank_label: rankInfo.rank_label, color: rankInfo.color, icon: rankInfo.icon, cp_multiplier: cpMul, rp_threshold: rankInfo.rp_threshold ?? 0, x_tier_label: xTierLabel }
        })
        res.json(enriched)
    } catch (err) { next(err) }
})

app.get('/api/ranks/rp-history/:userId', (req, res, next) => {
    const { guildId, limit } = req.query
    if (!guildId) return res.json([])
    try {
        res.json(getRpHistory(guildId, req.params.userId, parseInt(limit) || 20))
    } catch (err) { next(err) }
})

// シーズン設定
app.get('/api/ranks/season', requireGuildId, (req, res, next) => {
    try {
        res.json(getSeasonConfig(req.query.guildId))
    } catch (err) { next(err) }
})

app.put('/api/ranks/season', requireGuildId, (req, res, next) => {
    try {
        const { guildId } = req.query
        getSeasonConfig(guildId) // ensure exists
        updateSeasonConfig(guildId, req.body)
        res.json({ success: true })
    } catch (err) { next(err) }
})

app.get('/api/ranks/season/next', requireGuildId, (req, res, next) => {
    try {
        res.json({ nextEnd: getNextSeasonEnd(req.query.guildId) })
    } catch (err) { next(err) }
})

app.get('/api/ranks/season/history', (req, res, next) => {
    const { guildId } = req.query
    if (!guildId) return res.json([])
    try {
        res.json(getSeasonHistory(guildId))
    } catch (err) { next(err) }
})

app.post('/api/ranks/season/execute', requireGuildId, (req, res, next) => {
    try {
        const result = checkAndExecuteSeason(req.query.guildId)
        res.json({ success: true, result })
    } catch (err) { next(err) }
})

// 管理者操作
app.post('/api/ranks/adjust', requireBody('guildId', 'userId'), (req, res, next) => {
    try {
        const { guildId, userId, amount, source, description } = req.body
        const result = addRp(guildId, userId, amount, source || 'admin', description || '管理者による調整')
        res.json(result)
    } catch (err) { next(err) }
})

app.post('/api/ranks/recalculate', requireGuildId, (req, res, next) => {
    try {
        const count = recalculateAllRanks(req.query.guildId)
        res.json({ success: true, count })
    } catch (err) { next(err) }
})

// ポイントリセット（破壊的操作: Bot接続必須）
app.post('/api/points/reset', requireBotConnected, requireGuildId, (req, res, next) => {
    try {
        const { guildId } = req.query
        const { userId } = req.body || {}
        if (userId) {
            resetUserPoints(guildId, userId)
        } else {
            resetAllPoints(guildId)
        }
        res.json({ success: true })
    } catch (err) { next(err) }
})

// ランクリセット（破壊的操作: Bot接続必須）
app.post('/api/ranks/reset', requireBotConnected, requireGuildId, (req, res, next) => {
    try {
        const { guildId } = req.query
        const { userId } = req.body || {}
        if (userId) {
            resetUserRank(guildId, userId)
        } else {
            resetAllRanks(guildId)
        }
        res.json({ success: true })
    } catch (err) { next(err) }
})

// ============================
// AI Scoring API
// ============================
app.get('/api/ai-scoring/settings', requireGuildId, (req, res, next) => {
    try {
        const settings = getAiScoringSettings(req.query.guildId)
        // APIキーは暗号化された状態のまま返す（フロントでは有無のみ判定）
        res.json({ ...settings, apiKeyEncrypted: settings.apiKeyEncrypted ? '***' : '' })
    } catch (err) { next(err) }
})

app.put('/api/ai-scoring/settings', requireGuildId, (req, res, next) => {
    try {
        const { guildId } = req.query
        const current = getAiScoringSettings(guildId)
        const body = req.body

        // APIキーが新しく送られてきた場合は暗号化して保存
        let apiKeyEncrypted = current.apiKeyEncrypted
        if (body.apiKey && body.apiKey.trim()) {
            apiKeyEncrypted = encryptSecret(body.apiKey.trim())
        }

        updateAiScoringSettings(guildId, {
            ...body,
            apiKeyEncrypted,
        })
        res.json({ success: true })
    } catch (err) { next(err) }
})

app.get('/api/ai-scoring/history', requireGuildId, (req, res, next) => {
    try {
        res.json(getScoringHistory(req.query.guildId, parseInt(req.query.limit) || 50))
    } catch (err) { next(err) }
})

app.get('/api/ai-scoring/stats', requireGuildId, (req, res, next) => {
    try {
        res.json(getScoringStats(req.query.guildId))
    } catch (err) { next(err) }
})

// ============================
// Voice Debug API
// ============================

app.get('/api/voice-debug/status', (req, res) => {
    res.json({ enabled: getVoiceDebugMode() })
})

app.post('/api/voice-debug/toggle', (req, res) => {
    const enabled = !!req.body.enabled
    setVoiceDebugMode(enabled)
    res.json({ enabled })
})

app.get('/api/voice-debug/log', (req, res) => {
    res.json(getVoiceDebugLog())
})

app.post('/api/voice-debug/clear', (req, res) => {
    clearVoiceDebugLog()
    res.json({ success: true })
})

// ============================
// Backup / Restore API
// ============================
const dataDir = join(__dirname, '..', 'data')
const dbFilePath = join(dataDir, 'botforge.db')

// ダウンロード: DBファイルをそのまま返す
app.get('/api/backup/download', requireBotConnected, (req, res, next) => {
    try {
        if (!existsSync(dbFilePath)) {
            return res.status(404).json({ error: 'データベースファイルが見つかりません' })
        }
        // WALをメインDBにチェックポイント（データ整合性のため）
        try { getDb().pragma('wal_checkpoint(TRUNCATE)') } catch { }
        const stats = statSync(dbFilePath)
        res.setHeader('Content-Type', 'application/octet-stream')
        res.setHeader('Content-Disposition', `attachment; filename="botforge-backup-${new Date().toISOString().split('T')[0]}.db"`)
        res.setHeader('Content-Length', stats.size)
        res.sendFile(dbFilePath)
    } catch (err) { next(err) }
})

// DB情報: サイズ等の統計
app.get('/api/backup/info', requireBotConnected, (req, res, next) => {
    try {
        if (!existsSync(dbFilePath)) {
            return res.json({ exists: false })
        }
        const stats = statSync(dbFilePath)
        const db = getDb()
        const tableCount = db.prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'").get()
        res.json({
            exists: true,
            sizeBytes: stats.size,
            sizeMB: Math.round(stats.size / 1024 / 1024 * 100) / 100,
            tables: tableCount.count,
            lastModified: stats.mtime.toISOString(),
        })
    } catch (err) { next(err) }
})

// アップロード: DBファイルを差し替え
const upload = multer({ dest: join(dataDir, 'tmp'), limits: { fileSize: 100 * 1024 * 1024 } }) // 100MB上限
app.post('/api/backup/upload', requireBotConnected, upload.single('database'), (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'ファイルが選択されていません' })
        }

        const uploadedPath = req.file.path

        // SQLiteファイルかどうかバリデーション（先頭16バイトのマジックナンバー）
        const fd = openSync(uploadedPath, 'r')
        const header = Buffer.alloc(16)
        readSync(fd, header, 0, 16, 0)
        closeSync(fd)
        const magic = header.toString('ascii', 0, 16)
        if (!magic.startsWith('SQLite format 3')) {
            unlinkSync(uploadedPath)
            return res.status(400).json({ error: '有効なSQLiteファイルではありません' })
        }

        // 現在のDBをバックアップ
        const backupPath = dbFilePath + '.bak'
        if (existsSync(dbFilePath)) {
            try { getDb().pragma('wal_checkpoint(TRUNCATE)') } catch { }
            copyFileSync(dbFilePath, backupPath)
        }

        // WAL/SHMファイルを削除（新DBとの不整合防止）
        try { if (existsSync(dbFilePath + '-wal')) unlinkSync(dbFilePath + '-wal') } catch { }
        try { if (existsSync(dbFilePath + '-shm')) unlinkSync(dbFilePath + '-shm') } catch { }

        // アップロードされたファイルを配置
        copyFileSync(uploadedPath, dbFilePath)
        unlinkSync(uploadedPath)

        res.json({ success: true, message: 'データベースをリストアしました。サーバーを再起動してください。' })
    } catch (err) {
        // アップロードファイルの後始末
        if (req.file?.path) try { unlinkSync(req.file.path) } catch { }
        next(err)
    }
})

// ============================
// Cron Jobs
// ============================
// アプリのタイムゾーンで毎日 AM4:00 に減衰処理 + シーズンチェック
cron.schedule('0 4 * * *', () => {
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
}, { timezone: getAppTimeZone() })

// 毎分: 定時メッセージチェック
cron.schedule('* * * * *', () => {
    try {
        const client = getClient ? getClient() : null
        if (!client || client.ws.status !== 0) return // Bot not connected

        const guilds = getGuilds()
        const now = new Date()

        for (const guild of guilds) {
            try {
                const messages = getAllScheduledMessages(guild.id)
                for (const msg of messages) {
                    if (!msg.enabled || !msg.channelId) continue

                    // 時刻チェック（HH:MM形式）
                    const tz = msg.timezone || 'Asia/Tokyo'
                    let nowInTz
                    try {
                        nowInTz = new Date(now.toLocaleString('en-US', { timeZone: tz }))
                    } catch {
                        nowInTz = now
                    }
                    const currentTime = `${String(nowInTz.getHours()).padStart(2, '0')}:${String(nowInTz.getMinutes()).padStart(2, '0')}`
                    if (currentTime !== msg.time) continue

                    // 曜日チェック（0=月, 6=日 → JSの getDay は 0=日, 1=月...）
                    const days = JSON.parse(msg.days || '[0,1,2,3,4,5,6]')
                    const jsDay = nowInTz.getDay() // 0=Sun, 1=Mon, ...
                    const mappedDay = jsDay === 0 ? 6 : jsDay - 1 // Convert to 0=Mon, 6=Sun
                    if (!days.includes(mappedDay)) continue

                    // 重複実行防止（同日同メッセージを2回送らない）
                    if (msg.lastRun) {
                        const lastDate = getDateKey(new Date(msg.lastRun), tz)
                        const todayDate = getDateKey(now, tz)
                        if (lastDate === todayDate) continue
                    }

                    // 送信
                    const guildObj = client.guilds.cache.get(guild.id)
                    if (!guildObj) continue
                    const channel = guildObj.channels.cache.get(msg.channelId)
                    if (!channel) continue

                    channel.send(msg.message).then(() => {
                        // last_run 更新
                        updateScheduledMessage(msg.id, { ...msg, last_run: now.toISOString() })
                    }).catch(err => {
                        console.error(`Scheduled message error (${msg.name}):`, err.message)
                    })
                }
            } catch (err) {
                console.error(`Scheduled message guild error:`, err.message)
            }
        }
    } catch (err) {
        console.error('Scheduled message cron error:', err.message)
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
// Error Handling
// ============================
app.use(notFoundHandler)
app.use(globalErrorHandler)

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
