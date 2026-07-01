import { ipcMain, BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'

/**
 * Prints HTML content silently to the default printer (usually a thermal printer).
 */
export async function printHtmlSilently(htmlContent: string, printerName?: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    // Create a hidden window to render the HTML
    const printWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    })

    // Load the HTML content directly
    const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent)
    printWindow.loadURL(dataUrl)

    printWindow.webContents.on('did-finish-load', () => {
      printWindow.webContents.print({
        silent: true,
        printBackground: true,
        deviceName: printerName, // If undefined, prints to system default
        margins: { marginType: 'none' }
      }, (success, errorType) => {
        printWindow.close()
        if (!success) {
          console.error(`Print failed: ${errorType}`)
          resolve(false)
        } else {
          resolve(true)
        }
      })
    })
  })
}

/**
 * Generates an A4 PDF from HTML content (useful for reports / A4 invoices).
 */
export async function generatePdf(htmlContent: string, outputFilename: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const printWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    })

    const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent)
    printWindow.loadURL(dataUrl)

    printWindow.webContents.on('did-finish-load', async () => {
      try {
        const pdfData = await printWindow.webContents.printToPDF({
          printBackground: true,
          pageSize: 'A4',
          margins: { marginType: 'default' }
        })

        const documentsPath = app.getPath('documents')
        const fullPath = path.join(documentsPath, 'MedStore', outputFilename)
        
        // Ensure MedStore directory exists
        const dir = path.dirname(fullPath)
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true })
        }

        fs.writeFileSync(fullPath, pdfData)
        printWindow.close()
        resolve(fullPath)
      } catch (err: any) {
        printWindow.close()
        reject(err)
      }
    })
  })
}

export function registerPrintHandlers() {
  ipcMain.handle(IPC_CHANNELS.PRINT_RECEIPT, async (_, htmlContent: string) => {
    return printHtmlSilently(htmlContent)
  })

  ipcMain.handle(IPC_CHANNELS.PRINT_PDF, async (_, htmlContent: string, filename: string) => {
    return generatePdf(htmlContent, filename)
  })
}
