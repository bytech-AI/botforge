const DEFAULT_TIME_ZONE = 'Asia/Tokyo'

/** BotForge の日次処理で使う IANA タイムゾーンを返す。 */
export function getAppTimeZone() {
  const timeZone = process.env.BOTFORGE_TIME_ZONE || DEFAULT_TIME_ZONE
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format()
    return timeZone
  } catch {
    console.warn(`Invalid BOTFORGE_TIME_ZONE "${timeZone}"; falling back to ${DEFAULT_TIME_ZONE}`)
    return DEFAULT_TIME_ZONE
  }
}

function zonedParts(date, timeZone, includeTime = false) {
  const options = {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }
  if (includeTime) {
    Object.assign(options, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
  }
  return Object.fromEntries(
    new Intl.DateTimeFormat('en-US', options)
      .formatToParts(date)
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, Number(part.value)])
  )
}

/** 指定タイムゾーンでの YYYY-MM-DD を返す。 */
export function getDateKey(date = new Date(), timeZone = getAppTimeZone()) {
  const { year, month, day } = zonedParts(date, timeZone)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** YYYY-MM-DD をカレンダー日単位で移動する。 */
export function shiftDateKey(dateKey, days) {
  const [year, month, day] = dateKey.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, month - 1, day + days))
  return shifted.toISOString().slice(0, 10)
}

/** 指定タイムゾーンのローカル日時を UTC の Date に変換する。 */
export function zonedDateTimeToUtc(dateKey, time = '00:00:00', timeZone = getAppTimeZone()) {
  const [year, month, day] = dateKey.split('-').map(Number)
  const [hour, minute, second] = time.split(':').map(Number)
  const desired = Date.UTC(year, month - 1, day, hour, minute, second)
  let guess = desired

  // DST を含むオフセットを Intl から逆算する。境界付近でも収束するよう反復する。
  for (let i = 0; i < 3; i += 1) {
    const parts = zonedParts(new Date(guess), timeZone, true)
    const represented = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
    const adjustment = desired - represented
    guess += adjustment
    if (adjustment === 0) break
  }
  return new Date(guess)
}

function toSqliteTimestamp(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ')
}

/** SQLite CURRENT_TIMESTAMP (UTC) と比較できるローカル日の範囲を返す。 */
export function getDayBounds(date = new Date(), timeZone = getAppTimeZone()) {
  const dateKey = getDateKey(date, timeZone)
  return getDayBoundsForDateKey(dateKey, timeZone)
}

/** YYYY-MM-DD で指定したローカル日の SQLite 比較範囲を返す。 */
export function getDayBoundsForDateKey(dateKey, timeZone = getAppTimeZone()) {
  const nextDateKey = shiftDateKey(dateKey, 1)
  return {
    dateKey,
    start: toSqliteTimestamp(zonedDateTimeToUtc(dateKey, '00:00:00', timeZone)),
    end: toSqliteTimestamp(zonedDateTimeToUtc(nextDateKey, '00:00:00', timeZone)),
    nextClaim: zonedDateTimeToUtc(nextDateKey, '00:00:00', timeZone).toISOString(),
  }
}
