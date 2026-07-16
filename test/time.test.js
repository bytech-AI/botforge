import test from 'node:test'
import assert from 'node:assert/strict'
import { getDateKey, getDayBounds, getDayBoundsForDateKey, shiftDateKey } from '../server/utils/time.js'

test('Asia/Tokyo の日付は 00:00 JST で切り替わる', () => {
  assert.equal(getDateKey(new Date('2026-07-16T14:59:59Z'), 'Asia/Tokyo'), '2026-07-16')
  assert.equal(getDateKey(new Date('2026-07-16T15:00:00Z'), 'Asia/Tokyo'), '2026-07-17')
})

test('SQLite の日次範囲は UTC CURRENT_TIMESTAMP と比較できる形式になる', () => {
  assert.deepEqual(getDayBounds(new Date('2026-07-17T02:00:00Z'), 'Asia/Tokyo'), {
    dateKey: '2026-07-17',
    start: '2026-07-16 15:00:00',
    end: '2026-07-17 15:00:00',
    nextClaim: '2026-07-17T15:00:00.000Z',
  })
})

test('日付キーからも同じ日次範囲を復元できる', () => {
  assert.deepEqual(
    getDayBoundsForDateKey('2026-07-17', 'Asia/Tokyo'),
    getDayBounds(new Date('2026-07-17T02:00:00Z'), 'Asia/Tokyo')
  )
})

test('DST で1日が23時間になるタイムゾーンにも対応する', () => {
  const bounds = getDayBounds(new Date('2026-03-08T12:00:00Z'), 'America/New_York')
  assert.equal(bounds.start, '2026-03-08 05:00:00')
  assert.equal(bounds.end, '2026-03-09 04:00:00')
})

test('カレンダー日の移動は月末・うるう年をまたげる', () => {
  assert.equal(shiftDateKey('2024-02-28', 1), '2024-02-29')
  assert.equal(shiftDateKey('2024-02-29', 1), '2024-03-01')
  assert.equal(shiftDateKey('2026-01-01', -1), '2025-12-31')
})
