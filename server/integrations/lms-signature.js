/**
 * 学習サイト（LMS）とのやり取りの署名
 *
 * LMS と BotForge は同じ合言葉（LMS_SHARED_SECRET。LMS 側は BOTFORGE_SHARED_SECRET）を持ち、
 * 「時刻.メソッド.パス.本文」を HMAC-SHA256 で署名して x-lms-timestamp / x-lms-signature に入れて送る。
 * 時刻が5分以上ずれた署名は受け付けない（盗み見た通信の使い回しを防ぐ）。
 * LMS 側の lib/botforge.ts と同じ形式にしている。
 */
import { createHmac, timingSafeEqual } from 'crypto'

export const TIMESTAMP_HEADER = 'x-lms-timestamp'
export const SIGNATURE_HEADER = 'x-lms-signature'
const MAX_SKEW_SECONDS = 300

/** 署名する文字列を作る */
function signingPayload(timestamp, method, path, body) {
    return `${timestamp}.${method.toUpperCase()}.${path}.${body}`
}

/**
 * 署名を作る
 * @returns {{ timestamp: string, signature: string }}
 */
export function signLmsRequest(secret, method, path, body = '', now = Date.now()) {
    const timestamp = String(Math.floor(now / 1000))
    const signature = createHmac('sha256', secret).update(signingPayload(timestamp, method, path, body)).digest('hex')
    return { timestamp, signature }
}

/**
 * 署名を確かめる
 * @returns {boolean} 合言葉が一致し、時刻のずれが5分以内なら true
 */
export function verifyLmsSignature(secret, { timestamp, signature, method, path, body = '' }, now = Date.now()) {
    if (!secret || !timestamp || !signature) return false
    const seconds = Number(timestamp)
    if (!Number.isFinite(seconds) || Math.abs(now / 1000 - seconds) > MAX_SKEW_SECONDS) return false
    const expected = createHmac('sha256', secret).update(signingPayload(timestamp, method, path, body)).digest()
    let received
    try {
        received = Buffer.from(signature, 'hex')
    } catch {
        return false
    }
    return received.length === expected.length && timingSafeEqual(received, expected)
}

/**
 * Express の受け口で署名を確かめるミドルウェア
 * 本文は express.json の verify で req.rawBody に残しておくこと（server/index.js）
 */
export function requireLmsSignature(req, res, next) {
    const secret = process.env.LMS_SHARED_SECRET
    if (!secret) return res.status(503).json({ error: 'LMS との連携が設定されていません（LMS_SHARED_SECRET）' })
    const ok = verifyLmsSignature(secret, {
        timestamp: req.get(TIMESTAMP_HEADER),
        signature: req.get(SIGNATURE_HEADER),
        method: req.method,
        path: req.originalUrl,
        body: req.rawBody ? req.rawBody.toString('utf8') : '',
    })
    if (!ok) return res.status(401).json({ error: '署名が正しくありません' })
    next()
}
