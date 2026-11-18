import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

// テスト用の空の DB を使う（connection.js は読み込んだときに BOTFORGE_DB_PATH を見る）
const dir = mkdtempSync(join(tmpdir(), 'botforge-lms-'))
process.env.BOTFORGE_DB_PATH = join(dir, 'test.db')

const { initDatabase } = await import('../server/db/connection.js')
const dbModule = await import('../server/db.js')
const { applyLmsEvent, computeRoleChanges, getLmsMemberSummary } = await import('../server/integrations/lms.js')
const { signLmsRequest, verifyLmsSignature } = await import('../server/integrations/lms-signature.js')
const { buildStudyEmbed, progressBar } = await import('../server/bot/commands/study.js')

initDatabase()
test.after(() => rmSync(dir, { recursive: true, force: true }))

const GUILD = 'guild-lms'
const USER = '123456789012345678'

test('署名: 同じ合言葉・同じ中身なら通り、本文・パス・時刻が違えば通らない', () => {
    const now = Date.UTC(2026, 10, 18, 7, 0, 0)
    const body = JSON.stringify({ events: [] })
    const { timestamp, signature } = signLmsRequest('secret', 'POST', '/api/integrations/lms/events', body, now)
    const base = { timestamp, signature, method: 'POST', path: '/api/integrations/lms/events', body }

    assert.equal(verifyLmsSignature('secret', base, now), true)
    assert.equal(verifyLmsSignature('other', base, now), false)
    assert.equal(verifyLmsSignature('secret', { ...base, body: '{"events":[1]}' }, now), false)
    assert.equal(verifyLmsSignature('secret', { ...base, path: '/api/integrations/lms/roles' }, now), false)
    assert.equal(verifyLmsSignature('secret', base, now + 301_000), false)
    assert.equal(verifyLmsSignature('secret', { ...base, signature: 'zz' }, now), false)
    assert.equal(verifyLmsSignature('', base, now), false)
})

test('学習の出来事: RP と CP が付き、同じ eventId は2回付かない', () => {
    const event = { eventId: 'evt-1', type: 'lesson_complete', discordUserId: USER, title: 'はじめての Claude' }
    const first = applyLmsEvent(dbModule, GUILD, event)
    assert.equal(first.ok, true)
    assert.equal(first.duplicate, false)
    assert.equal(first.rpAdded, 20)
    // 一番下のランク（C-）の CP 倍率 ×0.3 がかかる
    assert.ok(Math.abs(first.cpAdded - 1.5) < 1e-9)

    const again = applyLmsEvent(dbModule, GUILD, event)
    assert.equal(again.duplicate, true)
    assert.equal(dbModule.getMemberRank(GUILD, USER).current_rp, 20)
})

test('学習の出来事: 管理画面でルールを止めると付かない', () => {
    dbModule.updateRpRules(GUILD, [{ action: 'lms_course_complete', rp_amount: 300, enabled: false }])
    const result = applyLmsEvent(dbModule, GUILD, { eventId: 'evt-2', type: 'course_complete', discordUserId: USER })
    assert.equal(result.rpAdded, 0)
})

test('学習の出来事: 知らない種類・足りない値は断る', () => {
    assert.equal(applyLmsEvent(dbModule, GUILD, { eventId: 'x', type: 'unknown', discordUserId: USER }).ok, false)
    assert.equal(applyLmsEvent(dbModule, GUILD, { eventId: 'x', type: 'lesson_complete', discordUserId: 'abc' }).ok, false)
})

test('LMS のルールを足しても、ふつうの RP ルールは入ったまま', () => {
    const actions = dbModule.getRpRules('guild-fresh').map(r => r.action)
    applyLmsEvent(dbModule, 'guild-fresh', { eventId: 'evt-3', type: 'lesson_complete', discordUserId: USER })
    const after = dbModule.getRpRules('guild-fresh').map(r => r.action)
    assert.ok(actions.includes('message'))
    assert.ok(after.includes('message'))
    assert.ok(after.includes('lms_lesson_complete'))
})

test('ランクの問い合わせ: まだ記録が無い人は行を作らずに一番下のランクを返す', () => {
    const summary = getLmsMemberSummary(dbModule, GUILD, '999999999999999999')
    assert.equal(summary.exists, false)
    assert.equal(summary.rankLabel, 'C-')
    assert.equal(getLmsMemberSummary(dbModule, GUILD, USER).currentRp, 20)
})

test('ロール: プランのロールを付け、ほかのプランのロールを外し、管理していないロールには触らない', () => {
    const config = { planRoles: { MENTORING: 'r-mentor', SELF_STUDY: 'r-self' }, linkedRoleId: 'r-linked' }
    assert.deepEqual(computeRoleChanges(['r-self', 'r-other'], 'MENTORING', config), { add: ['r-mentor', 'r-linked'], remove: ['r-self'] })
    assert.deepEqual(computeRoleChanges(['r-mentor', 'r-linked'], 'MENTORING', config), { add: [], remove: [] })
    // 対応するロールが無いプランは、連携ロールだけ
    assert.deepEqual(computeRoleChanges([], 'FREE', config), { add: ['r-linked'], remove: [] })
    // 連携を外した人は、管理しているロールを全部外す
    assert.deepEqual(computeRoleChanges(['r-mentor', 'r-linked', 'r-other'], null, config), { add: [], remove: ['r-mentor', 'r-linked'] })
})

test('/study: 進み具合のバーと Embed', () => {
    assert.equal(progressBar(0), '▱▱▱▱▱▱▱▱▱▱')
    assert.equal(progressBar(46), '▰▰▰▰▰▱▱▱▱▱')
    assert.equal(progressBar(120), '▰▰▰▰▰▰▰▰▰▰')
    const embed = buildStudyEmbed({
        linked: true,
        displayName: 'テスト',
        completedLessons: 12,
        lastStudiedAt: '2026-11-18T00:00:00.000Z',
        courses: [{ title: 'Claude Code 入門', progressPercent: 40 }],
        mypageUrl: 'https://lms.bytech.jp/mypage',
    }, null).toJSON()
    assert.equal(embed.title, '📚 テストさんの学習状況')
    assert.match(embed.fields[0].value, /Claude Code 入門/)
    assert.equal(embed.fields[1].value, '12 本')
})
