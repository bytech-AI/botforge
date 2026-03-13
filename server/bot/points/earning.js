/**
 * ポイント付与の共通ロジック
 * メンバーの存在確認→RP付与（日次上限チェック付き）→CP倍率適用→ポイント付与をまとめて行うヘルパー
 */

/**
 * メンバーを登録（未登録なら作成）してRP付与 + CP倍率適用してポイントを付与する
 * @param {object} dbHelpers - db.jsのエクスポート
 * @param {string} guildId - サーバーID
 * @param {string} userId - ユーザーID
 * @param {string} username - ユーザー名
 * @param {string} displayName - 表示名
 * @param {string} avatar - アバターURL
 * @param {number} points - 基本付与ポイント（CP）
 * @param {string} description - 説明文
 * @param {string|null} action - アクション名（message, reaction_receive 等）。RPルールと照合に使用
 */
export function earnPoints(dbHelpers, guildId, userId, username, displayName, avatar, points, description, action = null) {
    dbHelpers.getOrCreateMember(guildId, userId, username, displayName, avatar)

    // RP付与（actionが指定されている場合）
    if (action) {
        try {
            const rpRules = dbHelpers.getRpRules(guildId)
            const rpRule = rpRules.find(r => r.action === action && r.enabled)
            if (rpRule) {
                let rpToAdd = rpRule.rp_amount
                // 日次上限チェック（daily_cap > 0 の場合）
                const dailyCap = rpRule.daily_cap || 0
                if (dailyCap > 0) {
                    const todayTotal = dbHelpers.getDailyRpTotal(guildId, userId, action)
                    const remaining = Math.max(0, dailyCap - todayTotal)
                    rpToAdd = Math.min(rpToAdd, remaining)
                }
                if (rpToAdd > 0) {
                    dbHelpers.addRp(guildId, userId, rpToAdd, action, description)
                }
            }
        } catch (err) {
            console.error('RP earn error:', err.message)
        }
    }

    // ランクのCP倍率を取得して適用
    let multiplier = 1.0
    try {
        multiplier = dbHelpers.getCpMultiplier(guildId, userId)
    } catch { }

    const adjustedPoints = points * multiplier
    dbHelpers.addPoints(guildId, userId, adjustedPoints, 'earn', description)
}
