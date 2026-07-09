import { ipcMain, app } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import { join } from 'path'
import { Worker } from 'worker_threads'
import { APP_DEFAULTS } from '../../shared/constants'

// Note: In production (packaged electron app), workers need to be compiled.
const isProd = app.isPackaged
const workerPath = isProd
  ? join(process.resourcesPath, 'app.asar', 'out', 'main', 'workers', 'reports.worker.js')
  : join(__dirname, 'workers', 'reports.worker.js')

export function getGSTR1(month: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const dbDir = app.getPath('userData')
    const dbPath = join(dbDir, 'data', APP_DEFAULTS.DB_FILENAME)

    const worker = new Worker(workerPath, {
      workerData: { dbPath, month }
    })

    worker.on('message', (msg) => {
      if (msg.success) {
        resolve(msg.csvContent)
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

export function registerReportsHandlers() {
  ipcMain.handle(IPC_CHANNELS.REPORTS_GSTR1, async (_, month: string) => {
    return await getGSTR1(month)
  })
}
