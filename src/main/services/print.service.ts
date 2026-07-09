import { ipcMain, BrowserWindow, screen } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'

/**
 * Shows a print preview window with the receipt content.
 * The cashier sees exactly what will be printed and clicks "Print" or "Cancel".
 * Uses console-message bridge to communicate button clicks without a preload script.
 */
export async function printHtmlSilently(htmlContent: string, printerName?: string): Promise<boolean> {
  return new Promise((resolve) => {
    const primaryDisplay = screen.getPrimaryDisplay()
    const { width: screenW, height: screenH } = primaryDisplay.workAreaSize

    // Preview window sized to approximate 80mm thermal receipt width
    const previewWidth = 380
    const previewHeight = Math.min(screenH - 100, 780)

    const previewWindow = new BrowserWindow({
      width: previewWidth,
      height: previewHeight,
      x: Math.round((screenW - previewWidth) / 2),
      y: Math.round((screenH - previewHeight) / 2),
      show: false,
      resizable: true,
      minimizable: false,
      maximizable: false,
      alwaysOnTop: true,
      title: 'Print Preview',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    })

    // Wrap the receipt HTML with a floating preview toolbar
    const wrappedHtml = wrapWithPreviewToolbar(htmlContent)
    const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(wrappedHtml)
    previewWindow.loadURL(dataUrl)

    let resolved = false

    // Listen for button clicks via console.log messages from the injected JS
    previewWindow.webContents.on('console-message', (_event, _level, message) => {
      if (resolved) return

      if (message === '__PREVIEW_PRINT__') {
        resolved = true
        // Now actually print — silently, since the user already confirmed via preview
        previewWindow.webContents.print({
          silent: true,
          printBackground: true,
          deviceName: printerName,
          margins: { marginType: 'none' }
        }, (success, errorType) => {
          previewWindow.close()
          if (!success) {
            console.error(`Print failed: ${errorType}`)
          }
          resolve(success)
        })
      } else if (message === '__PREVIEW_CANCEL__') {
        resolved = true
        previewWindow.close()
        resolve(false)
      }
    })

    // If the user closes the window via the X button, treat it as cancel
    previewWindow.on('closed', () => {
      if (!resolved) {
        resolved = true
        resolve(false)
      }
    })

    previewWindow.webContents.on('did-finish-load', () => {
      previewWindow.show()
      previewWindow.focus()
    })
  })
}

/**
 * Wraps the receipt HTML with a sticky preview toolbar and injects
 * button handlers that communicate back via console.log.
 */
function wrapWithPreviewToolbar(receiptHtml: string): string {
  // Extract everything between <body> tags if present
  const bodyMatch = receiptHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i)
  const bodyContent = bodyMatch ? bodyMatch[1] : receiptHtml
  const headMatch = receiptHtml.match(/<head[^>]*>([\s\S]*)<\/head>/i)
  const headContent = headMatch ? headMatch[1] : ''

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  ${headContent}
  <style>
    /* Preview toolbar — hidden during actual printing */
    @media print {
      .preview-toolbar { display: none !important; }
      body { padding-top: 0 !important; }
    }

    .preview-toolbar {
      position: sticky;
      top: 0;
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 12px 16px;
      background: #1a1a2e;
      border-bottom: 2px solid #16213e;
      box-shadow: 0 2px 12px rgba(0,0,0,0.3);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }

    .preview-toolbar .preview-label {
      color: #a0a0b8;
      font-size: 12px;
      font-weight: 500;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin-right: auto;
    }

    .preview-toolbar button {
      padding: 8px 24px;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .preview-toolbar .btn-print {
      background: #4ade80;
      color: #052e16;
    }
    .preview-toolbar .btn-print:hover {
      background: #22c55e;
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(74,222,128,0.4);
    }
    .preview-toolbar .btn-print:active { transform: translateY(0); }

    .preview-toolbar .btn-cancel {
      background: #334155;
      color: #cbd5e1;
    }
    .preview-toolbar .btn-cancel:hover {
      background: #475569;
    }

    .preview-toolbar .shortcut-hint {
      font-size: 10px;
      color: #64748b;
      margin-top: 2px;
    }
  </style>
</head>
<body style="margin: 0; background: #f1f5f9;">
  <div class="preview-toolbar">
    <span class="preview-label">🖨️ Print Preview</span>
    <button class="btn-cancel" id="cancelBtn">Cancel</button>
    <button class="btn-print" id="printBtn">✓ Print</button>
  </div>

  <div style="background: #fff; max-width: 80mm; margin: 16px auto; padding: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.1); border-radius: 4px;">
    ${bodyContent}
  </div>

  <script>
    document.getElementById('printBtn').addEventListener('click', function() {
      console.log('__PREVIEW_PRINT__');
      this.disabled = true;
      this.textContent = 'Printing...';
    });
    document.getElementById('cancelBtn').addEventListener('click', function() {
      console.log('__PREVIEW_CANCEL__');
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('printBtn').click();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        document.getElementById('cancelBtn').click();
      }
    });
  </script>
</body>
</html>`
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

import Handlebars from 'handlebars'
import { formatPaise } from '../../shared/utils/paise'

// Register Handlebars helpers
Handlebars.registerHelper('formatPaise', function (amount) {
  return formatPaise(amount).replace('₹', '')
})
Handlebars.registerHelper('formatPaiseWithSymbol', function (amount) {
  return formatPaise(amount)
})
Handlebars.registerHelper('currentDate', function () {
  return new Date().toLocaleString()
})

Handlebars.registerHelper('calcDiscPct', function (mrpPaise, discountPaise) {
  if (!mrpPaise || mrpPaise === 0 || !discountPaise) return '0.0'
  const pct = (discountPaise / mrpPaise) * 100
  return pct.toFixed(1)
})

// Helper to show the original pack/strip price (unit price × packSize)
Handlebars.registerHelper('packMrp', function(unitPaise, packSize) {
  const total = (unitPaise || 0) * (packSize || 1)
  return formatPaise(total).replace('₹', '')
})

const DEFAULT_RECEIPT_TEMPLATE = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @page { margin: 0; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      line-height: 1.2;
      width: 80mm;
      margin: 0 auto;
      padding: 10px;
      color: #000;
      background: #fff;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .text-left { text-align: left; }
    .bold { font-weight: bold; }
    .border-b { border-bottom: 1px dashed #000; padding-bottom: 5px; margin-bottom: 5px; }
    .border-t { border-top: 1px dashed #000; padding-top: 5px; margin-top: 5px; }
    .border-double { border-top: 3px double #000; border-bottom: 3px double #000; padding: 5px 0; margin: 5px 0; }
    
    table { width: 100%; border-collapse: collapse; margin: 5px 0; }
    th, td { padding: 2px 0; vertical-align: top; }
    
    .item-row { margin-bottom: 5px; }
    .item-details { display: flex; justify-content: space-between; font-size: 10px; }
    
    .footer { margin-top: 10px; font-size: 10px; }
  </style>
</head>
<body>
  <div class="text-center border-double">
    <div class="bold" style="font-size: 16px;">SHIV SHAKTI MEDICAL STORES</div>
  </div>

  <div style="font-size: 11px; margin-bottom: 5px;">
    <table style="margin: 0;">
      <tr>
        <td>Bill: {{sale.billNumber}}</td>
        <td class="text-right">Date: {{currentDate}}</td>
      </tr>
      <tr>
        <td colspan="2">Pay Mode: {{sale.paymentMode}}</td>
      </tr>
    </table>
    {{#if sale.patientName}}<div>Pt: {{sale.patientName}} {{#if sale.patientPhone}}({{sale.patientPhone}}){{/if}}</div>{{/if}}
    {{#if sale.doctorName}}<div>Dr: {{sale.doctorName}} {{#if sale.doctorRegNo}}[{{sale.doctorRegNo}}]{{/if}}</div>{{/if}}
  </div>

  <div class="border-t border-b">
    <table style="font-size: 11px; text-align: left;">
      <tr>
        <th width="45%">Item Name</th>
        <th width="15%" class="text-center">Qty</th>
        <th width="20%" class="text-right">Rate</th>
        <th width="20%" class="text-right">Amount</th>
      </tr>
    </table>
  </div>
  
  <table style="font-size: 11px;">
    {{#each items}}
      <tr>
        <td width="45%" class="bold">{{@index}}. {{this.brandName}}</td>
        <td width="15%" class="text-center">{{this.quantityUnits}}</td>
        <td width="20%" class="text-right">{{packMrp this.salePricePaise this.packSize}}</td>
        <td width="20%" class="text-right">{{formatPaise this.gstBreakdown.lineTotalPaise}}</td>
      </tr>
      <tr>
        <td colspan="4" style="font-size: 10px; padding-bottom: 5px;" class="text-muted-foreground">
          &nbsp;&nbsp;&nbsp;MRP: {{packMrp this.mrpPaise this.packSize}} | Disc: {{calcDiscPct this.mrpPaise this.discountPaise}}% | GST: {{this.gstRatePct}}%
        </td>
      </tr>
    {{/each}}
  </table>

  <div class="border-t border-b" style="padding: 2px 0;">
    Total Items: {{items.length}}
  </div>

  <div>
    <table style="width: 100%;">
      <tr>
        <td>Subtotal:</td>
        <td class="text-right">{{formatPaiseWithSymbol sale.subtotalPaise}}</td>
      </tr>
      <tr>
        <td>Total Tax (CGST + SGST):</td>
        <td class="text-right">{{formatPaiseWithSymbol sale.totalTaxPaise}}</td>
      </tr>
    </table>
  </div>

  <div class="border-t border-b" style="padding: 2px 0;">
    <table style="width: 100%;">
      <tr class="bold" style="font-size: 14px;">
        <td>GRAND TOTAL:</td>
        <td class="text-right">{{formatPaiseWithSymbol sale.grandTotalPaise}}</td>
      </tr>
    </table>
  </div>

  {{#if sale.totalDiscountPaise}}
  <div class="border-double text-center bold" style="font-size: 12px; margin-top: 5px;">
    You Saved {{formatPaiseWithSymbol sale.totalDiscountPaise}} on this bill!
  </div>
  {{/if}}

  <div class="text-center footer">
    <div>* Schedule H/H1/X drugs must be sold on prescription only *</div>
    <div style="margin-top: 5px;">Thank you for your visit!</div>
  </div>
</body>
</html>
`

export function registerPrintHandlers() {
  ipcMain.handle(IPC_CHANNELS.PRINT_RECEIPT, async (_, saleData: any, itemsData: any[]) => {
    try {
      const documentsPath = app.getPath('documents')
      const templatePath = path.join(documentsPath, 'MedStore', 'Templates', 'receipt.hbs')

      let templateStr = DEFAULT_RECEIPT_TEMPLATE
      if (fs.existsSync(templatePath)) {
        templateStr = fs.readFileSync(templatePath, 'utf8')
      }

      const template = Handlebars.compile(templateStr)
      const html = template({ sale: saleData, items: itemsData })

      // Save PDF copy silently
      const pdfFilename = `Receipts/${saleData.billNumber}.pdf`
      generatePdf(html, pdfFilename).catch(e => console.error("Failed to save PDF receipt:", e))

      // Print HTML silently to thermal printer
      return await printHtmlSilently(html)
    } catch (err: any) {
      console.error("Error generating receipt:", err)
      throw err
    }
  })

  ipcMain.handle(IPC_CHANNELS.PRINT_PDF, async (_, htmlContent: string, filename: string) => {
    return generatePdf(htmlContent, filename)
  })
}
