/**
 * Express グローバルエラーハンドラ
 * 全てのルートでthrowされたエラーをキャッチし、統一形式で返す
 */

/**
 * 非同期ルートハンドラをラップし、エラーをnext()に渡す
 * @param {Function} fn - async (req, res, next) => {} 形式のハンドラ
 * @returns {Function} Expressルートハンドラ
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

/**
 * 404ハンドラ（APIルート用）
 */
export function notFoundHandler(req, res, next) {
  if (req.path.startsWith('/api/')) {
    const err = new Error(`エンドポイントが見つかりません: ${req.method} ${req.path}`)
    err.status = 404
    next(err)
  } else {
    next()
  }
}

/**
 * グローバルエラーハンドラ
 * 統一形式: { error: string, details?: string }
 */
export function globalErrorHandler(err, req, res, _next) {
  const status = err.status || 500
  const message = err.message || '内部エラーが発生しました'

  // 500エラーはサーバーログに出力
  if (status >= 500) {
    console.error(`[ERROR] ${req.method} ${req.path}:`, err.message)
    if (process.env.NODE_ENV !== 'production') {
      console.error(err.stack)
    }
  }

  res.status(status).json({
    error: status >= 500 ? '内部エラーが発生しました' : message,
    ...(process.env.NODE_ENV !== 'production' && status >= 500 && { details: err.message }),
  })
}
