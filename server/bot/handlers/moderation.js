/**
 * モデレーションエンジン
 * NGワード、スパム検知、リンクフィルター、大文字フィルターを処理する
 */

// ユーザーごとのメッセージタイムスタンプ（スパム検知用）
// Map<guildId:userId, number[]>
const messageTimestamps = new Map()

// ユーザーごとの警告カウント
// Map<guildId:userId, number>
const warningCounts = new Map()

// URL検出用の正規表現
const URL_REGEX = /https?:\/\/[^\s<>]+/gi

/**
 * 警告カウントのキーを生成する
 * @param {string} guildId
 * @param {string} userId
 * @returns {string}
 */
function makeKey(guildId, userId) {
    return `${guildId}:${userId}`
}

/**
 * ユーザーの警告カウントを増加させ、上限に達した場合はアクションを返す
 * @param {string} guildId
 * @param {string} userId
 * @param {number} warningLimit
 * @param {string} warningAction
 * @returns {{ limitReached: boolean, count: number }}
 */
function addWarning(guildId, userId, warningLimit, warningAction) {
    const key = makeKey(guildId, userId)
    const current = (warningCounts.get(key) || 0) + 1
    warningCounts.set(key, current)

    return {
        limitReached: warningLimit > 0 && current >= warningLimit,
        count: current
    }
}

/**
 * スパム検知用のタイムスタンプを記録し、閾値を超えたかチェックする
 * @param {string} guildId
 * @param {string} userId
 * @param {number} threshold - メッセージ数の閾値
 * @param {number} timeWindow - 秒単位の時間ウィンドウ
 * @returns {boolean} スパムと判定された場合true
 */
function checkSpam(guildId, userId, threshold, timeWindow) {
    const key = makeKey(guildId, userId)
    const now = Date.now()
    const windowMs = timeWindow * 1000

    let timestamps = messageTimestamps.get(key) || []
    // 時間ウィンドウ外の古いタイムスタンプを除去
    timestamps = timestamps.filter(t => now - t < windowMs)
    timestamps.push(now)
    messageTimestamps.set(key, timestamps)

    return timestamps.length >= threshold
}

/**
 * NGワードチェック
 * @param {string} content - メッセージ内容
 * @param {string[]} ngWords - NGワードリスト
 * @returns {string|null} マッチしたNGワード、またはnull
 */
function checkNgWords(content, ngWords) {
    const lower = content.toLowerCase()
    for (const word of ngWords) {
        if (word && lower.includes(word.toLowerCase())) {
            return word
        }
    }
    return null
}

/**
 * リンクフィルターチェック
 * @param {string} content - メッセージ内容
 * @param {string[]} whitelist - 許可ドメインリスト
 * @returns {boolean} 禁止リンクが含まれている場合true
 */
function checkLinks(content, whitelist) {
    const urls = content.match(URL_REGEX)
    if (!urls || urls.length === 0) return false

    for (const url of urls) {
        try {
            const hostname = new URL(url).hostname
            const isAllowed = whitelist.some(domain => {
                const d = domain.toLowerCase().trim()
                return hostname === d || hostname.endsWith('.' + d)
            })
            if (!isAllowed) return true
        } catch {
            // 不正なURLは禁止扱い
            return true
        }
    }
    return false
}

/**
 * 大文字フィルターチェック
 * @param {string} content - メッセージ内容
 * @param {number} threshold - 大文字の割合閾値（0-100）
 * @returns {boolean} 閾値を超えている場合true
 */
function checkCaps(content, threshold) {
    // アルファベットのみ対象（日本語等は無視）
    const letters = content.replace(/[^a-zA-Z]/g, '')
    if (letters.length < 10) return false

    const upperCount = (letters.match(/[A-Z]/g) || []).length
    const percentage = (upperCount / letters.length) * 100
    return percentage > threshold
}

/**
 * モデレーションアクションを実行する
 * @param {import('discord.js').Message} message
 * @param {string} action - 実行するアクション
 * @param {string} reason - アクションの理由
 */
async function executeAction(message, action, reason) {
    try {
        switch (action) {
            case 'delete_warn':
                await message.delete().catch(() => {})
                await message.channel.send(
                    `${message.author} 警告: ${reason}`
                ).catch(() => {})
                break
            case 'delete':
                await message.delete().catch(() => {})
                break
            case 'mute':
                await message.delete().catch(() => {})
                if (message.member?.moderatable) {
                    // 10分間タイムアウト
                    await message.member.timeout(10 * 60 * 1000, reason).catch(() => {})
                }
                break
            case 'kick':
                await message.delete().catch(() => {})
                if (message.member?.kickable) {
                    await message.member.kick(reason).catch(() => {})
                }
                break
            case 'ban':
                await message.delete().catch(() => {})
                if (message.member?.bannable) {
                    await message.member.ban({ reason }).catch(() => {})
                }
                break
        }
    } catch (err) {
        console.error('Moderation action error:', err.message)
    }
}

/**
 * ログチャンネルにモデレーションログを送信する
 * @param {import('discord.js').Message} message
 * @param {string} logChannelId
 * @param {string} reason
 * @param {string} action
 */
async function sendLog(message, logChannelId, reason, action) {
    if (!logChannelId) return

    try {
        const channel = message.guild.channels.cache.get(logChannelId)
        if (!channel) return

        await channel.send({
            embeds: [{
                color: 0xff4444,
                title: 'モデレーションログ',
                fields: [
                    { name: 'ユーザー', value: `${message.author.tag} (${message.author.id})`, inline: true },
                    { name: 'アクション', value: action, inline: true },
                    { name: '理由', value: reason },
                    { name: 'チャンネル', value: `<#${message.channel.id}>`, inline: true },
                    { name: 'メッセージ内容', value: message.content.substring(0, 1024) || '(空)' }
                ],
                timestamp: new Date().toISOString()
            }]
        }).catch(() => {})
    } catch (err) {
        console.error('Moderation log error:', err.message)
    }
}

/**
 * 警告上限チェックとアクション実行
 * @param {import('discord.js').Message} message
 * @param {object} settings
 */
async function handleWarningLimit(message, settings) {
    const { warningLimit, warningAction, logChannelId } = settings
    if (!warningLimit || warningLimit <= 0) return

    const { limitReached, count } = addWarning(
        message.guild.id,
        message.author.id,
        warningLimit,
        warningAction
    )

    if (limitReached && warningAction) {
        const reason = `警告上限到達 (${count}/${warningLimit})`
        await executeAction(message, warningAction, reason)
        await sendLog(message, logChannelId, reason, warningAction)
        // 警告カウントをリセット
        const key = makeKey(message.guild.id, message.author.id)
        warningCounts.set(key, 0)
    }
}

/**
 * メッセージのモデレーションチェックを実行する
 * @param {import('discord.js').Message} message - Discordメッセージ
 * @param {object} dbHelpers - DB操作ヘルパー
 * @returns {Promise<{ blocked: boolean, reason: string }>}
 */
export async function checkMessage(message, dbHelpers) {
    const guildId = message.guild?.id
    if (!guildId) return { blocked: false, reason: '' }

    let settings
    try {
        settings = dbHelpers.getModerationSettings(guildId)
    } catch {
        return { blocked: false, reason: '' }
    }

    if (!settings) return { blocked: false, reason: '' }

    // 管理者はモデレーション対象外
    if (message.member?.permissions?.has('Administrator')) {
        return { blocked: false, reason: '' }
    }

    const content = message.content || ''

    // 1. NGワードフィルター
    if (settings.ngWordEnabled && settings.ngWords && settings.ngWords.length > 0) {
        const matched = checkNgWords(content, settings.ngWords)
        if (matched) {
            const reason = `NGワード検出: "${matched}"`
            const action = settings.action || 'delete_warn'
            await executeAction(message, action, reason)
            await sendLog(message, settings.logChannelId, reason, action)
            if (action === 'delete_warn') {
                await handleWarningLimit(message, settings)
            }
            return { blocked: true, reason }
        }
    }

    // 2. スパム検知
    if (settings.spamEnabled && settings.spamThreshold && settings.spamTimeWindow) {
        const isSpam = checkSpam(
            guildId,
            message.author.id,
            settings.spamThreshold,
            settings.spamTimeWindow
        )
        if (isSpam) {
            const reason = `スパム検知: ${settings.spamTimeWindow}秒以内に${settings.spamThreshold}件以上のメッセージ`
            const action = settings.spamAction || 'mute'
            await executeAction(message, action, reason)
            await sendLog(message, settings.logChannelId, reason, action)
            return { blocked: true, reason }
        }
    }

    // 3. リンクフィルター
    if (settings.linkFilterEnabled) {
        const whitelist = settings.linkWhitelist || []
        const hasDisallowedLink = checkLinks(content, whitelist)
        if (hasDisallowedLink) {
            const reason = 'リンクフィルター: 許可されていないURLが含まれています'
            await executeAction(message, 'delete_warn', reason)
            await sendLog(message, settings.logChannelId, reason, 'delete_warn')
            await handleWarningLimit(message, settings)
            return { blocked: true, reason }
        }
    }

    // 4. 大文字フィルター
    if (settings.capsFilterEnabled && settings.capsThreshold) {
        const isCapsExceeded = checkCaps(content, settings.capsThreshold)
        if (isCapsExceeded) {
            const reason = `大文字フィルター: 大文字の割合が${settings.capsThreshold}%を超えています`
            await message.channel.send(
                `${message.author} 警告: ${reason}`
            ).catch(() => {})
            await sendLog(message, settings.logChannelId, reason, 'warn')
            await handleWarningLimit(message, settings)
            // 大文字警告はメッセージ自体はブロックしない
            return { blocked: false, reason }
        }
    }

    return { blocked: false, reason: '' }
}
