import { formatPaise } from '../../../main/utils/paise'
import { APP_DEFAULTS } from '../../../shared/constants'

// Note: For thermal printers, 80mm paper width is standard. 
// 80mm is approx 3.14 inches, usually 48 characters wide in standard thermal font.
// We keep the CSS extremely simple and high contrast.

export function generateReceiptHtml(sale: any, items: any[]): string {
  // A generic layout for Pharmacy Bills in India.
  // Must include: Shop Name, DL Number, GSTIN, Patient Name, Dr Name, Batch, Exp, Qty, Rate
  
  const shopName = "MEDSTORE PHARMACY"
  const address = "123 Health Avenue, Medical District, City - 400001"
  const phone = "+91-9876543210"
  const dlNo = "DL: 20/21-MZ-12345"
  const gstin = "GSTIN: 27AAAAA0000A1Z5"

  const html = `
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
    
    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
    th, td { padding: 2px 0; vertical-align: top; }
    
    .item-row { margin-bottom: 5px; }
    .item-details { display: flex; justify-content: space-between; font-size: 10px; }
    
    .footer { margin-top: 10px; font-size: 10px; }
  </style>
</head>
<body>
  <div class="text-center border-b">
    <div class="bold" style="font-size: 16px;">${shopName}</div>
    <div>${address}</div>
    <div>Ph: ${phone}</div>
    <div>${dlNo}</div>
    <div>${gstin}</div>
  </div>

  <div class="border-b" style="font-size: 11px;">
    <div>Bill No: ${sale.billNumber || 'SYS-NEW'}</div>
    <div>Date: ${new Date().toLocaleString()}</div>
    ${sale.patientName ? `<div>Pt: ${sale.patientName} ${sale.patientPhone ? '(' + sale.patientPhone + ')' : ''}</div>` : ''}
    ${sale.doctorName ? `<div>Dr: ${sale.doctorName} ${sale.doctorRegNo ? '[' + sale.doctorRegNo + ']' : ''}</div>` : ''}
  </div>

  <table>
    <tr class="border-b" style="font-size: 11px; text-align: left;">
      <th width="45%">Item</th>
      <th width="15%" class="text-center">Qty</th>
      <th width="20%" class="text-right">Rate</th>
      <th width="20%" class="text-right">Amt</th>
    </tr>
    ${items.map(item => `
      <tr>
        <td colspan="4">
          <div class="bold">${item.brandName || item.productName}</div>
          <div class="item-details text-muted-foreground">
            <span>B: ${item.batchNumber} | Exp: ${item.expiryDate || item.expiryMonth + '/' + item.expiryYear}</span>
          </div>
        </td>
      </tr>
      <tr>
        <td></td>
        <td class="text-center">${item.quantityUnits}</td>
        <td class="text-right">${formatPaise(item.salePricePaise || item.mrpPaise).replace('₹', '')}</td>
        <td class="text-right">${formatPaise(item.lineTotalPaise || item.totalPaise).replace('₹', '')}</td>
      </tr>
    `).join('')}
  </table>

  <div class="border-t">
    <table style="width: 100%;">
      <tr>
        <td>Subtotal</td>
        <td class="text-right">${formatPaise(sale.subtotalPaise)}</td>
      </tr>
      <tr>
        <td>Discount</td>
        <td class="text-right">- ${formatPaise(sale.totalDiscountPaise)}</td>
      </tr>
      <tr class="bold" style="font-size: 14px;">
        <td>Net Payable</td>
        <td class="text-right">${formatPaise(sale.grandTotalPaise)}</td>
      </tr>
    </table>
  </div>

  <div class="border-t text-center footer">
    <div>* Schedule H/H1/X drugs must be sold on prescription only *</div>
    <div style="margin-top: 5px;">Thank you for your visit!</div>
    <div>Software by MedStore POS</div>
  </div>
</body>
</html>
  `

  return html
}
