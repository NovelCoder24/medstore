import { ipcMain, BrowserWindow, screen, app, shell } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import * as fs from 'fs'
import * as path from 'path'
import Handlebars from 'handlebars'
import { formatPaise, numberToIndianWords } from '../../shared/utils/paise'
import { getStoreHeaderSettings, StoreHeaderSettings } from './settings.service'

/**
 * Register custom Handlebars helpers for the A4 Cash Memo / Tax Invoice
 */
Handlebars.registerHelper('formatPaise', function (amount) {
  const num = (amount || 0) / 100
  return num.toFixed(2)
})

Handlebars.registerHelper('formatPaiseNoSymbol', function (amount) {
  const num = (amount || 0) / 100
  return num.toFixed(2)
})

Handlebars.registerHelper('unitPriceRupees', function (salePricePaise) {
  const num = (salePricePaise || 0) / 100
  return num.toFixed(2)
})

Handlebars.registerHelper('inWords', function (amountPaise) {
  return numberToIndianWords((amountPaise || 0) / 100)
})

Handlebars.registerHelper('invoiceDate', function (dateStr) {
  if (dateStr) {
    try {
      const d = new Date(dateStr)
      if (!isNaN(d.getTime())) {
        const day = d.getDate().toString().padStart(2, '0')
        const month = (d.getMonth() + 1).toString().padStart(2, '0')
        const year = d.getFullYear()
        return `${day}/${month}/${year}`
      }
    } catch (e) {}
  }
  const d = new Date()
  const day = d.getDate().toString().padStart(2, '0')
  const month = (d.getMonth() + 1).toString().padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
})

Handlebars.registerHelper('invoiceTime', function (dateStr) {
  if (dateStr) {
    try {
      const d = new Date(dateStr)
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    } catch (e) {}
  }
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
})

Handlebars.registerHelper('formatExp', function (dateStr) {
  if (!dateStr) return '—'
  const match = String(dateStr).match(/^(\d{4})-(\d{2})/)
  if (match) {
    const year = match[1]
    const month = match[2]
    return `${month}/${year}`
  }
  return dateStr
})

Handlebars.registerHelper('calcTotalQty', function (items) {
  if (!Array.isArray(items)) return 0
  return items.reduce((sum, i) => sum + (i.quantityUnits || 0), 0)
})

Handlebars.registerHelper('incIndex', function (idx) {
  return (idx || 0) + 1
})

/**
 * Standard A4 Normal Tax Invoice Template matching User Design
 */
const DEFAULT_A4_INVOICE_TEMPLATE = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tax Invoice — {{store.storeName}}</title>
  <!-- Google Fonts: Crisp Serif for Header, Clean Grotesk for Body, Clear Mono for Numbers & Codes -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600;700&family=Inter:wght@400;500;600;700;800&family=Playfair+Display:wght@700;800;900&family=Source+Serif+4:wght@600;700;800&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>

  <style>
    :root {
      --primary-ink: #0f172a;       /* Deep Slate/Black - high contrast */
      --secondary-ink: #475569;     /* Readable Muted */
      --border-dark: #334155;       /* Solid border for B&W clarity */
      --border-light: #cbd5e1;      /* Crisp sub-lines */
      --accent-theme: #0f766e;      /* Deep Pharmacy Teal (screen) */
      --accent-bg: #f0fdfa;         /* Soft screen background tint */
      --accent-tag: #e6fffa;
      --paper-bg: #ffffff;
      --app-bg: #f1f5f9;
    }

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    body {
      margin: 0;
      background: var(--app-bg);
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: var(--primary-ink);
      -webkit-font-smoothing: antialiased;
      padding: 16px 8px;
    }

    /* A4 Sheet Proportion & Print Layout */
    .memo-sheet {
      width: 100%;
      max-width: 820px;
      margin: 0 auto;
      background: var(--paper-bg);
      border: 1.5px solid var(--border-dark);
      border-radius: 8px;
      box-shadow: 0 4px 14px rgba(15, 23, 42, 0.08);
      overflow: hidden;
    }

    .font-heading {
      font-family: 'Source Serif 4', 'Playfair Display', Georgia, serif;
    }

    .font-mono-code {
      font-family: 'IBM Plex Mono', monospace;
    }

    /* Table borders and cell alignments */
    table.invoice-table {
      width: 100%;
      border-collapse: collapse;
    }

    table.invoice-table th {
      background: var(--primary-ink);
      color: #ffffff;
      font-size: 11.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      padding: 9px 10px;
      border: 1px solid var(--primary-ink);
    }

    table.invoice-table td {
      padding: 9px 10px;
      font-size: 12.5px;
      border-bottom: 1px solid var(--border-light);
      border-left: 1px solid var(--border-light);
      border-right: 1px solid var(--border-light);
      vertical-align: middle;
    }

    @page {
      size: A4 portrait;
      margin: 8mm 10mm 8mm 10mm;
    }

    @media print {
      body {
        background: #ffffff !important;
        padding: 0 !important;
        color: #000000 !important;
      }

      .no-print {
        display: none !important;
      }

      .memo-sheet {
        max-width: 100% !important;
        width: 100% !important;
        margin: 0 !important;
        border: 1.5px solid #000000 !important;
        border-radius: 0 !important;
        box-shadow: none !important;
      }

      table.invoice-table th {
        background: #1a1a1a !important;
        color: #ffffff !important;
        border: 1px solid #000000 !important;
      }

      table.invoice-table td {
        border: 1px solid #666666 !important;
        color: #000000 !important;
      }

      .memo-badge-strip {
        background: #f4f4f4 !important;
        border-top: 1px solid #000 !important;
        border-bottom: 1px solid #000 !important;
        color: #000 !important;
      }

      .grand-total-card {
        background: #000000 !important;
        color: #ffffff !important;
        border: 1px solid #000000 !important;
      }

      .border-ink {
        border-color: #000000 !important;
      }

      .text-slate-600, .text-slate-500, .text-teal-800 {
        color: #1a1a1a !important;
      }
    }
  </style>
</head>
<body>

  <main class="memo-sheet">

    <!-- TOP HEADER / LETTERHEAD -->
    <header class="pt-6 px-6 pb-4 text-center border-b-2 border-slate-800">
      <!-- MAIN STORE NAME (CENTERED & CAPITAL LETTERS) -->
      <h1 class="font-heading text-2xl sm:text-3xl font-black uppercase tracking-[1.5px] text-slate-900 m-0 leading-tight">
        {{store.storeName}}
      </h1>

      <!-- Formal Address -->
      {{#if store.storeAddress}}
      <p class="text-[12.5px] text-slate-600 font-medium mt-1 mb-3.5 max-w-xl mx-auto leading-relaxed">
        {{store.storeAddress}}
      </p>
      {{/if}}

      <!-- FORMAL BUSINESS CREDENTIALS GRID -->
      <div class="mt-3 pt-3 border-t border-dashed border-slate-300 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 text-[11.5px] text-left bg-slate-50/70 p-3 rounded border border-slate-200">
        
        <!-- Proprietor -->
        {{#if store.storeProprietor}}
        <div class="flex items-baseline gap-1.5">
          <span class="text-slate-500 font-semibold min-w-[75px]">Proprietor:</span>
          <span class="font-bold text-slate-900">{{store.storeProprietor}}</span>
        </div>
        {{/if}}

        <!-- Phone -->
        {{#if store.storePhone}}
        <div class="flex items-baseline gap-1.5">
          <span class="text-slate-500 font-semibold min-w-[70px]">Phone No:</span>
          <span class="font-bold font-mono-code text-slate-900">{{store.storePhone}}</span>
        </div>
        {{/if}}

        <!-- Drug Lic. (Appears only if assigned) -->
        {{#if store.storeDl}}
        <div class="flex items-baseline gap-1.5">
          <span class="text-slate-500 font-semibold min-w-[75px]">D.L. No:</span>
          <span class="font-bold font-mono-code text-slate-900">{{store.storeDl}}</span>
        </div>
        {{/if}}

        <!-- GSTIN (Appears only if assigned) -->
        {{#if store.storeGstin}}
        <div class="flex items-baseline gap-1.5">
          <span class="text-slate-500 font-semibold min-w-[75px]">GSTIN:</span>
          <span class="font-bold font-mono-code text-slate-900">{{store.storeGstin}}</span>
        </div>
        {{/if}}

        <!-- Bank A/C -->
        {{#if store.storeAccountNo}}
        <div class="flex items-baseline gap-1.5">
          <span class="text-slate-500 font-semibold min-w-[70px]">Bank A/C:</span>
          <span class="font-bold font-mono-code text-slate-900">{{store.storeAccountNo}}</span>
        </div>
        {{/if}}

        <!-- IFSC Code -->
        {{#if store.storeIfsc}}
        <div class="flex items-baseline gap-1.5">
          <span class="text-slate-500 font-semibold min-w-[75px]">IFSC Code:</span>
          <span class="font-bold font-mono-code text-slate-900">{{store.storeIfsc}}</span>
        </div>
        {{/if}}

      </div>
    </header>

    <!-- PROFESSIONAL TAX INVOICE STRIP -->
    <div class="memo-badge-strip bg-slate-100/90 border-b border-slate-300 py-1.5 px-6 flex items-center justify-between text-xs">
      <div class="flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-slate-800"></span>
        <span class="font-heading font-bold text-slate-900 uppercase tracking-wider text-[13px]">TAX INVOICE</span>
      </div>
      <div class="text-[11px] font-semibold text-slate-600 font-mono-code uppercase">
        Original for Recipient
      </div>
    </div>

    <section class="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-[12.5px] border-b border-slate-300 bg-white">
      
      <!-- Patient / Customer Details -->
      <div class="space-y-1.5 pr-0 sm:pr-4 sm:border-r border-slate-200">
        <div class="flex items-baseline">
          <span class="text-slate-500 font-semibold w-28">Customer / Bill To:</span>
          <span class="font-bold text-slate-900 uppercase">{{#if sale.patientName}}{{sale.patientName}}{{else}}CASH SALE{{/if}}</span>
        </div>
        {{#if sale.customerAddress}}
        <div class="flex items-baseline">
          <span class="text-slate-500 font-semibold w-28">Address:</span>
          <span class="text-slate-700">{{sale.customerAddress}}</span>
        </div>
        {{else}}
          {{#if sale.patientAddress}}
          <div class="flex items-baseline">
            <span class="text-slate-500 font-semibold w-28">Address:</span>
            <span class="text-slate-700">{{sale.patientAddress}}</span>
          </div>
          {{/if}}
        {{/if}}
        {{#if sale.doctorName}}
        <div class="flex items-baseline">
          <span class="text-slate-500 font-semibold w-28">Doctor:</span>
          <span class="font-semibold text-slate-900">Dr. {{sale.doctorName}}{{#if sale.doctorRegNo}} (Reg: {{sale.doctorRegNo}}){{/if}}</span>
        </div>
        {{/if}}
      </div>

      <!-- Invoice & Date Details -->
      <div class="space-y-1.5 pl-0 sm:pl-2">
        <div class="flex items-baseline justify-between sm:justify-start">
          <span class="text-slate-500 font-semibold w-28">Invoice No:</span>
          <span class="font-mono-code font-bold bg-slate-100 text-slate-900 px-2 py-0.5 rounded border border-slate-300 text-[12px]">
            {{sale.billNumber}}
          </span>
        </div>
        <div class="flex items-baseline justify-between sm:justify-start">
          <span class="text-slate-500 font-semibold w-28">Invoice Date:</span>
          <span class="font-semibold text-slate-900">{{invoiceDate sale.created_at}} &bull; {{invoiceTime sale.created_at}}</span>
        </div>
        <div class="flex items-baseline justify-between sm:justify-start">
          <span class="text-slate-500 font-semibold w-28">Payment Mode:</span>
          <span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-slate-200 text-slate-900 uppercase">
            {{sale.paymentMode}}
          </span>
        </div>
      </div>

    </section>

    <div class="overflow-x-auto">
      <table class="invoice-table">
        <thead>
          <tr>
            <th class="text-center" style="width: 38px;">#</th>
            <th style="width: 38%;">Description of Medicine / Item</th>
            <th class="text-center" style="width: 14%;">Batch No.</th>
            <th class="text-center" style="width: 12%;">Expiry</th>
            <th class="text-center" style="width: 8%;">Qty</th>
            <th class="text-right" style="width: 13%;">Rate (₹)</th>
            <th class="text-right" style="width: 15%;">Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          {{#each items}}
          <tr>
            <td class="text-center font-semibold text-slate-600">{{incIndex @index}}</td>
            <td>
              <div class="font-bold text-slate-900 text-[13px] uppercase">{{this.brandName}}</div>
              <div class="text-[11px] text-slate-500 font-medium">
                {{#if this.genericName}}Salt: {{this.genericName}}{{/if}}{{#if this.hsnCode}} &bull; HSN: {{this.hsnCode}}{{/if}}
              </div>
            </td>
            <td class="text-center">
              <span class="font-mono-code font-semibold text-[11.5px] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-300">{{this.batchNumber}}</span>
            </td>
            <td class="text-center font-mono-code text-[11.5px] font-medium text-slate-700">{{formatExp this.expiryDate}}</td>
            <td class="text-center font-bold text-slate-900">{{this.quantityUnits}}</td>
            <td class="text-right font-mono-code text-slate-800">{{unitPriceRupees this.salePricePaise}}</td>
            <td class="text-right font-mono-code font-bold text-slate-900">{{formatPaise this.gstBreakdown.lineTotalPaise}}</td>
          </tr>
          {{/each}}
        </tbody>
      </table>
    </div>

    <div class="p-4 sm:p-5 bg-slate-50/50 border-t border-slate-300">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
        
        <!-- Left Column: Amount in words -->
        <div class="space-y-3">
          <div class="bg-white p-3 rounded border border-slate-200 shadow-sm">
            <span class="text-[10.5px] uppercase font-bold text-slate-500 block tracking-wider mb-1">
              Amount in Words:
            </span>
            <span class="text-[13px] font-bold text-slate-900 leading-snug">
              Rupees {{inWords sale.grandTotalPaise}}
            </span>
          </div>
        </div>

        <!-- Right Column: Calculation Summary -->
        <div class="space-y-1.5 text-[12.5px]">
          <div class="flex justify-between py-1 border-b border-slate-200">
            <span class="text-slate-600 font-medium">Gross Subtotal:</span>
            <span class="font-mono-code font-semibold text-slate-900">₹{{formatPaise sale.subtotalPaise}}</span>
          </div>

          {{#if sale.totalDiscountPaise}}
          <div class="flex justify-between py-1 border-b border-slate-200 text-amber-700">
            <span class="font-medium">Special Discount (₹):</span>
            <span class="font-mono-code font-bold">- ₹{{formatPaise sale.totalDiscountPaise}}</span>
          </div>
          {{/if}}

          <div class="flex justify-between py-1 border-b border-slate-200">
            <span class="text-slate-600 font-medium">GST / Taxes Included:</span>
            <span class="font-mono-code text-slate-700">₹{{formatPaise sale.totalTaxPaise}} (MRP incl.)</span>
          </div>

          <!-- GRAND NET TOTAL -->
          <div class="grand-total-card flex justify-between items-center bg-slate-900 text-white px-4 py-2.5 rounded-md mt-2 shadow-sm">
            <div>
              <span class="font-heading font-bold text-[14px] uppercase tracking-wider block">Net Payable</span>
              <span class="text-[10px] text-slate-300">Round Off Included</span>
            </div>
            <span class="font-mono-code font-bold text-xl sm:text-2xl tracking-tight text-white">
              ₹{{formatPaise sale.grandTotalPaise}}
            </span>
          </div>
        </div>

      </div>
    </div>

    <footer class="p-5 border-t border-slate-300 bg-white">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 items-end">
        
        <!-- Terms and Conditions (Only specific medicine return policy) -->
        <div class="text-[11px] text-slate-600 space-y-1 pr-2">
          <div class="font-bold text-slate-800 uppercase tracking-wide text-[10.5px]">Terms &amp; Conditions:</div>
          <p class="m-0 leading-relaxed text-slate-500">
            &bull; Refrigerated &amp; Cut strip medicines are not eligible for return.
          </p>
        </div>

        <!-- Signature and Seal -->
        <div class="text-center sm:text-right">
          <div class="inline-block text-center min-w-[200px]">
            <div class="h-16 border border-dashed border-slate-400 rounded-md bg-slate-50/70 flex items-center justify-center text-slate-400 text-[11px] font-medium mb-1">
              [ Official Seal / Signature ]
            </div>
            <div class="text-[11.5px] font-bold text-slate-900 uppercase tracking-wide">
              For {{store.storeName}}
            </div>
            <div class="text-[10.5px] text-slate-500">Authorized Signatory</div>
          </div>
        </div>

      </div>
    </footer>

  </main>
</body>
</html>
`

/**
 * Wraps the invoice HTML with the modern top toolbar matching preview
 */
function wrapWithA4PreviewToolbar(invoiceHtml: string, storeSettings: StoreHeaderSettings, billNumber: string): string {
  const bodyMatch = invoiceHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i)
  const bodyContent = bodyMatch ? bodyMatch[1] : invoiceHtml
  const headMatch = invoiceHtml.match(/<head[^>]*>([\s\S]*)<\/head>/i)
  const headContent = headMatch ? headMatch[1] : ''

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Tax Invoice Generator - ${billNumber}</title>
  ${headContent}
  <style>
    @media print {
      .preview-top-toolbar { display: none !important; }
      body { padding: 0 !important; background: #fff !important; overflow: visible !important; }
      .paper-viewport { padding: 0 !important; overflow: visible !important; background: transparent !important; }
      .paper-preview-sheet { box-shadow: none !important; margin: 0 !important; padding: 0 !important; border: none !important; width: 100% !important; max-width: 100% !important; }
    }

    * { box-sizing: border-box; }

    html, body {
      margin: 0;
      padding: 0;
      background: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
      height: 100vh;
      overflow: hidden;
    }

    .preview-app-container {
      display: flex;
      flex-direction: column;
      height: 100vh;
    }

    /* Top Floating Toolbar matching UI */
    .preview-top-toolbar {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 24px;
      background: #ffffff;
      border-bottom: 1px solid #e2e8f0;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
      z-index: 50;
    }

    .toolbar-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .icon-badge {
      width: 40px;
      height: 40px;
      border-radius: 12px;
      background: #f0fdfa;
      color: #0f766e;
      border: 1px solid #ccfbf1;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
    }

    .toolbar-title-group h2 {
      font-size: 16px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.2px;
      line-height: 1.2;
    }

    .toolbar-title-group p {
      font-size: 11px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      margin-top: 1px;
    }

    .toolbar-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .btn-toolbar {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 18px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.15s ease;
      border: 1px solid transparent;
      user-select: none;
    }

    .btn-edit {
      background: #f8fafc;
      color: #334155;
      border-color: #cbd5e1;
    }
    .btn-edit:hover {
      background: #f1f5f9;
      color: #0f172a;
      border-color: #94a3b8;
    }

    .btn-save-pdf {
      background: #f0fdfa;
      color: #0f766e;
      border-color: #99f6e4;
    }
    .btn-save-pdf:hover {
      background: #ccfbf1;
      color: #115e59;
    }

    .btn-primary-print {
      background: #0f766e;
      color: #ffffff;
      box-shadow: 0 4px 12px rgba(15, 118, 110, 0.25);
    }
    .btn-primary-print:hover {
      background: #115e59;
      box-shadow: 0 6px 16px rgba(15, 118, 110, 0.35);
      transform: translateY(-1px);
    }
    .btn-primary-print:active {
      transform: translateY(0);
    }

    /* Scrollable Canvas Viewport */
    .paper-viewport {
      flex: 1;
      padding: 24px;
      overflow-y: auto;
      overflow-x: auto;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      background: #f1f5f9;
    }

    .paper-preview-sheet {
      width: 100%;
      max-width: 820px;
      margin-bottom: 24px;
    }
  </style>
</head>
<body>
  <div class="preview-app-container">
    <div class="preview-top-toolbar">
      <div class="toolbar-left">
        <div class="icon-badge">
          🧾
        </div>
        <div class="toolbar-title-group">
          <h2>Tax Invoice Generator</h2>
          <p>${storeSettings.storeName}</p>
        </div>
      </div>

      <div class="toolbar-actions">
        <button class="btn-toolbar btn-edit" id="cancelBtn">
          ✏️ Edit / Close
        </button>
        <button class="btn-toolbar btn-save-pdf" id="pdfBtn">
          📥 Save as PDF
        </button>
        <button class="btn-toolbar btn-primary-print" id="printBtn">
          🖨️ Print / Download PDF
        </button>
      </div>
    </div>

    <!-- Center A4 Paper Viewport -->
    <div class="paper-viewport">
      <div class="paper-preview-sheet">
        ${bodyContent}
      </div>
    </div>
  </div>

  <script>
    document.getElementById('printBtn').addEventListener('click', function() {
      console.log('__PREVIEW_PRINT__');
    });

    document.getElementById('pdfBtn').addEventListener('click', function() {
      console.log('__PREVIEW_SAVE_PDF__');
      this.textContent = 'Saving...';
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
</html>
`
}

let activePreviewWindow: BrowserWindow | null = null

/**
 * Shows an A4 Print Preview window for the Tax Invoice
 */
export async function showInvoicePrintPreview(htmlContent: string, billNumber: string): Promise<boolean> {
  return new Promise((resolve) => {
    // If a preview window is already open, close it cleanly to avoid duplicate popups
    if (activePreviewWindow && !activePreviewWindow.isDestroyed()) {
      try {
        activePreviewWindow.close()
      } catch (e) {}
      activePreviewWindow = null
    }

    const primaryDisplay = screen.getPrimaryDisplay()
    const { width: screenW, height: screenH } = primaryDisplay.workAreaSize

    const previewWidth = Math.min(1020, Math.round(screenW * 0.75))
    const previewHeight = Math.min(940, screenH - 40)

    const storeSettings = getStoreHeaderSettings()

    const previewWindow = new BrowserWindow({
      width: previewWidth,
      height: previewHeight,
      x: Math.round((screenW - previewWidth) / 2),
      y: Math.round((screenH - previewHeight) / 2),
      show: false,
      resizable: true,
      minimizable: true,
      maximizable: true,
      alwaysOnTop: false,
      title: `Tax Invoice Generator - ${billNumber}`,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    })

    activePreviewWindow = previewWindow

    const wrappedHtml = wrapWithA4PreviewToolbar(htmlContent, storeSettings, billNumber)
    const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(wrappedHtml)
    previewWindow.loadURL(dataUrl)

    let resolved = false

    previewWindow.webContents.on('console-message', async (_event, _level, message) => {
      if (resolved) return

      if (message === '__PREVIEW_PRINT__') {
        resolved = true
        previewWindow.webContents.print({
          silent: false,
          printBackground: true,
          pageSize: 'A4'
        }, (success, errorType) => {
          previewWindow.close()
          if (!success && errorType !== 'cancelled') {
            console.error(`Print failed: ${errorType}`)
          }
          resolve(success)
        })
      } else if (message === '__PREVIEW_SAVE_PDF__') {
        try {
          const pdfPath = await generatePdf(htmlContent, `Invoices/${billNumber}.pdf`)
          shell.showItemInFolder(pdfPath)
        } catch (e) {
          console.error("Failed to save PDF:", e)
        }
      } else if (message === '__PREVIEW_CANCEL__') {
        resolved = true
        previewWindow.close()
        resolve(false)
      }
    })

    previewWindow.on('closed', () => {
      if (activePreviewWindow === previewWindow) {
        activePreviewWindow = null
      }
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
 * Generates an A4 PDF from HTML content with guaranteed window cleanup and timeout.
 */
export async function generatePdf(htmlContent: string, outputFilename: string, printOptions: any = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    let completed = false

    const printWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    })

    const timeout = setTimeout(() => {
      if (!completed) {
        completed = true
        if (!printWindow.isDestroyed()) {
          printWindow.destroy()
        }
        reject(new Error('PDF generation timed out after 10 seconds'))
      }
    }, 10000)

    const cleanup = () => {
      clearTimeout(timeout)
      if (!printWindow.isDestroyed()) {
        try {
          printWindow.close()
        } catch (e) {
          try {
            printWindow.destroy()
          } catch (d) {}
        }
      }
    }

    const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent)
    printWindow.loadURL(dataUrl)

    printWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
      if (completed) return
      completed = true
      cleanup()
      reject(new Error(`Failed to load invoice content for PDF generation: ${errorDescription} (${errorCode})`))
    })

    printWindow.webContents.on('did-finish-load', async () => {
      if (completed) return
      try {
        const pdfData = await printWindow.webContents.printToPDF({
          printBackground: true,
          pageSize: 'A4',
          margins: { marginType: 'default' },
          ...printOptions
        })

        const documentsPath = app.getPath('documents')
        const fullPath = path.join(documentsPath, 'MedStore', outputFilename)

        const dir = path.dirname(fullPath)
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true })
        }

        fs.writeFileSync(fullPath, pdfData)
        completed = true
        cleanup()
        resolve(fullPath)
      } catch (err: any) {
        if (!completed) {
          completed = true
          cleanup()
          reject(err)
        }
      }
    })
  })
}

/**
 * Ensures the editable template file exists in Documents/MedStore/Templates/invoice.hbs
 * and opens it in the system editor.
 */
export function openInvoiceTemplateFile(): string {
  const documentsPath = app.getPath('documents')
  const templatesDir = path.join(documentsPath, 'MedStore', 'Templates')
  const templatePath = path.join(templatesDir, 'invoice.hbs')

  if (!fs.existsSync(templatesDir)) {
    fs.mkdirSync(templatesDir, { recursive: true })
  }

  if (!fs.existsSync(templatePath)) {
    fs.writeFileSync(templatePath, DEFAULT_A4_INVOICE_TEMPLATE, 'utf8')
  }

  shell.openPath(templatePath)
  return templatePath
}

/**
 * Previews a sample invoice with current store settings
 */
export async function previewSampleInvoice(): Promise<boolean> {
  const documentsPath = app.getPath('documents')
  const templatePath = path.join(documentsPath, 'MedStore', 'Templates', 'invoice.hbs')

  let templateStr = DEFAULT_A4_INVOICE_TEMPLATE
  if (fs.existsSync(templatePath)) {
    templateStr = fs.readFileSync(templatePath, 'utf8')
  }

  const storeSettings = getStoreHeaderSettings()
  const template = Handlebars.compile(templateStr)

  const sampleSale = {
    billNumber: 'MED-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-0001',
    created_at: new Date().toISOString(),
    patientName: 'Novel (Self)',
    customerAddress: 'Civil Hospital Complex, Raipur (C.G.)',
    doctorName: 'Rajendra',
    doctorRegNo: 'FESA5487',
    paymentMode: 'CASH',
    subtotalPaise: 31500,
    totalDiscountPaise: 2500,
    totalTaxPaise: 0,
    grandTotalPaise: 29000
  }

  const sampleItems = [
    {
      brandName: 'Acrylic Acid 57- (VIV) Labyzre',
      genericName: 'Zenith Pharma Ltd.',
      hsnCode: '300490',
      batchNumber: 'ACL058',
      expiryDate: '2026-09-30',
      quantityUnits: 1,
      salePricePaise: 25000,
      gstBreakdown: { lineTotalPaise: 25000 }
    },
    {
      brandName: 'Paracetamol Tablets IP 650mg',
      genericName: 'Apex Health',
      hsnCode: '300490',
      batchNumber: 'PX2094',
      expiryDate: '2027-12-31',
      quantityUnits: 2,
      salePricePaise: 3250,
      gstBreakdown: { lineTotalPaise: 6500 }
    }
  ]

  const html = template({ sale: sampleSale, items: sampleItems, store: storeSettings })
  return await showInvoicePrintPreview(html, sampleSale.billNumber)
}

export function registerPrintHandlers() {
  ipcMain.handle(IPC_CHANNELS.PRINT_RECEIPT, async (_, saleData: any, itemsData: any[]) => {
    try {
      const documentsPath = app.getPath('documents')
      const templatePath = path.join(documentsPath, 'MedStore', 'Templates', 'invoice.hbs')

      let templateStr = DEFAULT_A4_INVOICE_TEMPLATE
      if (fs.existsSync(templatePath)) {
        templateStr = fs.readFileSync(templatePath, 'utf8')
      }

      const storeSettings = getStoreHeaderSettings()
      const template = Handlebars.compile(templateStr)
      const html = template({ sale: saleData, items: itemsData, store: storeSettings })

      const pdfFilename = `Invoices/${saleData.billNumber}.pdf`
      generatePdf(html, pdfFilename).catch(e => console.error("Failed to save background PDF invoice:", e))

      return await showInvoicePrintPreview(html, saleData.billNumber || 'New_Invoice')
    } catch (err: any) {
      console.error("Error generating invoice:", err)
      throw err
    }
  })

  ipcMain.handle(IPC_CHANNELS.PRINT_PDF, async (_, htmlContent: string, filename: string, options?: any) => {
    return generatePdf(htmlContent, filename, options)
  })

  ipcMain.handle(IPC_CHANNELS.PRINT_OPEN_TEMPLATE, () => {
    return openInvoiceTemplateFile()
  })

  ipcMain.handle(IPC_CHANNELS.PRINT_PREVIEW_SAMPLE, () => {
    return previewSampleInvoice()
  })
}

