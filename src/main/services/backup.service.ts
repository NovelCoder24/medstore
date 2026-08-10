import { app, ipcMain } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, copyFileSync, unlinkSync, renameSync, readdirSync, statSync } from 'fs'
import { Worker } from 'worker_threads'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import { getDatabase, closeDatabase } from './db.service'
import { APP_DEFAULTS } from '../../shared/constants'
import Database from 'better-sqlite3'

export async function createBackup(): Promise<string> {
  const userDataPath = app.getPath('userData')
  const dbDir = join(userDataPath, 'data')
  const activeDbPath = join(dbDir, APP_DEFAULTS.DB_FILENAME)

  // Configure backup directory (e.g. in Documents)
  const backupDir = join(app.getPath('documents'), 'medstore-backups')
  if (!existsSync(backupDir)) {
    mkdirSync(backupDir, { recursive: true })
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 15)
  const backupFilename = `medstore_backup_${timestamp}.db`
  const backupPath = join(backupDir, backupFilename)

  return new Promise((resolve, reject) => {
    // 1. Resolve path to the compiled worker file
    // In production, electron-vite puts main worker chunks alongside index.js in out/main/
    const workerPath = app.isPackaged
      ? join(process.resourcesPath, 'app.asar', 'out', 'main', 'backup.worker.js')
      : join(__dirname, 'backup.worker.js')

    const worker = new Worker(workerPath, {
      workerData: { dbPath: activeDbPath, backupPath }
    })

    worker.on('message', (msg) => {
      if (msg.success) {
        // Manage retention (keep 30 backups)
        try {
          const backups = readdirSync(backupDir)
            .filter(f => f.endsWith('.db'))
            .map(f => ({ name: f, path: join(backupDir, f), time: statSync(join(backupDir, f)).birthtimeMs }))
            .sort((a, b) => b.time - a.time)
          
          if (backups.length > 30) {
            const toDelete = backups.slice(30)
            toDelete.forEach(file => {
              try { unlinkSync(file.path) } catch(e) {}
            })
          }
        } catch (e) {
          console.error('Failed to cleanup old backups', e)
        }
        resolve(msg.backupPath)
      } else {
        reject(new Error(msg.error))
      }
    })

    worker.on('error', reject)
    worker.on('exit', (code) => {
      if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`))
    })
  })
}

export async function restoreBackup(backupFilePath: string): Promise<void> {
  // 1. Verify integrity of backup file FIRST (in a read-only instance)
  try {
    const backupDb = new Database(backupFilePath, { readonly: true })
    const integrity = backupDb.pragma('integrity_check', { simple: true }) as { integrity_check: string }
    backupDb.close()
    if (integrity.integrity_check !== 'ok') {
      throw new Error('Backup file is corrupted (integrity_check failed).')
    }
  } catch (error: any) {
    throw new Error(`Failed to verify backup: ${error.message}`)
  }

  // 2. Prepare paths
  const userDataPath = app.getPath('userData')
  const dbDir = join(userDataPath, 'data')
  const activeDbPath = join(dbDir, APP_DEFAULTS.DB_FILENAME)
  const walPath = `${activeDbPath}-wal`
  const shmPath = `${activeDbPath}-shm`
  const corruptedDbPath = join(dbDir, `medstore_corrupted_${Date.now()}.db`)

  // 3. Close active database
  closeDatabase()

  // 4. Wait for OS file locks to release
  await new Promise(resolve => setTimeout(resolve, 150))

  // 5. Explicitly delete WAL and SHM files to prevent SQLite from applying old WAL to new DB
  try {
    if (existsSync(walPath)) unlinkSync(walPath)
    if (existsSync(shmPath)) unlinkSync(shmPath)
  } catch (err) {
    console.error('Failed to delete WAL/SHM files', err)
  }

  // 6. Rename active DB to a safe fallback
  try {
    if (existsSync(activeDbPath)) {
      renameSync(activeDbPath, corruptedDbPath)
    }
  } catch (err: any) {
    throw new Error(`Failed to rename active DB. Windows lock might still be active. ${err.message}`)
  }

  // 7. Copy backup file to active path
  try {
    copyFileSync(backupFilePath, activeDbPath)
  } catch (err: any) {
    // Attempt rollback if copy fails
    if (existsSync(corruptedDbPath)) {
      renameSync(corruptedDbPath, activeDbPath)
    }
    throw new Error(`Failed to copy backup file: ${err.message}`)
  }

  // 8. Relaunch
  app.relaunch()
  app.exit(0)
}

export function listBackups(): { name: string, path: string, size: number, createdAt: string }[] {
  const backupDir = join(app.getPath('documents'), 'medstore-backups')
  if (!existsSync(backupDir)) return []

  return readdirSync(backupDir)
    .filter(file => file.endsWith('.db'))
    .map(file => {
      const fullPath = join(backupDir, file)
      const stats = statSync(fullPath)
      return {
        name: file,
        path: fullPath,
        size: stats.size,
        createdAt: stats.birthtime.toISOString()
      }
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export function registerBackupHandlers() {
  ipcMain.handle(IPC_CHANNELS.BACKUP_CREATE, async () => {
    return await createBackup()
  })

  ipcMain.handle(IPC_CHANNELS.BACKUP_RESTORE, async (_, backupPath: string) => {
    return await restoreBackup(backupPath)
  })

  ipcMain.handle(IPC_CHANNELS.BACKUP_LIST, () => {
    return listBackups()
  })
}

let backupInterval: NodeJS.Timeout | null = null

/**
 * Prune OCR invoice image archives older than 180 days.
 * The structured invoice data in SQLite (purchase_invoices, purchase_items, vendor_ledger)
 * is NEVER deleted — only the heavy raw JPEG/PDF image files are purged to reclaim disk space.
 * 180 days covers standard distributor audit windows in India.
 */
function pruneOldInvoiceImages(): number {
  const userDataPath = app.getPath('userData')
  const invoicesDir = join(userDataPath, 'invoices')

  if (!existsSync(invoicesDir)) return 0

  const RETENTION_MS = 180 * 24 * 60 * 60 * 1000 // 180 days in milliseconds
  const cutoffTime = Date.now() - RETENTION_MS
  let pruned = 0

  try {
    const files = readdirSync(invoicesDir)
    for (const file of files) {
      const filePath = join(invoicesDir, file)
      try {
        const stats = statSync(filePath)
        if (stats.isFile() && stats.birthtimeMs < cutoffTime) {
          unlinkSync(filePath)
          pruned++
        }
      } catch (e) {
        // Skip files that can't be stat'd or deleted (locked, permissions, etc.)
      }
    }
  } catch (e) {
    console.error('[Backup] Failed to scan invoices directory for pruning:', e)
  }

  return pruned
}

export function startScheduledBackups() {
  if (backupInterval) clearInterval(backupInterval)
  
  // Run every 2 hours (2 * 60 * 60 * 1000)
  const TWO_HOURS_MS = 2 * 60 * 60 * 1000
  backupInterval = setInterval(async () => {
    console.log('Running scheduled background backup...')
    try {
      await createBackup()
      console.log('Scheduled backup completed successfully.')

      // After successful backup, prune old OCR invoice images (>180 days)
      const pruned = pruneOldInvoiceImages()
      if (pruned > 0) {
        console.log(`[Backup] Pruned ${pruned} OCR invoice image(s) older than 180 days.`)
      }
    } catch (error) {
      console.error('Scheduled backup failed:', error)
    }
  }, TWO_HOURS_MS)
}

