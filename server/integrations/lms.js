/**
 * 学習サイト（LMS, lms.bytech.jp）との連携
 *
 * - LMS から届いた学習の出来事（レッスン完了・課題OK・コース修了）で RP と CP を付ける
 * - LMS のプランに合わせて、受講生サーバーのロールを付け外しする
 * - /study コマンドのために、LMS へ学習状況を問い合わせる
 *
 * 付ける RP・CP は、ほかのアクションと同じく管理画面の RP ルール・ポイントルールで変えられる（action が lms_ で始まるもの）
 */
import { getDb } from '../db/connection.js'
import { signLmsRequest, TIMESTAMP_HEADER, SIGNATURE_HEADER } from './lms-signature.js'

/** LMS の出来事の種類と、はじめに入れておくルール */
export const LMS_EVENT_RULES = {
    lesson_complete: { action: 'lms_lesson_complete', label: 'レッスン完了（学習サイト）', icon: '📘', rp: 20, cp: 5 },
    submission_approved: { action: 'lms_submission_approved', label: '課題OK（学習サイト）', icon: '✅', rp: 100, cp: 30 },
    course_complete: { action: 'lms_course_complete', label: 'コース修了（学習サイト）', icon: '🎓', rp: 300, cp: 100 },
}

/** 連携先の受講生サーバー */
export function getLmsGuildId() {
    return process.env.LMS_GUILD_ID || ''
}

/**
 * LMS 用の RP ルール・ポイントルールが無ければ足す（管理画面で変えた値は上書きしない）
 * getRpRules を先に呼ぶのは、ルールが空のサーバーにふつうのルールを先に入れてもらうため（後から足すと、ふつうのルールが入らなくなる）
 */
export function ensureLmsRules(dbHelpers, guildId) {
    const db = getDb()
    dbHelpers.getRpRules(guildId)
    const insertRp = db.prepare('INSERT OR IGNORE INTO rp_rules (guild_id, action, label, icon, rp_amount, cooldown, daily_cap, enabled) VALUES (?, ?, ?, ?, ?, 0, 0, 1)')
    const insertPoint = db.prepare('INSERT OR IGNORE INTO point_rules (action, label, icon, points, cooldown, enabled) VALUES (?, ?, ?, ?, 0, 1)')
    for (const rule of Object.values(LMS_EVENT_RULES)) {
        insertRp.run(guildId, rule.action, rule.label, rule.icon, rule.rp)
        insertPoint.run(rule.action, rule.label, rule.icon, rule.cp)
    }
}

/**
 * LMS の出来事を1件反映する。同じ eventId は2回付けない（LMS は届かなかった分を送り直すため）
 *
 * @param {object} dbHelpers - db.js のエクスポート
 * @param {string} guildId
 * @param {{ eventId: string, type: string, discordUserId: string, title?: string }} event
 * @returns {{ ok: true, duplicate: boolean, rpAdded: number, cpAdded: number, rankLabel?: string, rankChanged?: boolean } | { ok: false, error: string }}
 */
export function applyLmsEvent(dbHelpers, guildId, event) {
    const rule = LMS_EVENT_RULES[event?.type]
    if (!rule) return { ok: false, error: `知らない出来事の種類です: ${event?.type}` }
    if (!event.eventId || !/^\d{15,20}$/.test(String(event.discordUserId || ''))) return { ok: false, error: 'eventId と discordUserId が要ります' }

    const db = getDb()
    ensureLmsRules(dbHelpers, guildId)
    const userId = String(event.discordUserId)
    const title = String(event.title || '').slice(0, 100)
    const description = title ? `${rule.label}「${title}」` : rule.label

    const tx = db.transaction(() => {
        const existing = db.prepare('SELECT rp_added, cp_added FROM lms_events WHERE event_id = ?').get(event.eventId)
        if (existing) return { ok: true, duplicate: true, rpAdded: existing.rp_added, cpAdded: existing.cp_added }

        dbHelpers.getOrCreateMember(guildId, userId)

        let rpAdded = 0
        let rankLabel
        let rankChanged = false
        const rpRule = dbHelpers.getRpRules(guildId).find(r => r.action === rule.action && r.enabled)
        if (rpRule && rpRule.rp_amount > 0) {
            const result = dbHelpers.addRp(guildId, userId, rpRule.rp_amount, rule.action, description)
            rpAdded = rpRule.rp_amount
            rankLabel = result.rank_label
            rankChanged = result.rank_changed
        }

        let cpAdded = 0
        const pointRule = dbHelpers.getAllPointRules().find(r => r.action === rule.action && r.enabled)
        if (pointRule && pointRule.points > 0) {
            let multiplier = 1
            try {
                multiplier = dbHelpers.getCpMultiplier(guildId, userId)
            } catch { }
            cpAdded = pointRule.points * multiplier
            dbHelpers.addPoints(guildId, userId, cpAdded, 'earn', description)
        }

        db.prepare('INSERT INTO lms_events (event_id, guild_id, user_id, type, title, rp_added, cp_added) VALUES (?, ?, ?, ?, ?, ?, ?)')
            .run(event.eventId, guildId, userId, event.type, title, rpAdded, cpAdded)
        return { ok: true, duplicate: false, rpAdded, cpAdded, rankLabel, rankChanged }
    })
    return tx()
}

// ============================
// ロール
// ============================

/**
 * LMS のプランとロールの対応（環境変数 LMS_PLAN_ROLE_MAP に JSON で書く）
 * 例: {"MENTORING":"123...","SELF_STUDY":"456...","MEMBER":"789...","BIZ":"..."}
 * LMS_LINKED_ROLE_ID を入れると、連携した人全員にそのロールも付ける
 */
export function getLmsRoleConfig() {
    let planRoles = {}
    try {
        const parsed = JSON.parse(process.env.LMS_PLAN_ROLE_MAP || '{}')
        if (parsed && typeof parsed === 'object') planRoles = parsed
    } catch {
        console.error('LMS_PLAN_ROLE_MAP が JSON として読めません')
    }
    return { planRoles, linkedRoleId: process.env.LMS_LINKED_ROLE_ID || '' }
}

/**
 * 付けるロールと外すロールを決める。BotForge が管理するのは planRoles と linkedRoleId に書いたロールだけで、ほかのロールには触らない
 *
 * @param {string[]} currentRoleIds - 今付いているロール
 * @param {string|null} plan - LMS のプラン。null は連携を外した人（管理しているロールを全部外す）
 */
export function computeRoleChanges(currentRoleIds, plan, { planRoles, linkedRoleId }) {
    const managed = new Set([...Object.values(planRoles), linkedRoleId].filter(Boolean))
    const desired = new Set()
    if (plan) {
        if (planRoles[plan]) desired.add(planRoles[plan])
        if (linkedRoleId) desired.add(linkedRoleId)
    }
    const current = new Set(currentRoleIds)
    return {
        add: [...desired].filter(id => !current.has(id)),
        remove: [...managed].filter(id => current.has(id) && !desired.has(id)),
    }
}

/**
 * LMS から届いたプランに合わせて、受講生サーバーのロールを付け外しする
 *
 * @param {import('discord.js').Client|null} client
 * @param {string} guildId
 * @param {Array<{ discordUserId: string, plan: string|null }>} members
 */
export async function syncLmsRoles(client, guildId, members) {
    if (!client) return { ok: false, error: 'Bot が接続されていません' }
    const guild = client.guilds.cache.get(guildId)
    if (!guild) return { ok: false, error: '受講生サーバーに Bot が入っていません（LMS_GUILD_ID）' }
    const config = getLmsRoleConfig()

    const results = []
    for (const { discordUserId, plan } of members) {
        try {
            const member = await guild.members.fetch(discordUserId).catch(() => null)
            if (!member) {
                results.push({ discordUserId, status: 'not_in_guild' })
                continue
            }
            const { add, remove } = computeRoleChanges([...member.roles.cache.keys()], plan, config)
            if (add.length) await member.roles.add(add, '学習サイトのプランに合わせる')
            if (remove.length) await member.roles.remove(remove, '学習サイトのプランに合わせる')
            results.push({ discordUserId, status: 'ok', added: add, removed: remove })
        } catch (err) {
            results.push({ discordUserId, status: 'error', error: err.message })
        }
    }
    return { ok: true, results }
}

// ============================
// ランクの問い合わせ（LMS のマイページに出す）
// ============================

/** まだ一度もポイントやランクが付いていない人には、行を作らずに一番下のランクを返す */
export function getLmsMemberSummary(dbHelpers, guildId, discordUserId) {
    const db = getDb()
    const points = db.prepare('SELECT total_points, total_earned FROM member_points WHERE guild_id = ? AND user_id = ?').get(guildId, discordUserId)
    const hasRank = db.prepare('SELECT 1 FROM member_ranks WHERE guild_id = ? AND user_id = ?').get(guildId, discordUserId)
    if (!points && !hasRank) {
        const first = dbHelpers.getRankConfig(guildId)[0]
        return { exists: false, rankLabel: first?.rank_label ?? '', rankIcon: first?.icon ?? '', currentRp: 0, nextRankLabel: null, nextRpThreshold: null, points: 0 }
    }
    const rank = dbHelpers.getMemberRank(guildId, discordUserId)
    return {
        exists: true,
        rankLabel: rank.rank_label,
        rankIcon: rank.icon,
        currentRp: rank.current_rp,
        nextRankLabel: rank.next_rank_label,
        nextRpThreshold: rank.next_rp_threshold,
        points: Math.floor(points?.total_points ?? 0),
    }
}

// ============================
// LMS への問い合わせ（/study）
// ============================

export function getLmsBaseUrl() {
    return (process.env.LMS_BASE_URL || '').replace(/\/$/, '')
}

/**
 * LMS に、その Discord アカウントと連携した受講生の学習状況を聞く
 * @returns {Promise<{ ok: true, data: object } | { ok: false, error: string }>}
 */
export async function fetchLmsStudy(discordUserId) {
    const baseUrl = getLmsBaseUrl()
    const secret = process.env.LMS_SHARED_SECRET
    if (!baseUrl || !secret) return { ok: false, error: 'not_configured' }
    const path = `/api/integrations/botforge/members/${discordUserId}`
    const { timestamp, signature } = signLmsRequest(secret, 'GET', path)
    try {
        const res = await fetch(`${baseUrl}${path}`, {
            headers: { [TIMESTAMP_HEADER]: timestamp, [SIGNATURE_HEADER]: signature },
            signal: AbortSignal.timeout(8000),
        })
        if (!res.ok) return { ok: false, error: `http_${res.status}` }
        return { ok: true, data: await res.json() }
    } catch (err) {
        return { ok: false, error: err.name === 'TimeoutError' ? 'timeout' : 'network' }
    }
}
