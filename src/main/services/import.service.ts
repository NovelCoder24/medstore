import { Worker } from 'worker_threads'
import { join } from 'path'
import { ipcMain, app } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import { APP_DEFAULTS } from '../../shared/constants'

// Note: In production (packaged electron app), workers need to be compiled.
// electron-vite handles this if we configure it, but generally we spawn from the build output.
// The exact path depends on how electron-vite outputs workers.
// Often it's placed in `out/main/workers/import.worker.js`.
const isProd = app.isPackaged
const workerPath = isProd
  ? join(process.resourcesPath, 'app.asar', 'out', 'main', 'workers', 'import.worker.js')
  : join(__dirname, 'workers', 'import.worker.js')

export function runCsvImport(csvPath: string, onProgress: (data: any) => void): Promise<any> {
  return new Promise((resolve, reject) => {
    const dbDir = app.getPath('userData')
    const dbPath = join(dbDir, APP_DEFAULTS.DB_FILENAME)

    const worker = new Worker(workerPath, {
      workerData: {
        dbPath,
        csvPath
      }
    })

    worker.on('message', (msg) => {
      if (msg.type === 'progress') {
        onProgress(msg)
      } else if (msg.type === 'complete') {
        resolve(msg.result)
      } else if (msg.type === 'error') {
        reject(new Error(msg.error))
      }
    })

    worker.on('error', (err) => {
      reject(err)
    })

    worker.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Worker stopped with exit code ${code}`))
      }
    })
  })
}

export function registerImportHandlers() {
  ipcMain.handle(IPC_CHANNELS.IMPORT_CSV, async (event, csvPath: string) => {
    try {
      const result = await runCsvImport(csvPath, (progressMsg) => {
        // Send progress events back to the specific renderer that invoked it
        event.sender.send(IPC_CHANNELS.IMPORT_PROGRESS, progressMsg)
      })
      return result
    } catch (err: any) {
      throw new Error(`Import failed: ${err.message}`)
    }
  })
}
