import { parentPort, workerData } from 'worker_threads'
import Database from 'better-sqlite3'

const { dbPath, backupPath } = workerData as { dbPath: string, backupPath: string }

try {
  // 1. Open a read-write connection to the active database.
  //    Read-write is required for PRAGMA wal_checkpoint(FULL) to function.
  //    fileMustExist: true ensures we don't accidentally create an empty DB if the path is wrong.
  const db = new Database(dbPath, { fileMustExist: true })

  // 2. Force a FULL WAL checkpoint: flushes 100% of uncommitted WAL transactions
  //    directly into the main .db file on disk BEFORE taking the snapshot.
  //    This guarantees the backup is 100% consistent even if a cashier is actively
  //    scanning invoices or billing customers at the moment the backup fires.
  db.pragma('wal_checkpoint(FULL)')

  // 3. Incremental vacuum: defragments SQLite database pages and reclaims unused disk space.
  try {
    db.pragma('incremental_vacuum')
  } catch (e) {
    // Non-fatal if auto_vacuum is not yet set
  }

  // 3. Use the SQLite Online Backup API natively provided by better-sqlite3.
  //    This safely locks pages and creates a clean snapshot without blocking the main DB.
  db.backup(backupPath)
    .then(() => {
      db.close()
      parentPort?.postMessage({ success: true, backupPath })
    })
    .catch((err: any) => {
      db.close()
      parentPort?.postMessage({ success: false, error: err.message })
    })
} catch (error: any) {
  parentPort?.postMessage({ success: false, error: error.message })
}
