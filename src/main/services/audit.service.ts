import { getDatabase } from './db.service'
import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import Database from 'better-sqlite3'

export interface AuditLogPayload {
  actorUserId: number
  overrideByUserId?: number
  action: string
  entityType: string
  entityId?: number
  beforeJson?: any
  afterJson?: any
  reason?: string
}

/**
 * Logs an action to the audit trail.
 * IMPORTANT: If used as part of a larger operation (e.g., updating a batch),
 * this function should be called within the same transaction to ensure atomicity.
 * In such cases, pass the 'db' instance from the active transaction if available,
 * or call this directly if it's a standalone log.
 */
export function logAuditAction(payload: AuditLogPayload, dbContext?: Database.Database) {
  const db = dbContext || getDatabase()
  
  const insert = db.prepare(`
    INSERT INTO audit_logs (
      actor_user_id, 
      override_by_user_id, 
      action, 
      entity_type, 
      entity_id, 
      before_json, 
      after_json, 
      reason
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)

  insert.run(
    payload.actorUserId,
    payload.overrideByUserId || null,
    payload.action,
    payload.entityType,
    payload.entityId || null,
    payload.beforeJson ? JSON.stringify(payload.beforeJson) : null,
    payload.afterJson ? JSON.stringify(payload.afterJson) : null,
    payload.reason || null
  )
}

export function getAuditLogs(page: number = 1, pageSize: number = 50) {
  const db = getDatabase()
  const offset = (page - 1) * pageSize

  const totalRow = db.prepare('SELECT count(*) as total FROM audit_logs').get() as { total: number }
  
  const data = db.prepare(`
    SELECT 
      a.*, 
      u1.display_name as actor_name, 
      u2.display_name as override_name
    FROM audit_logs a
    JOIN users u1 ON a.actor_user_id = u1.id
    LEFT JOIN users u2 ON a.override_by_user_id = u2.id
    ORDER BY a.created_at DESC
    LIMIT ? OFFSET ?
  `).all(pageSize, offset)

  return {
    data,
    total: totalRow.total,
    page,
    pageSize
  }
}

export function registerAuditHandlers() {
  ipcMain.handle(IPC_CHANNELS.AUDIT_LOG_LIST, (_, { page, pageSize }) => {
    return getAuditLogs(page, pageSize)
  })
}
