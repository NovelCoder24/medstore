import { parentPort, workerData } from 'worker_threads'
import Database from 'better-sqlite3'

const { dbPath, backupPath } = workerData as { dbPath: string, backupPath: string }

try {
  // 1. Open a fresh read-only connection to the active database
  // fileMustExist: true ensures we don't accidentally create an empty DB if the path is wrong
  const db = new Database(dbPath, { readonly: true, fileMustExist: true })
  
  // 2. Use the SQLite Online Backup API natively provided by better-sqlite3.
  // This safely locks pages and handles WAL without fully blocking the main DB.
  db.backup(backupPath)
    .then(() => {
      // 3. Close the read-only connection
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
