/**
 * ポイント付与のクールダウン（連続取得防止）を管理するモジュール
 */

// key: `${guildId}:${userId}:${action}`, value: タイムスタンプ
const pointCooldowns = new Map()

/**
 * クールダウンを確認し、取得可能ならタイムスタンプを更新する
 * @param {string} guildId - サーバーID
 * @param {string} userId - ユーザーID
 * @param {string} action - アクション名（message, reaction_give 等）
 * @param {number} cooldownSeconds - クールダウン秒数
 * @returns {boolean} ポイント取得可能ならtrue
 */
export function checkCooldown(guildId, userId, action, cooldownSeconds) {
    if (cooldownSeconds <= 0) return true
    const key = `${guildId}:${userId}:${action}`
    const now = Date.now()
    const last = pointCooldowns.get(key)
    if (last && (now - last) < cooldownSeconds * 1000) return false
    pointCooldowns.set(key, now)
    return true
}
