import test from 'node:test'
import assert from 'node:assert/strict'
import { handleEconomy } from '../server/bot/commands/economy.js'

function createInteraction() {
  const replies = []
  return {
    guild: { id: 'guild-1' },
    user: {
      id: 'user-1',
      username: 'tester',
      displayAvatarURL: () => 'https://example.com/avatar.png',
    },
    replies,
    reply: async payload => replies.push(payload),
  }
}

test('/daily の成功応答は本人だけに表示される', async () => {
  const interaction = createInteraction()
  const dbHelpers = {
    getOrCreateMember: () => ({}),
    claimDaily: () => ({ success: true, amount: 50, streak: 2 }),
  }

  await handleEconomy(interaction, dbHelpers, 'daily')

  assert.equal(interaction.replies.length, 1)
  assert.equal(interaction.replies[0].ephemeral, true)
  assert.equal(interaction.replies[0].embeds[0].toJSON().title, '🎁 デイリーボーナス')
})

test('/daily が無効な場合は壊れた日時を生成せず理由を返す', async () => {
  const interaction = createInteraction()
  const dbHelpers = {
    getOrCreateMember: () => ({}),
    claimDaily: () => ({ success: false, error: 'ポイントシステムは現在無効です' }),
  }

  await handleEconomy(interaction, dbHelpers, 'daily')

  assert.deepEqual(interaction.replies, [{
    content: '⏰ ポイントシステムは現在無効です',
    ephemeral: true,
  }])
})

test('/daily の再受取可能時刻を Discord timestamp で返す', async () => {
  const interaction = createInteraction()
  const dbHelpers = {
    getOrCreateMember: () => ({}),
    claimDaily: () => ({
      success: false,
      error: '今日はすでにデイリーボーナスを受け取っています',
      nextClaim: '2026-07-17T15:00:00.000Z',
    }),
  }

  await handleEconomy(interaction, dbHelpers, 'daily')

  assert.match(interaction.replies[0].content, /<t:1784300400:R>/)
})
