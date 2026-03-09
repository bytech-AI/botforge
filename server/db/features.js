import { getDb } from './connection.js'

// ============================
// Auto Response DB Helpers
// ============================

export function getAllAutoResponses(guildId) {
  const db = getDb()
  return db.prepare('SELECT * FROM auto_responses WHERE guild_id = ? ORDER BY id ASC').all(guildId || '__global__')
    .map(r => ({ ...r, enabled: !!r.enabled }))
}

export function getAutoResponsesGlobal() {
  const db = getDb()
  return db.prepare('SELECT * FROM auto_responses ORDER BY id ASC').all()
    .map(r => ({ ...r, enabled: !!r.enabled }))
}

export function createAutoResponse(data) {
  const db = getDb()
  const guildId = data.guildId || '__global__'
  const result = db.prepare(`INSERT INTO auto_responses (guild_id, trigger_text, match_type, response, channel_scope, channel_id, enabled)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    guildId, data.trigger, data.matchType || 'contains', data.response,
    data.channel || 'all', data.channelId || '', data.enabled !== false ? 1 : 0
  )
  return db.prepare('SELECT * FROM auto_responses WHERE id = ?').get(result.lastInsertRowid)
}

export function updateAutoResponse(id, data) {
  const db = getDb()
  db.prepare(`UPDATE auto_responses SET trigger_text = ?, match_type = ?, response = ?,
    channel_scope = ?, channel_id = ?, enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(
    data.trigger, data.matchType || 'contains', data.response,
    data.channel || 'all', data.channelId || '', data.enabled !== false ? 1 : 0, id
  )
}

export function deleteAutoResponse(id) {
  const db = getDb()
  db.prepare('DELETE FROM auto_responses WHERE id = ?').run(id)
}

// ============================
// Moderation Settings DB Helpers
// ============================

export function getModerationSettings(guildId) {
  const db = getDb()
  let settings = db.prepare('SELECT * FROM moderation_settings WHERE guild_id = ?').get(guildId)
  if (!settings) {
    db.prepare('INSERT INTO moderation_settings (guild_id) VALUES (?)').run(guildId)
    settings = db.prepare('SELECT * FROM moderation_settings WHERE guild_id = ?').get(guildId)
  }
  return {
    ...settings,
    ngWordEnabled: !!settings.ng_word_enabled,
    ngWords: JSON.parse(settings.ng_words || '[]'),
    action: settings.action,
    spamEnabled: !!settings.spam_enabled,
    spamThreshold: settings.spam_threshold,
    spamTimeWindow: settings.spam_time_window,
    spamAction: settings.spam_action,
    linkFilterEnabled: !!settings.link_filter_enabled,
    linkWhitelist: JSON.parse(settings.link_whitelist || '[]'),
    capsFilterEnabled: !!settings.caps_filter_enabled,
    capsThreshold: settings.caps_threshold,
    logChannelId: settings.log_channel_id,
    warningLimit: settings.warning_limit,
    warningAction: settings.warning_action,
  }
}

export function updateModerationSettings(guildId, s) {
  const db = getDb()
  db.prepare(`UPDATE moderation_settings SET
    ng_word_enabled = ?, ng_words = ?, action = ?,
    spam_enabled = ?, spam_threshold = ?, spam_time_window = ?, spam_action = ?,
    link_filter_enabled = ?, link_whitelist = ?,
    caps_filter_enabled = ?, caps_threshold = ?,
    log_channel_id = ?, warning_limit = ?, warning_action = ?,
    updated_at = CURRENT_TIMESTAMP WHERE guild_id = ?`).run(
    s.ngWordEnabled ? 1 : 0, JSON.stringify(s.ngWords || []), s.action || 'delete_warn',
    s.spamEnabled ? 1 : 0, s.spamThreshold || 5, s.spamTimeWindow || 10, s.spamAction || 'mute',
    s.linkFilterEnabled ? 1 : 0, JSON.stringify(s.linkWhitelist || []),
    s.capsFilterEnabled ? 1 : 0, s.capsThreshold || 70,
    s.logChannelId || '', s.warningLimit || 3, s.warningAction || 'kick',
    guildId
  )
}

// ============================
// Scheduled Messages DB Helpers
// ============================

export function getAllScheduledMessages(guildId) {
  const db = getDb()
  return db.prepare('SELECT * FROM scheduled_messages WHERE guild_id = ? ORDER BY id ASC').all(guildId)
    .map(s => ({ ...s, enabled: !!s.enabled, days: JSON.parse(s.days || '[]') }))
}

export function createScheduledMessage(data) {
  const db = getDb()
  const result = db.prepare(`INSERT INTO scheduled_messages (guild_id, name, message, channel_id, time, days, timezone, enabled)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    data.guildId, data.name, data.message, data.channelId || '',
    data.time || '12:00', JSON.stringify(data.days || []), data.timezone || 'Asia/Tokyo',
    data.enabled !== false ? 1 : 0
  )
  const row = db.prepare('SELECT * FROM scheduled_messages WHERE id = ?').get(result.lastInsertRowid)
  return { ...row, enabled: !!row.enabled, days: JSON.parse(row.days || '[]') }
}

export function updateScheduledMessage(id, data) {
  const db = getDb()
  db.prepare(`UPDATE scheduled_messages SET name = ?, message = ?, channel_id = ?,
    time = ?, days = ?, timezone = ?, enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(
    data.name, data.message, data.channelId || '',
    data.time || '12:00', JSON.stringify(data.days || []), data.timezone || 'Asia/Tokyo',
    data.enabled !== false ? 1 : 0, id
  )
}

export function deleteScheduledMessage(id) {
  const db = getDb()
  db.prepare('DELETE FROM scheduled_messages WHERE id = ?').run(id)
}

// ============================
// Welcome Settings DB Helpers
// ============================

export function getWelcomeSettings(guildId) {
  const db = getDb()
  let settings = db.prepare('SELECT * FROM welcome_settings WHERE guild_id = ?').get(guildId)
  if (!settings) {
    db.prepare('INSERT INTO welcome_settings (guild_id) VALUES (?)').run(guildId)
    settings = db.prepare('SELECT * FROM welcome_settings WHERE guild_id = ?').get(guildId)
  }
  return {
    welcome: {
      enabled: !!settings.welcome_enabled,
      channelId: settings.welcome_channel_id || '',
      message: settings.welcome_message || '',
      embedEnabled: !!settings.welcome_embed_enabled,
      embedTitle: settings.welcome_embed_title || '',
      embedDescription: settings.welcome_embed_description || '',
      embedColor: settings.welcome_embed_color || '#7c5cfc',
      embedThumbnail: !!settings.welcome_embed_thumbnail,
      dmEnabled: !!settings.welcome_dm_enabled,
      dmMessage: settings.welcome_dm_message || '',
    },
    leave: {
      enabled: !!settings.leave_enabled,
      channelId: settings.leave_channel_id || '',
      message: settings.leave_message || '',
    }
  }
}

export function updateWelcomeSettings(guildId, data) {
  const db = getDb()
  const w = data.welcome || {}
  const l = data.leave || {}
  db.prepare(`UPDATE welcome_settings SET
    welcome_enabled = ?, welcome_channel_id = ?, welcome_message = ?,
    welcome_embed_enabled = ?, welcome_embed_title = ?, welcome_embed_description = ?,
    welcome_embed_color = ?, welcome_embed_thumbnail = ?,
    welcome_dm_enabled = ?, welcome_dm_message = ?,
    leave_enabled = ?, leave_channel_id = ?, leave_message = ?,
    updated_at = CURRENT_TIMESTAMP WHERE guild_id = ?`).run(
    w.enabled ? 1 : 0, w.channelId || '', w.message || '',
    w.embedEnabled ? 1 : 0, w.embedTitle || '', w.embedDescription || '',
    w.embedColor || '#7c5cfc', w.embedThumbnail !== false ? 1 : 0,
    w.dmEnabled ? 1 : 0, w.dmMessage || '',
    l.enabled ? 1 : 0, l.channelId || '', l.message || '',
    guildId
  )
}

// ============================
// Embed Templates DB Helpers
// ============================

export function getAllEmbedTemplates(guildId) {
  const db = getDb()
  return db.prepare('SELECT * FROM embed_templates WHERE guild_id = ? ORDER BY id DESC').all(guildId)
    .map(t => ({ ...t, embedData: JSON.parse(t.embed_data || '{}') }))
}

export function createEmbedTemplate(data) {
  const db = getDb()
  const result = db.prepare(`INSERT INTO embed_templates (guild_id, name, embed_data) VALUES (?, ?, ?)`)
    .run(data.guildId, data.name, JSON.stringify(data.embedData || {}))
  const row = db.prepare('SELECT * FROM embed_templates WHERE id = ?').get(result.lastInsertRowid)
  return { ...row, embedData: JSON.parse(row.embed_data || '{}') }
}

export function updateEmbedTemplate(id, data) {
  const db = getDb()
  db.prepare(`UPDATE embed_templates SET name = ?, embed_data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .run(data.name, JSON.stringify(data.embedData || {}), id)
}

export function deleteEmbedTemplate(id) {
  const db = getDb()
  db.prepare('DELETE FROM embed_templates WHERE id = ?').run(id)
}

// ============================
// Channel Multipliers DB Helpers
// ============================

export function getChannelMultipliers(guildId) {
  const db = getDb()
  return db.prepare('SELECT * FROM channel_multipliers WHERE guild_id = ? ORDER BY id ASC').all(guildId)
}

export function updateChannelMultipliers(guildId, multipliers) {
  const db = getDb()
  const del = db.prepare('DELETE FROM channel_multipliers WHERE guild_id = ?')
  const ins = db.prepare('INSERT INTO channel_multipliers (guild_id, channel_id, multiplier) VALUES (?, ?, ?)')
  const tx = db.transaction(() => {
    del.run(guildId)
    for (const m of multipliers) {
      ins.run(guildId, m.channelId, m.multiplier ?? 1.0)
    }
  })
  tx()
}

export function getChannelMultiplier(guildId, channelId) {
  const db = getDb()
  const row = db.prepare('SELECT multiplier FROM channel_multipliers WHERE guild_id = ? AND channel_id = ?').get(guildId, channelId)
  return row ? row.multiplier : 1.0
}

// ============================
// Point Decay Settings DB Helpers
// ============================

export function getPointDecaySettings(guildId) {
  const db = getDb()
  let settings = db.prepare('SELECT * FROM point_decay_settings WHERE guild_id = ?').get(guildId)
  if (!settings) {
    db.prepare('INSERT INTO point_decay_settings (guild_id) VALUES (?)').run(guildId)
    settings = db.prepare('SELECT * FROM point_decay_settings WHERE guild_id = ?').get(guildId)
  }
  return {
    decay: {
      enabled: !!settings.decay_enabled,
      type: settings.decay_type || 'percentage',
      amount: settings.decay_amount || 5,
      interval: settings.decay_interval || 30,
      minPoints: settings.decay_min_points || 0,
    },
    expiry: {
      enabled: !!settings.expiry_enabled,
      days: settings.expiry_days || 90,
    }
  }
}

export function updatePointDecaySettings(guildId, data) {
  const db = getDb()
  const d = data.decay || {}
  const e = data.expiry || {}
  db.prepare(`UPDATE point_decay_settings SET
    decay_enabled = ?, decay_type = ?, decay_amount = ?, decay_interval = ?, decay_min_points = ?,
    expiry_enabled = ?, expiry_days = ?, updated_at = CURRENT_TIMESTAMP WHERE guild_id = ?`).run(
    d.enabled ? 1 : 0, d.type || 'percentage', d.amount || 5, d.interval || 30, d.minPoints || 0,
    e.enabled ? 1 : 0, e.days || 90, guildId
  )
}
