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

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
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
  electronApp.setAppUserModelId('com.medstore.pos')

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

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  closeDatabase()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
