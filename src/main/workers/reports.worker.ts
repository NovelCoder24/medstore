import { parentPort, workerData } from 'worker_threads'
import Database from 'better-sqlite3'

const { dbPath, month } = workerData as { dbPath: string, month: string }

try {
  // 1. Open a fresh read-only connection to the active database
  const db = new Database(dbPath, { readonly: true, fileMustExist: true })

  // GSTR-1 (Sales) CSV headers
  const headers = [
    'Date', 'Bill No', 'Customer Name', 'Payment Mode',
    'Taxable Value 5%', 'CGST 2.5%', 'SGST 2.5%',
    'Taxable Value 12%', 'CGST 6%', 'SGST 6%',
    'Total Bill Amount'
  ]

  const sales = db.prepare(`
    SELECT s.id, s.created_at, s.bill_number, s.customer_name, s.payment_mode, s.total_paise
    FROM sales s
    WHERE strftime('%Y-%m', s.created_at) = ?
    ORDER BY s.created_at ASC
  `).all(month) as any[]

  let csvContent = headers.join(',') + '\n'

  const getSaleItems = db.prepare(`
    SELECT 
      si.taxable_value_paise, si.cgst_paise, si.sgst_paise, b.gst_rate_pct
    FROM sale_items si
    JOIN batches b ON si.batch_id = b.id
    WHERE si.sale_id = ?
  `)

  for (const sale of sales) {
    const items = getSaleItems.all(sale.id) as any[]

    let taxable5 = 0
    let cgst2_5 = 0
    let sgst2_5 = 0

    let taxable12 = 0
    let cgst6 = 0
    let sgst6 = 0

    for (const item of items) {
      if (item.gst_rate_pct === 5) {
        taxable5 += item.taxable_value_paise
        cgst2_5 += item.cgst_paise
        sgst2_5 += item.sgst_paise
      } else if (item.gst_rate_pct === 12) {
        taxable12 += item.taxable_value_paise
        cgst6 += item.cgst_paise
        sgst6 += item.sgst_paise
      }
    }

    const row = [
      sale.created_at.slice(0, 10),
      sale.bill_number,
      `"${sale.customer_name || 'Walk-in'}"`,
      sale.payment_mode,
      (taxable5 / 100).toFixed(2),
      (cgst2_5 / 100).toFixed(2),
      (sgst2_5 / 100).toFixed(2),
      (taxable12 / 100).toFixed(2),
      (cgst6 / 100).toFixed(2),
      (sgst6 / 100).toFixed(2),
      (sale.total_paise / 100).toFixed(2)
    ]
    csvContent += row.join(',') + '\n'
  }

  db.close()
  parentPort?.postMessage({ success: true, csvContent })

} catch (error: any) {
  parentPort?.postMessage({ success: false, error: error.message })
}
