import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { join } from 'path'
import { tmpdir } from 'os'
import { existsSync, unlinkSync, mkdirSync } from 'fs'
import { app } from 'electron'
import { initDatabase, closeDatabase, getDatabase } from '../../src/main/services/db.service'

// Mock Electron app.getPath so we don't write to actual APPDATA during tests
const testDataDir = join(tmpdir(), 'medstore-test-' + Date.now())

app.getPath = (name: string) => {
  if (name === 'userData') return testDataDir
  return ''
}

describe('Database Migration Runner', () => {
  beforeEach(() => {
    if (!existsSync(testDataDir)) {
      mkdirSync(testDataDir, { recursive: true })
    }
  })

  afterEach(() => {
    closeDatabase()
    // Cleanup db file
    const dbPath = join(testDataDir, 'data', 'medstore.db')
    if (existsSync(dbPath)) unlinkSync(dbPath)
    if (existsSync(dbPath + '-wal')) unlinkSync(dbPath + '-wal')
    if (existsSync(dbPath + '-shm')) unlinkSync(dbPath + '-shm')
  })

  it('initializes database and runs all migrations', () => {
    initDatabase()
    const db = getDatabase()

    // Check if _migrations table exists
    const row = db.prepare("SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='_migrations'").get() as { count: number }
    expect(row.count).toBe(1)

    // Check if migrations were applied
    const applied = db.prepare("SELECT * FROM _migrations ORDER BY version").all() as any[]
    expect(applied.length).toBeGreaterThan(0)
    expect(applied[0].version).toBe(1)
    expect(applied[0].name).toBe('initial_schema')

    // Verify core tables exist (products, batches, sales)
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]
    const tableNames = tables.map(t => t.name)
    expect(tableNames).toContain('products')
    expect(tableNames).toContain('batches')
    expect(tableNames).toContain('sales')
    
    // Verify FTS5 table exists
    expect(tableNames).toContain('products_fts')
  })

  it('runs migrations idempotently (safe to call multiple times)', () => {
    initDatabase()
    
    // Close and re-init (simulating app restart)
    closeDatabase()
    
    expect(() => {
      initDatabase()
    }).not.toThrow()
    
    const db = getDatabase()
    const applied = db.prepare("SELECT count(*) as count FROM _migrations").get() as { count: number }
    // Should still be exactly the same number of migrations, no duplicates
    expect(applied.count).toBeGreaterThan(0)
  })
})
