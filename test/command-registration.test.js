import test from 'node:test'
import assert from 'node:assert/strict'
import { filterCustomCommands } from '../server/bot/register.js'

test('ビルトインと同名のユーザー定義コマンドは同期対象から除外する', () => {
  const result = filterCustomCommands([
    { name: 'daily', enabled: true },
    { name: 'hello', enabled: true },
    { name: 'disabled', enabled: false },
  ])

  assert.deepEqual(result.commands, [{ name: 'hello', enabled: true }])
  assert.deepEqual(result.conflicts, ['daily'])
})
