import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { initDatabase, closeDatabase } from './services/db.service'
import { registerUserHandlers } from './services/user.service'
import { registerVendorHandlers } from './services/vendor.service'
import { registerCompositionHandlers } from './services/composition.service'
import { registerProductHandlers } from './services/product.service'
import { registerImportHandlers } from './services/import.service'
import { registerSalesHandlers } from './services/sales.service'
import { registerPurchaseHandlers } from './services/purchase.service'
import { registerPrintHandlers } from './services/print.service'
import { registerOcrHandlers } from './services/ocr.service'
import { registerAnalyticsHandlers } from './services/analytics.service'
import { registerSettingsHandlers } from './services/settings.service'
import { registerAuditHandlers } from './services/audit.service'
import { registerBackupHandlers, createBackup, startScheduledBackups } from './services/backup.service'
import { registerCustomerHandlers } from './services/customer.service'
import { registerReportsHandlers } from './services/reports.service'
import { initAutoUpdater } from './services/updater.service'

function createWindow(): void {
  console.log("=== MedStore Documents Path: ===", app.getPath('documents'))
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    show: false,
    autoHideMenuBar: true,
    icon: join(__dirname, '../../icon.ico'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      devTools: is.dev
    }
  }) 
  // mainWindow.webContents.openDevTools()

  // Initialize auto updater
  initAutoUpdater(mainWindow)

  mainWindow.on('ready-to-show', () => {
    mainWindow.maximize()
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.medstore')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Initialize Database
  try {
    initDatabase()
    registerUserHandlers()
    registerVendorHandlers()
    registerCompositionHandlers()
    registerProductHandlers()
    registerImportHandlers()
    registerSalesHandlers()
    registerPurchaseHandlers()
    registerPrintHandlers()
    registerOcrHandlers()
    registerAnalyticsHandlers()
    registerSettingsHandlers()
    registerAuditHandlers()
    registerBackupHandlers()
    startScheduledBackups()
    registerCustomerHandlers()
    registerReportsHandlers()
  } catch (error) {
    console.error('Failed to initialize database:', error)
    app.quit()
    return
  }

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

let isBackingUp = false

app.on('before-quit', async (event) => {
  if (isBackingUp) {
    event.preventDefault()
    return
  }

  // Prevent immediate quit to allow backup
  event.preventDefault()
  isBackingUp = true

  console.log('Running automated backup before quit...')
  try {
    await createBackup()
    console.log('Automated backup completed successfully.')
  } catch (error) {
    console.error('Automated backup failed:', error)
  }

  closeDatabase()
  app.exit(0)
})

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
