const { parentPort, workerData } = require('worker_threads')
const Database = require('better-sqlite3')
const path = require('path')

const { dbPath, startDate, endDate } = workerData

try {
  const db = new Database(dbPath, { readonly: true })

  // Adjust end date to include the entire day
  const adjustedEnd = endDate + 'T23:59:59'

  const stmt = db.prepare(`
    SELECT
      s.created_at       AS sale_date,
      s.bill_number,
      p.brand_name       AS drug_name,
      p.schedule_flag,
      p.generic_name,
      c.salt_name || ' ' || c.strength || ' ' || c.dosage_form AS composition,
      b.batch_number,
      b.expiry_date,
      si.quantity        AS qty_sold,
      p.pack_size,
      COALESCE(s.customer_name, 'Walk-in')   AS patient_name,
      s.customer_mobile  AS patient_phone,
      COALESCE(s.doctor_name, 'Not Provided')   AS doctor_name,
      COALESCE(s.doctor_reg_no, 'Not Provided') AS doctor_reg_no,
      u.display_name     AS sold_by
    FROM sale_items si
    JOIN sales s         ON si.sale_id = s.id
    JOIN products p      ON si.product_id = p.id
    JOIN batches b       ON si.batch_id = b.id
    JOIN users u         ON s.cashier_id = u.id
    LEFT JOIN compositions c ON p.composition_id = c.id
    WHERE p.schedule_flag IN ('H', 'H1', 'X')
      AND s.created_at >= ?
      AND s.created_at <= ?
    ORDER BY s.created_at ASC
  `)

  const rows = stmt.all(startDate, adjustedEnd)

  // Generate CSV Content
  const csvHeaders = [
    'S.No', 'Date', 'Bill No', 'Schedule', 'Drug Name', 'Composition', 
    'Batch No', 'Expiry', 'Qty', 'Patient Name', 'Patient Phone', 
    'Doctor Name', 'Doctor Reg No', 'Sold By'
  ]

  const csvRows = rows.map((r, i) => {
    // Format quantity (e.g. 30 (2x15))
    const qtySold = r.qty_sold
    const packSize = r.pack_size
    const qtyDisplay = packSize > 1 
      ? `${qtySold} (${Math.floor(qtySold / packSize)}x${packSize})`
      : `${qtySold}`

    const rowData = [
      i + 1,
      r.sale_date.split('T')[0],
      r.bill_number,
      r.schedule_flag,
      r.drug_name,
      r.composition || '',
      r.batch_number,
      r.expiry_date,
      qtyDisplay,
      r.patient_name,
      r.patient_phone || '',
      r.doctor_name,
      r.doctor_reg_no,
      r.sold_by
    ]

    // Escape CSV fields
    return rowData.map(field => {
      const str = String(field || '')
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }).join(',')
  })

  const csvContent = [csvHeaders.join(','), ...csvRows].join('\n')

  db.close()
  
  if (parentPort) {
    parentPort.postMessage({ success: true, data: rows, csvContent })
  }
} catch (error) {
  if (parentPort) {
    parentPort.postMessage({ success: false, error: error.message })
  }
}
