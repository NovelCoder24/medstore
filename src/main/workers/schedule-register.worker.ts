import { parentPort, workerData } from 'worker_threads'
import Database from 'better-sqlite3'

interface WorkerData {
  dbPath: string
  startDate: string
  endDate: string
}

export interface ScheduleRegisterRow {
  sale_date: string
  bill_number: string
  drug_name: string
  schedule_flag: string
  generic_name: string | null
  composition: string
  batch_number: string
  expiry_date: string
  qty_sold: number
  pack_size: number
  patient_name: string
  patient_phone: string | null
  patient_address: string | null
  doctor_name: string
  doctor_reg_no: string
  sold_by: string
}

const { dbPath, startDate, endDate } = workerData as WorkerData

let db: Database.Database | null = null

try {
  db = new Database(dbPath, { readonly: true })

  // Adjust end date to include the entire day
  const adjustedEnd = endDate.includes(' ') || endDate.includes('T') ? endDate : `${endDate} 23:59:59`

  const stmt = db.prepare(`
    SELECT
      s.created_at       AS sale_date,
      s.bill_number,
      p.brand_name       AS drug_name,
      p.schedule_flag,
      p.generic_name,
      TRIM(COALESCE(c.salt_name, '') || ' ' || COALESCE(c.strength, '') || ' ' || COALESCE(c.dosage_form, '')) AS composition,
      b.batch_number,
      b.expiry_date,
      si.quantity        AS qty_sold,
      p.pack_size,
      COALESCE(s.customer_name, 'Walk-in')   AS patient_name,
      s.customer_mobile  AS patient_phone,
      s.customer_address AS patient_address,
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

  const rows = stmt.all(startDate, adjustedEnd) as ScheduleRegisterRow[]

  // Generate CSV Content
  const csvHeaders = [
    'S.No', 'Date', 'Bill No', 'Schedule', 'Drug Name', 'Composition', 
    'Batch No', 'Expiry', 'Qty', 'Patient Name', 'Patient Phone', 
    'Patient Address', 'Doctor Name', 'Doctor Reg No', 'Sold By'
  ]

  const csvRows = rows.map((r, i) => {
    // Format quantity (e.g. 30 (2x15) or 25 (2x10 + 5))
    const qtySold = r.qty_sold || 0
    const packSize = r.pack_size && r.pack_size > 0 ? r.pack_size : 1
    const packs = Math.floor(qtySold / packSize)
    const loose = qtySold % packSize

    let qtyDisplay = `${qtySold}`
    if (packSize > 1) {
      if (loose > 0 && packs > 0) {
        qtyDisplay = `${qtySold} (${packs}x${packSize} + ${loose})`
      } else if (packs > 0) {
        qtyDisplay = `${qtySold} (${packs}x${packSize})`
      }
    }

    const rowData = [
      i + 1,
      r.sale_date ? r.sale_date.slice(0, 10) : '',
      r.bill_number,
      r.schedule_flag,
      r.drug_name,
      r.composition || '',
      r.batch_number,
      r.expiry_date,
      qtyDisplay,
      r.patient_name,
      r.patient_phone || '',
      r.patient_address || '',
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
  
  parentPort?.postMessage({ success: true, data: rows, csvContent })
} catch (error: any) {
  parentPort?.postMessage({ success: false, error: error.message })
} finally {
  if (db) {
    try {
      db.close()
    } catch (e) {
      // ignore
    }
  }
}
