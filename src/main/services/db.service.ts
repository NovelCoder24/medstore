/**
 * Database Service — SQLite initialization, configuration, and migration runner.
 *
 * KEY CONFIG:
 * - WAL journal mode for concurrent read/write performance
 * - synchronous = FULL for power-loss resilience (no confirmed UPS)
 * - foreign_keys = ON enforced on every connection
 * - busy_timeout = 5000ms to handle lock contention with worker threads
 *
 * The database file lives in Electron's userData directory:
 *   %APPDATA%/medstore-pos/data/medstore.db
 */

import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import { migrations } from '../db/migrations'
import { APP_DEFAULTS } from '../../shared/constants'

let db: Database.Database | null = null

/**
 * Get the active database connection.
 * Throws if initDatabase() has not been called.
 */
export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return db
}

/**
 * Initialize the SQLite database:
 * 1. Create data directory if needed
 * 2. Open/create the database file
 * 3. Configure WAL, foreign keys, etc.
 * 4. Run pending migrations
 */
export function initDatabase(): void {
  const userDataPath = app.getPath('userData')
  const dbDir = join(userDataPath, 'data')

  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true })
  }

  const dbPath = join(dbDir, APP_DEFAULTS.DB_FILENAME)

  db = new Database(dbPath)

  // ── SQLite configuration ──
  db.pragma('journal_mode = WAL')
  db.pragma('synchronous = FULL')
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 5000')
  db.pragma('cache_size = -64000') // 64MB page cache
  db.pragma('wal_autocheckpoint = 1000') // Auto-checkpoint when WAL reaches ~4MB (1000 pages)

  console.log(`[DB] Opened database at ${dbPath}`)

  // ── Migrations tracking table ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      version     INTEGER NOT NULL UNIQUE,
      name        TEXT    NOT NULL,
      applied_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `)

  // ── Run pending migrations ──
  runMigrations()
}

/**
 * Run all pending migrations in version order, each inside a transaction.
 * If any migration fails, the transaction rolls back and the error propagates.
 */
function runMigrations(): void {
  const database = getDatabase()

  // Get already-applied versions
  const applied = new Set<number>(
    (
      database
        .prepare('SELECT version FROM _migrations ORDER BY version')
        .all() as Array<{ version: number }>
    ).map((row) => row.version)
  )

  // Filter and sort pending migrations
  const pending = migrations
    .filter((m) => !applied.has(m.version))
    .sort((a, b) => a.version - b.version)

  for (const migration of pending) {
    const runOne = database.transaction(() => {
      database.exec(migration.sql)
      database
        .prepare('INSERT INTO _migrations (version, name) VALUES (?, ?)')
        .run(migration.version, migration.name)
    })

    try {
      runOne()
      console.log(`[DB] ✓ Migration ${migration.version}: ${migration.name}`)
    } catch (error) {
      console.error(
        `[DB] ✗ Migration ${migration.version}: ${migration.name} FAILED`,
        error
      )
      throw error // Abort startup on migration failure
    }
  }

  if (pending.length === 0) {
    console.log('[DB] All migrations up to date')
  } else {
    console.log(`[DB] Applied ${pending.length} migration(s)`)
  }
}

let isDraining = false

export function isDatabaseDraining(): boolean {
  return isDraining
}

/**
 * Drains active transactions, checkpoints WAL, and safely closes the database connection.
 */
export async function drainAndCloseDatabase(timeoutMs = 5000): Promise<void> {
  if (!db) return
  isDraining = true

  const startTime = Date.now()
  // Wait for any in-flight transaction to finish
  while (db && db.inTransaction && (Date.now() - startTime) < timeoutMs) {
    await new Promise(resolve => setTimeout(resolve, 50))
  }

  if (db) {
    try {
      // Force WAL checkpoint to flush all data before closing
      db.pragma('wal_checkpoint(TRUNCATE)')
    } catch (e) {
      console.warn('[DB] WAL checkpoint during drain warning:', e)
    }

    try {
      db.close()
      console.log('[DB] Connection drained and closed cleanly')
    } catch (err: any) {
      console.error('[DB] Error during db.close():', err)
    } finally {
      db = null
      isDraining = false
    }
  }
}

/**
 * Close the database connection gracefully.
 * Called on app quit.
 */
export function closeDatabase(): void {
  if (db) {
    try {
      db.close()
    } catch (err) {
      console.error('[DB] Error closing database:', err)
    }
    db = null
    console.log('[DB] Connection closed')
  }
}

/**
 * Get the path to the active database file.
 * Useful for backup service.
 */
export function getDatabasePath(): string {
  const userDataPath = app.getPath('userData')
  return join(userDataPath, 'data', APP_DEFAULTS.DB_FILENAME)
}
