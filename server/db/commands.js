import { getDb } from './connection.js'

// ============================
// Commands DB Helpers
// ============================

function deserializeCommand(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    responseType: row.response_type,
    responseText: row.response_text,
    embedTitle: row.embed_title,
    embedDescription: row.embed_description,
    embedColor: row.embed_color,
    ephemeral: !!row.ephemeral,
    cooldown: row.cooldown,
    enabled: !!row.enabled,
    options: JSON.parse(row.options || '[]'),
    requiredPermissions: JSON.parse(row.required_permissions || '[]'),
    allowedRoles: JSON.parse(row.allowed_roles || '[]'),
    randomResponses: JSON.parse(row.random_responses || '[]'),
    dmResponse: !!row.dm_response,
    isBuiltin: !!row.is_builtin,
    pointCost: row.point_cost || 0,
    pointRewardMin: row.point_reward_min || 0,
    pointRewardMax: row.point_reward_max || 0,
  }
}

export function getAllCommands() {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM commands ORDER BY id ASC').all()
  return rows.map(deserializeCommand)
}

export function createCommand(cmd) {
  const db = getDb()
  const stmt = db.prepare(`INSERT INTO commands (name, description, response_type, response_text,
    embed_title, embed_description, embed_color, ephemeral, cooldown, enabled,
    options, required_permissions, allowed_roles, random_responses, dm_response,
    is_builtin, point_cost, point_reward_min, point_reward_max)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  const result = stmt.run(
    cmd.name, cmd.description || '', cmd.responseType || 'text', cmd.responseText || '',
    cmd.embedTitle || '', cmd.embedDescription || '', cmd.embedColor || '#7c5cfc',
    cmd.ephemeral ? 1 : 0, cmd.cooldown || 0, cmd.enabled !== false ? 1 : 0,
    JSON.stringify(cmd.options || []),
    JSON.stringify(cmd.requiredPermissions || []),
    JSON.stringify(cmd.allowedRoles || []),
    JSON.stringify(cmd.randomResponses || []),
    cmd.dmResponse ? 1 : 0,
    cmd.isBuiltin ? 1 : 0,
    cmd.pointCost || 0, cmd.pointRewardMin || 0, cmd.pointRewardMax || 0
  )
  return deserializeCommand(db.prepare('SELECT * FROM commands WHERE id = ?').get(result.lastInsertRowid))
}

export function updateCommand(id, cmd) {
  const db = getDb()
  db.prepare(`UPDATE commands SET name = ?, description = ?, response_type = ?, response_text = ?,
    embed_title = ?, embed_description = ?, embed_color = ?, ephemeral = ?, cooldown = ?, enabled = ?,
    options = ?, required_permissions = ?, allowed_roles = ?, random_responses = ?, dm_response = ?,
    is_builtin = ?, point_cost = ?, point_reward_min = ?, point_reward_max = ?,
    updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .run(
      cmd.name, cmd.description || '', cmd.responseType || 'text', cmd.responseText || '',
      cmd.embedTitle || '', cmd.embedDescription || '', cmd.embedColor || '#7c5cfc',
      cmd.ephemeral ? 1 : 0, cmd.cooldown || 0, cmd.enabled !== false ? 1 : 0,
      JSON.stringify(cmd.options || []),
      JSON.stringify(cmd.requiredPermissions || []),
      JSON.stringify(cmd.allowedRoles || []),
      JSON.stringify(cmd.randomResponses || []),
      cmd.dmResponse ? 1 : 0,
      cmd.isBuiltin ? 1 : 0,
      cmd.pointCost || 0, cmd.pointRewardMin || 0, cmd.pointRewardMax || 0,
      id
    )
}

export function deleteCommand(id) {
  const db = getDb()
  db.prepare('DELETE FROM commands WHERE id = ?').run(id)
}
