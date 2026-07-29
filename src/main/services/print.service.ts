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
  <title>Print Preview</title>
  ${headContent}
  <style>
    /* Hide toolbar during actual physical printer job */
    @media print {
      .preview-toolbar-container { display: none !important; }
      body { padding: 0 !important; background: #fff !important; overflow: visible !important; }
      .paper-preview { box-shadow: none !important; margin: 0 !important; padding: 0 !important; border: none !important; }
    }

    * { box-sizing: border-box; }

    html, body {
      margin: 0;
      padding: 0;
      background: #0f172a;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      height: 100vh;
      overflow: hidden !important; /* Scrollbars disabled */
      scrollbar-width: none !important;
      -ms-overflow-style: none !important;
    }
    ::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }

    .preview-layout {
      display: flex;
      flex-direction: column;
      height: 100vh;
    }

    .preview-toolbar-container {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: flex-end; /* Only two action buttons */
      gap: 12px;
      padding: 10px 16px;
      background: #1e293b;
      border-bottom: 1px solid #334155;
    }

    .btn-action {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 18px;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .btn-cancel {
      background: #334155;
      color: #cbd5e1;
    }
    .btn-cancel:hover {
      background: #475569;
      color: #ffffff;
    }

    .btn-print {
      background: #10b981;
      color: #ffffff;
    }
    .btn-print:hover {
      background: #059669;
    }

    .paper-viewport {
      flex: 1;
      padding: 16px;
      overflow-y: auto;
      overflow-x: hidden;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      scrollbar-width: none;
    }

    .paper-preview {
      background: #ffffff;
      width: 80mm;
      padding: 12px;
      border-radius: 4px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    }
  </style>
</head>
<body>
  <div class="preview-layout">
    <div class="preview-toolbar-container">
      <button class="btn-action btn-cancel" id="cancelBtn">Cancel</button>
      <button class="btn-action btn-print" id="printBtn">✓ Print</button>
    </div>

    <div class="paper-viewport">
      <div class="paper-preview">
        ${bodyContent}
      </div>
    </div>
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
export async function generatePdf(htmlContent: string, outputFilename: string, printOptions: any = {}): Promise<string> {
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
          margins: { marginType: 'default' },
          ...printOptions
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
import { getStoreHeaderSettings } from './settings.service'

// Register Handlebars helpers
Handlebars.registerHelper('formatPaise', function (amount) {
  return formatPaise(amount).replace('₹', '')
})
Handlebars.registerHelper('formatPaiseWithSymbol', function (amount) {
  return formatPaise(amount)
})
Handlebars.registerHelper('currentDate', function () {
  const d = new Date()
  const day = d.getDate().toString().padStart(2, '0')
  const month = (d.getMonth() + 1).toString().padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
})
Handlebars.registerHelper('currentTime', function () {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
})
Handlebars.registerHelper('calcTotalQty', function (items) {
  if (!Array.isArray(items)) return 0
  return items.reduce((sum, i) => sum + (i.quantityUnits || 0), 0)
})
Handlebars.registerHelper('calcTaxableVal', function (sale) {
  const grandTotal = sale.grandTotalPaise || 0
  const tax = sale.totalTaxPaise || 0
  return formatPaise(grandTotal - tax).replace('₹', '')
})
Handlebars.registerHelper('calcHalfTax', function (totalTaxPaise) {
  const half = Math.round((totalTaxPaise || 0) / 2)
  return formatPaise(half).replace('₹', '')
})
Handlebars.registerHelper('calcDiscPct', function (mrpPaise, discountPaise) {
  if (!mrpPaise || mrpPaise === 0 || !discountPaise) return '0.0'
  const pct = (discountPaise / mrpPaise) * 100
  return pct.toFixed(1)
})
Handlebars.registerHelper('packMrp', function(unitPaise, packSize) {
  const total = (unitPaise || 0) * (packSize || 1)
  return formatPaise(total).replace('₹', '')
})
Handlebars.registerHelper('incIndex', function(idx) {
  return (idx || 0) + 1
})

const DEFAULT_RECEIPT_TEMPLATE = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @page { margin: 0; }
    * { box-sizing: border-box; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
      line-height: 1.3;
      width: 80mm;
      margin: 0 auto;
      padding: 6px;
      color: #000000;
      background: #ffffff;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .text-left { text-align: left; }
    .bold { font-weight: bold; }
    
    .dashed-line {
      border-bottom: 1px dashed #000000;
      margin: 5px 0;
    }
    .double-line {
      border-bottom: 2px solid #000000;
      margin: 5px 0;
    }

    .store-name {
      font-size: 15px;
      font-weight: 900;
      text-transform: uppercase;
      text-align: center;
      letter-spacing: 0.2px;
    }
    .store-sub {
      font-size: 10px;
      font-weight: bold;
      text-align: center;
      margin-top: 1px;
    }
    .store-info {
      font-size: 9.5px;
      text-align: center;
      margin-top: 2px;
    }

    .meta-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10.5px;
    }
    .meta-table td {
      padding: 1px 0;
    }

    .item-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10.5px;
    }
    .item-table th {
      border-bottom: 1px dashed #000;
      padding: 3px 0;
      font-weight: bold;
    }
    .item-table td {
      padding: 2px 0;
      vertical-align: top;
    }

    .item-title {
      font-weight: bold;
      font-size: 11px;
    }
    .item-subtext {
      font-size: 9.5px;
      color: #333333;
    }

    .savings-box {
      border: 1px dashed #000000;
      text-align: center;
      padding: 6px;
      margin: 8px 0;
      font-weight: bold;
      font-size: 11px;
      text-transform: uppercase;
    }

    .footer {
      text-align: center;
      font-size: 9.5px;
      margin-top: 6px;
    }
  </style>
</head>
<body>
  <!-- STORE HEADER -->
  <div class="store-name">{{store.storeName}}</div>
  <div class="store-sub">{{store.storeSubtitle}}</div>
  {{#if store.storeAddress}}<div class="store-info">{{store.storeAddress}}</div>{{/if}}
  
  {{#if store.storePhone}}
    <div class="store-info">
      Ph: {{store.storePhone}} {{#if store.storeProprietor}}| Prop: {{store.storeProprietor}}{{/if}}
    </div>
  {{else}}
    {{#if store.storeProprietor}}<div class="store-info">Prop: {{store.storeProprietor}}</div>{{/if}}
  {{/if}}

  {{#if store.storeGstin}}
    {{#if store.storeDl}}
      <div class="store-info">GSTIN: {{store.storeGstin}} | DL No: {{store.storeDl}}</div>
    {{else}}
      <div class="store-info">GSTIN: {{store.storeGstin}}</div>
    {{/if}}
  {{else}}
    {{#if store.storeDl}}
      <div class="store-info">DL No: {{store.storeDl}}</div>
    {{/if}}
  {{/if}}

  <div class="dashed-line"></div>

  <!-- BILL META -->
  <table class="meta-table">
    <tr>
      <td>Bill No: {{sale.billNumber}}</td>
      <td class="text-right">Date: {{currentDate}}</td>
    </tr>
    <tr>
      <td>Pay Mode: {{sale.paymentMode}}</td>
      <td class="text-right">Time: {{currentTime}}</td>
    </tr>
  </table>

  <div class="dashed-line"></div>

  <!-- PATIENT / DOCTOR META -->
  <table class="meta-table">
    {{#if sale.patientName}}
    <tr>
      <td style="width: 25%;">Patient:</td>
      <td class="text-right bold">{{sale.patientName}}</td>
    </tr>
    {{/if}}
    {{#if sale.patientAddress}}
    <tr>
      <td style="width: 25%;">Address:</td>
      <td class="text-right">{{sale.patientAddress}}</td>
    </tr>
    {{/if}}
    {{#if sale.doctorName}}
    <tr>
      <td style="width: 25%;">Doctor:</td>
      <td class="text-right bold">Dr. {{sale.doctorName}}</td>
    </tr>
    {{/if}}
  </table>

  <div class="dashed-line"></div>

  <!-- ITEM TABLE -->
  <table class="item-table">
    <thead>
      <tr>
        <th class="text-left" style="width: 45%;">Item</th>
        <th class="text-center" style="width: 15%;">Qty</th>
        <th class="text-right" style="width: 20%;">Rate</th>
        <th class="text-right" style="width: 20%;">Amt</th>
      </tr>
    </thead>
    <tbody>
      {{#each items}}
      <tr>
        <td colspan="4" style="padding-top: 4px;">
          <div class="item-title">{{incIndex @index}}. {{this.brandName}}</div>
          <div class="item-subtext">
            Batch: {{this.batchNumber}} | Exp: {{this.expiryDate}}
          </div>
          <div class="item-subtext">
            MRP: ₹{{packMrp this.mrpPaise this.packSize}} {{#if this.discountPaise}}| Disc: {{calcDiscPct this.mrpPaise this.discountPaise}}%{{/if}} | GST: {{this.gstRatePct}}%
          </div>
        </td>
      </tr>
      <tr>
        <td colspan="3" class="text-left" style="padding-bottom: 4px;">
          {{this.quantityUnits}} x ₹{{packMrp this.salePricePaise 1}}
        </td>
        <td class="text-right bold" style="padding-bottom: 4px;">
          ₹{{formatPaise this.gstBreakdown.lineTotalPaise}}
        </td>
      </tr>
      {{/each}}
    </tbody>
  </table>

  <div class="dashed-line"></div>

  <!-- QUANTITY SUMMARY -->
  <table class="meta-table">
    <tr>
      <td>Total Items: {{items.length}}</td>
      <td class="text-right">Total Qty: {{calcTotalQty items}}</td>
    </tr>
  </table>

  <div class="dashed-line"></div>

  <!-- TAX & TOTAL BREAKDOWN -->
  <table class="meta-table">
    <tr>
      <td>Taxable Value</td>
      <td class="text-right">₹{{calcTaxableVal sale}}</td>
    </tr>
    <tr>
      <td>CGST (6%)</td>
      <td class="text-right">₹{{calcHalfTax sale.totalTaxPaise}}</td>
    </tr>
    <tr>
      <td>SGST (6%)</td>
      <td class="text-right">₹{{calcHalfTax sale.totalTaxPaise}}</td>
    </tr>
    <tr>
      <td>Round Off</td>
      <td class="text-right">₹-0.00</td>
    </tr>
  </table>

  <div class="double-line"></div>

  <!-- GRAND TOTAL -->
  <table class="meta-table">
    <tr class="bold" style="font-size: 13px;">
      <td>GRAND TOTAL</td>
      <td class="text-right">₹{{formatPaise sale.grandTotalPaise}}</td>
    </tr>
  </table>

  <div class="dashed-line"></div>

  <!-- SAVINGS BOX -->
  {{#if sale.totalDiscountPaise}}
  <div class="savings-box">
    YOU SAVED {{formatPaiseWithSymbol sale.totalDiscountPaise}} ON THIS BILL
  </div>
  {{/if}}

  <!-- FOOTER -->
  <div class="footer">
    <div>Goods once sold will not be taken back.</div>
    <div class="bold" style="margin-top: 3px; font-size: 10px;">Thank you for your visit! Get well soon.</div>
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

      const storeSettings = getStoreHeaderSettings()
      const template = Handlebars.compile(templateStr)
      const html = template({ sale: saleData, items: itemsData, store: storeSettings })

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

  ipcMain.handle(IPC_CHANNELS.PRINT_PDF, async (_, htmlContent: string, filename: string, options?: any) => {
    return generatePdf(htmlContent, filename, options)
  })
}
