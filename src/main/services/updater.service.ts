import { autoUpdater } from 'electron-updater'
import { ipcMain, BrowserWindow } from 'electron'

export function initAutoUpdater(mainWindow: BrowserWindow) {
  // Disable auto-download if you want user consent first, or leave true for silent background download
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  // Check for updates on startup (after 5 seconds to let UI load)
  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify().catch((err) => {
      console.error('Failed to check for updates:', err)
    })
  }, 5000)

  // Log & IPC Events for Renderer UI feedback
  autoUpdater.on('update-available', (info) => {
    mainWindow.webContents.send('updater:status', { status: 'available', version: info.version })
  })

  autoUpdater.on('download-progress', (progressObj) => {
    mainWindow.webContents.send('updater:status', { 
      status: 'downloading', 
      percent: Math.round(progressObj.percent) 
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    mainWindow.webContents.send('updater:status', { status: 'ready', version: info.version })
  })

  // Handle user clicking "Restart & Update Now" button from UI
  ipcMain.handle('updater:quitAndInstall', () => {
    autoUpdater.quitAndInstall()
  })
}
