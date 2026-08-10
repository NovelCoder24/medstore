import { parentPort, workerData } from 'worker_threads'
import Database from 'better-sqlite3'

const { dbPath, month } = workerData as { dbPath: string, month: string }

try {
  // 1. Open a fresh read-only connection to the active database
  const db = new Database(dbPath, { readonly: true, fileMustExist: true })

  // GSTR-1 (Sales) CSV headers
  const headers = [
    'Date', 'Bill No', 'Customer Name', 'Payment Mode',
    'Taxable 0%',
    'Taxable 5%', 'CGST 2.5%', 'SGST 2.5%', 'IGST 5%',
    'Taxable 12%', 'CGST 6%', 'SGST 6%', 'IGST 12%',
    'Taxable 18%', 'CGST 9%', 'SGST 9%', 'IGST 18%',
    'Taxable 28%', 'CGST 14%', 'SGST 14%', 'IGST 28%',
    'Total Amount'
  ]

  let csvContent = headers.join(',') + '\n'

  const sales = db.prepare(`
    SELECT s.id, s.created_at, s.bill_number, s.customer_name, s.payment_mode, s.total_paise, s.gst_type
    FROM sales s
    WHERE strftime('%Y-%m', s.created_at) = ?
    ORDER BY s.created_at ASC
  `).all(month) as any[]

  const getSaleItems = db.prepare(`
    SELECT 
      si.taxable_value_paise, si.cgst_paise, si.sgst_paise, si.igst_paise, b.gst_rate_pct
    FROM sale_items si
    JOIN batches b ON si.batch_id = b.id
    WHERE si.sale_id = ?
  `)

  // Totals for summary footer
  const totals = {
    tax0: 0,
    tax5: 0, cgst2_5: 0, sgst2_5: 0, igst5: 0,
    tax12: 0, cgst6: 0, sgst6: 0, igst12: 0,
    tax18: 0, cgst9: 0, sgst9: 0, igst18: 0,
    tax28: 0, cgst14: 0, sgst14: 0, igst28: 0,
    grandTotal: 0
  }

  // --- Process Sales ---
  for (const sale of sales) {
    const items = getSaleItems.all(sale.id) as any[]

    const rowSums = {
      tax0: 0,
      tax5: 0, cgst2_5: 0, sgst2_5: 0, igst5: 0,
      tax12: 0, cgst6: 0, sgst6: 0, igst12: 0,
      tax18: 0, cgst9: 0, sgst9: 0, igst18: 0,
      tax28: 0, cgst14: 0, sgst14: 0, igst28: 0,
    }

    for (const item of items) {
      if (item.gst_rate_pct === 0) {
        rowSums.tax0 += item.taxable_value_paise
      } else if (item.gst_rate_pct === 5) {
        rowSums.tax5 += item.taxable_value_paise
        rowSums.cgst2_5 += item.cgst_paise
        rowSums.sgst2_5 += item.sgst_paise
        rowSums.igst5 += item.igst_paise
      } else if (item.gst_rate_pct === 12) {
        rowSums.tax12 += item.taxable_value_paise
        rowSums.cgst6 += item.cgst_paise
        rowSums.sgst6 += item.sgst_paise
        rowSums.igst12 += item.igst_paise
      } else if (item.gst_rate_pct === 18) {
        rowSums.tax18 += item.taxable_value_paise
        rowSums.cgst9 += item.cgst_paise
        rowSums.sgst9 += item.sgst_paise
        rowSums.igst18 += item.igst_paise
      } else if (item.gst_rate_pct === 28) {
        rowSums.tax28 += item.taxable_value_paise
        rowSums.cgst14 += item.cgst_paise
        rowSums.sgst14 += item.sgst_paise
        rowSums.igst28 += item.igst_paise
      }
    }

    // Add to totals
    totals.tax0 += rowSums.tax0; totals.tax5 += rowSums.tax5; totals.cgst2_5 += rowSums.cgst2_5; totals.sgst2_5 += rowSums.sgst2_5; totals.igst5 += rowSums.igst5;
    totals.tax12 += rowSums.tax12; totals.cgst6 += rowSums.cgst6; totals.sgst6 += rowSums.sgst6; totals.igst12 += rowSums.igst12;
    totals.tax18 += rowSums.tax18; totals.cgst9 += rowSums.cgst9; totals.sgst9 += rowSums.sgst9; totals.igst18 += rowSums.igst18;
    totals.tax28 += rowSums.tax28; totals.cgst14 += rowSums.cgst14; totals.sgst14 += rowSums.sgst14; totals.igst28 += rowSums.igst28;
    totals.grandTotal += sale.total_paise;

    const row = [
      sale.created_at.slice(0, 10),
      sale.bill_number,
      `"${sale.customer_name || 'Walk-in'}"`,
      sale.payment_mode,
      (rowSums.tax0 / 100).toFixed(2),
      (rowSums.tax5 / 100).toFixed(2), (rowSums.cgst2_5 / 100).toFixed(2), (rowSums.sgst2_5 / 100).toFixed(2), (rowSums.igst5 / 100).toFixed(2),
      (rowSums.tax12 / 100).toFixed(2), (rowSums.cgst6 / 100).toFixed(2), (rowSums.sgst6 / 100).toFixed(2), (rowSums.igst12 / 100).toFixed(2),
      (rowSums.tax18 / 100).toFixed(2), (rowSums.cgst9 / 100).toFixed(2), (rowSums.sgst9 / 100).toFixed(2), (rowSums.igst18 / 100).toFixed(2),
      (rowSums.tax28 / 100).toFixed(2), (rowSums.cgst14 / 100).toFixed(2), (rowSums.sgst14 / 100).toFixed(2), (rowSums.igst28 / 100).toFixed(2),
      (sale.total_paise / 100).toFixed(2)
    ]
    csvContent += row.join(',') + '\n'
  }

  // --- Process Credit Notes (Returns) ---
  const returns = db.prepare(`
    SELECT r.id, r.created_at, r.return_number, s.customer_name, r.refund_amount_paise
    FROM sales_returns r
    JOIN sales s ON r.original_sale_id = s.id
    WHERE strftime('%Y-%m', r.created_at) = ?
    ORDER BY r.created_at ASC
  `).all(month) as any[]

  if (returns.length > 0) {
    csvContent += '\nCREDIT NOTES (RETURNS)\n'
    const getReturnItems = db.prepare(`
      SELECT 
        ri.refund_paise, si.taxable_value_paise, si.total_paise, 
        si.cgst_paise, si.sgst_paise, si.igst_paise, b.gst_rate_pct
      FROM sales_return_items ri
      JOIN sale_items si ON ri.original_sale_item_id = si.id
      JOIN batches b ON ri.batch_id = b.id
      WHERE ri.return_id = ?
    `)

    for (const ret of returns) {
      const items = getReturnItems.all(ret.id) as any[]
      
      const rowSums = {
        tax0: 0, tax5: 0, cgst2_5: 0, sgst2_5: 0, igst5: 0,
        tax12: 0, cgst6: 0, sgst6: 0, igst12: 0,
        tax18: 0, cgst9: 0, sgst9: 0, igst18: 0,
        tax28: 0, cgst14: 0, sgst14: 0, igst28: 0,
      }

      let totalRefunded = 0;

      for (const item of items) {
        // We must reverse-calculate the returned tax based on the ratio of refund vs original total
        if (item.total_paise <= 0 || item.refund_paise <= 0) continue;
        const ratio = item.refund_paise / item.total_paise;
        
        const refTaxable = Math.round(item.taxable_value_paise * ratio)
        const refCgst = Math.round(item.cgst_paise * ratio)
        const refSgst = Math.round(item.sgst_paise * ratio)
        const refIgst = Math.round(item.igst_paise * ratio)
        
        totalRefunded += item.refund_paise;

        if (item.gst_rate_pct === 0) {
          rowSums.tax0 += refTaxable
        } else if (item.gst_rate_pct === 5) {
          rowSums.tax5 += refTaxable; rowSums.cgst2_5 += refCgst; rowSums.sgst2_5 += refSgst; rowSums.igst5 += refIgst;
        } else if (item.gst_rate_pct === 12) {
          rowSums.tax12 += refTaxable; rowSums.cgst6 += refCgst; rowSums.sgst6 += refSgst; rowSums.igst12 += refIgst;
        } else if (item.gst_rate_pct === 18) {
          rowSums.tax18 += refTaxable; rowSums.cgst9 += refCgst; rowSums.sgst9 += refSgst; rowSums.igst18 += refIgst;
        } else if (item.gst_rate_pct === 28) {
          rowSums.tax28 += refTaxable; rowSums.cgst14 += refCgst; rowSums.sgst14 += refSgst; rowSums.igst28 += refIgst;
        }
      }

      // Deduct from totals (returns reduce GSTR-1 liability)
      totals.tax0 -= rowSums.tax0; totals.tax5 -= rowSums.tax5; totals.cgst2_5 -= rowSums.cgst2_5; totals.sgst2_5 -= rowSums.sgst2_5; totals.igst5 -= rowSums.igst5;
      totals.tax12 -= rowSums.tax12; totals.cgst6 -= rowSums.cgst6; totals.sgst6 -= rowSums.sgst6; totals.igst12 -= rowSums.igst12;
      totals.tax18 -= rowSums.tax18; totals.cgst9 -= rowSums.cgst9; totals.sgst9 -= rowSums.sgst9; totals.igst18 -= rowSums.igst18;
      totals.tax28 -= rowSums.tax28; totals.cgst14 -= rowSums.cgst14; totals.sgst14 -= rowSums.sgst14; totals.igst28 -= rowSums.igst28;
      totals.grandTotal -= totalRefunded;

      const row = [
        ret.created_at.slice(0, 10),
        ret.return_number,
        `"${ret.customer_name || 'Walk-in'}"`,
        'RETURN',
        (-rowSums.tax0 / 100).toFixed(2),
        (-rowSums.tax5 / 100).toFixed(2), (-rowSums.cgst2_5 / 100).toFixed(2), (-rowSums.sgst2_5 / 100).toFixed(2), (-rowSums.igst5 / 100).toFixed(2),
        (-rowSums.tax12 / 100).toFixed(2), (-rowSums.cgst6 / 100).toFixed(2), (-rowSums.sgst6 / 100).toFixed(2), (-rowSums.igst12 / 100).toFixed(2),
        (-rowSums.tax18 / 100).toFixed(2), (-rowSums.cgst9 / 100).toFixed(2), (-rowSums.sgst9 / 100).toFixed(2), (-rowSums.igst18 / 100).toFixed(2),
        (-rowSums.tax28 / 100).toFixed(2), (-rowSums.cgst14 / 100).toFixed(2), (-rowSums.sgst14 / 100).toFixed(2), (-rowSums.igst28 / 100).toFixed(2),
        (-totalRefunded / 100).toFixed(2)
      ]
      csvContent += row.join(',') + '\n'
    }
  }

  // --- Summary Footer ---
  csvContent += '\n'
  const summaryRow = [
    '', '', '', 'NET TOTALS',
    (totals.tax0 / 100).toFixed(2),
    (totals.tax5 / 100).toFixed(2), (totals.cgst2_5 / 100).toFixed(2), (totals.sgst2_5 / 100).toFixed(2), (totals.igst5 / 100).toFixed(2),
    (totals.tax12 / 100).toFixed(2), (totals.cgst6 / 100).toFixed(2), (totals.sgst6 / 100).toFixed(2), (totals.igst12 / 100).toFixed(2),
    (totals.tax18 / 100).toFixed(2), (totals.cgst9 / 100).toFixed(2), (totals.sgst9 / 100).toFixed(2), (totals.igst18 / 100).toFixed(2),
    (totals.tax28 / 100).toFixed(2), (totals.cgst14 / 100).toFixed(2), (totals.sgst14 / 100).toFixed(2), (totals.igst28 / 100).toFixed(2),
    (totals.grandTotal / 100).toFixed(2)
  ]
  csvContent += summaryRow.join(',') + '\n'

  db.close()
  parentPort?.postMessage({ success: true, csvContent })

} catch (error: any) {
  parentPort?.postMessage({ success: false, error: error.message })
}
