/**
 * APIリクエストのバリデーションミドルウェア
 * 各エンドポイントに必要なパラメータチェックを提供する
 */

/** Discord Snowflake ID の形式チェック（17-20桁の数字文字列） */
const SNOWFLAKE_RE = /^\d{17,20}$/

/**
 * バリデーションエラーを生成する
 * @param {string} message - エラーメッセージ
 * @returns {Error} statusプロパティ付きのエラー
 */
function validationError(message) {
  const err = new Error(message)
  err.status = 400
  return err
}

/**
 * guildIdをクエリパラメータから必須で取得するミドルウェア
 */
export function requireGuildId(req, res, next) {
  const guildId = req.query.guildId || req.body?.guildId
  if (!guildId || typeof guildId !== 'string') {
    return next(validationError('guildIdが必要です'))
  }
  if (!SNOWFLAKE_RE.test(guildId)) {
    return next(validationError('guildIdの形式が不正です'))
  }
  next()
}

/**
 * URLパラメータのIDが正の整数であることを検証するミドルウェア
 * @param {string} paramName - パラメータ名（デフォルト: 'id'）
 */
export function requireIntParam(paramName = 'id') {
  return (req, res, next) => {
    const value = parseInt(req.params[paramName])
    if (isNaN(value) || value < 1) {
      return next(validationError(`${paramName}は正の整数である必要があります`))
    }
    req.params[paramName] = String(value)
    next()
  }
}

/**
 * リクエストボディの必須フィールドを検証するミドルウェア
 * @param {string[]} fields - 必須フィールド名の配列
 */
export function requireBody(...fields) {
  return (req, res, next) => {
    if (!req.body || typeof req.body !== 'object') {
      return next(validationError('リクエストボディが必要です'))
    }
    for (const field of fields) {
      if (req.body[field] === undefined || req.body[field] === null || req.body[field] === '') {
        return next(validationError(`${field}が必要です`))
      }
    }
    next()
  }
}

/**
 * 文字列フィールドの最大長を検証するミドルウェア
 * @param {Object<string, number>} limits - フィールド名と最大長のマッピング
 */
export function maxLength(limits) {
  return (req, res, next) => {
    for (const [field, max] of Object.entries(limits)) {
      const value = req.body?.[field]
      if (typeof value === 'string' && value.length > max) {
        return next(validationError(`${field}は${max}文字以内にしてください`))
      }
    }
    next()
  }
}

/**
 * 数値フィールドの範囲を検証するミドルウェア
 * @param {Object<string, {min?: number, max?: number}>} ranges - フィールド名と範囲のマッピング
 */
export function numberRange(ranges) {
  return (req, res, next) => {
    for (const [field, { min, max }] of Object.entries(ranges)) {
      const value = req.body?.[field]
      if (value !== undefined && value !== null) {
        if (typeof value !== 'number' || isNaN(value)) {
          return next(validationError(`${field}は数値である必要があります`))
        }
        if (min !== undefined && value < min) {
          return next(validationError(`${field}は${min}以上である必要があります`))
        }
        if (max !== undefined && value > max) {
          return next(validationError(`${field}は${max}以下である必要があります`))
        }
      }
    }
    next()
  }
}

/**
 * リクエストボディのサイズ上限を検証するミドルウェア（JSONペイロード）
 * express.json()の制限と併用
 */
export function limitBodySize(maxKeys = 50) {
  return (req, res, next) => {
    if (req.body && typeof req.body === 'object') {
      const keys = Object.keys(req.body)
      if (keys.length > maxKeys) {
        return next(validationError(`リクエストのフィールド数が多すぎます（上限: ${maxKeys}）`))
      }
    }
    next()
  }
}
