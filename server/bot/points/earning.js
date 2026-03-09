/**
 * ポイント付与の共通ロジック
 * メンバーの存在確認→ポイント付与をまとめて行うヘルパー
 */

/**
 * メンバーを登録（未登録なら作成）してポイントを付与する
 * @param {object} dbHelpers - db.jsのエクスポート
 * @param {string} guildId - サーバーID
 * @param {string} userId - ユーザーID
 * @param {string} username - ユーザー名
 * @param {string} displayName - 表示名
 * @param {string} avatar - アバターURL
 * @param {number} points - 付与ポイント
 * @param {string} description - 説明文
 */
export function earnPoints(dbHelpers, guildId, userId, username, displayName, avatar, points, description) {
    dbHelpers.getOrCreateMember(guildId, userId, username, displayName, avatar)
    dbHelpers.addPoints(guildId, userId, points, 'earn', description)
}
