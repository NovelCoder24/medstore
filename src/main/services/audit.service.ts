import { getDatabase } from './db.service'
import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import Database from 'better-sqlite3'

export interface AuditLogPayload {
  actorUserId: number
  overrideByUserId?: number
  action: string
  entityType: string
  entityId: number | null
  entityName: string
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
      entity_name,
      before_json, 
      after_json, 
      reason
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  insert.run(
    payload.actorUserId,
    payload.overrideByUserId || null,
    payload.action,
    payload.entityType,
    payload.entityId || null,
    payload.entityName,
    payload.beforeJson ? JSON.stringify(payload.beforeJson) : null,
    payload.afterJson ? JSON.stringify(payload.afterJson) : null,
    payload.reason || 'No reason provided'
  )
}

export function getAuditLogs(page: number = 1, pageSize: number = 50, filters?: { action?: string, startDate?: string, endDate?: string }) {
  const db = getDatabase()
  const offset = (page - 1) * pageSize

  let whereClause = '1=1'
  const params: any[] = []

  if (filters?.action && filters.action !== 'ALL') {
    whereClause += ' AND a.action = ?'
    params.push(filters.action)
  }

  if (filters?.startDate && filters?.endDate) {
    whereClause += ' AND a.created_at >= ? AND a.created_at <= ?'
    params.push(filters.startDate, filters.endDate + 'T23:59:59')
  }

  const totalRow = db.prepare(`SELECT count(*) as total FROM audit_logs a WHERE ${whereClause}`).get(...params) as { total: number }
  
  params.push(pageSize, offset)

  const data = db.prepare(`
    SELECT 
      a.*, 
      u1.display_name as actor_name, 
      u2.display_name as override_name
    FROM audit_logs a
    JOIN users u1 ON a.actor_user_id = u1.id
    LEFT JOIN users u2 ON a.override_by_user_id = u2.id
    WHERE ${whereClause}
    ORDER BY a.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params)

  return {
    data,
    total: totalRow.total,
    page,
    pageSize
  }
}

export function registerAuditHandlers() {
  ipcMain.handle(IPC_CHANNELS.AUDIT_LOG_LIST, (_, { page, pageSize, filters }) => {
    return getAuditLogs(page, pageSize, filters)
  })
}
