import { ipcMain, app } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import { join } from 'path'
import { Worker } from 'worker_threads'
import { APP_DEFAULTS } from '../../shared/constants'

// Note: In production (packaged electron app), workers need to be compiled.
const isProd = app.isPackaged
const workerPath = isProd
  ? join(process.resourcesPath, 'app.asar', 'out', 'main', 'reports.worker.js')
  : join(__dirname, 'reports.worker.js')

const scheduleRegisterWorkerPath = isProd
  ? join(process.resourcesPath, 'app.asar', 'out', 'main', 'schedule-register.worker.js')
  : join(__dirname, 'schedule-register.worker.js')

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

export function getScheduleRegister(startDate: string, endDate: string): Promise<{ data: any[], csvContent: string }> {
  return new Promise((resolve, reject) => {
    const dbDir = app.getPath('userData')
    const dbPath = join(dbDir, 'data', APP_DEFAULTS.DB_FILENAME)

    const worker = new Worker(scheduleRegisterWorkerPath, {
      workerData: { dbPath, startDate, endDate }
    })

    worker.on('message', (msg) => {
      if (msg.success) {
        resolve(msg)
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
  
  ipcMain.handle(IPC_CHANNELS.REPORTS_SCHEDULE_REGISTER, async (_, startDate: string, endDate: string) => {
    return await getScheduleRegister(startDate, endDate)
  })
}
