import { parentPort, workerData } from 'worker_threads'
import Database from 'better-sqlite3'
import { parse } from 'csv-parse/sync'
import * as fs from 'fs'

// We expect workerData to contain:
// - dbPath: string (path to sqlite db)
// - csvPath: string (path to the uploaded CSV file)

interface ImportWorkerData {
  dbPath: string
  csvPath: string
}

const data = workerData as ImportWorkerData

function runImport() {
  const db = new Database(data.dbPath)
  
  // We use WAL mode so this read/write doesn't fully lock the main thread, 
  // but it's isolated anyway.
  
  try {
    const fileContent = fs.readFileSync(data.csvPath, 'utf-8')
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    })
    
    parentPort?.postMessage({ type: 'progress', percent: 10, message: 'Parsed CSV file...' })
    
    const total = records.length
    let processed = 0
    let skipped = 0
    let errors = 0
    
    // We wrap the inserts in a transaction for speed and atomicity
    const insertProduct = db.prepare(`
      INSERT INTO products (
        brand_name, generic_name, manufacturer, category, 
        pack_size, barcode, gst_rate_pct, schedule_flag
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)

    db.transaction(() => {
      for (let i = 0; i < records.length; i++) {
        const row = records[i]
        try {
          // Very basic validation/mapping based on typical pharmacy CSVs
          if (!row.brand_name) {
            skipped++
            continue
          }
          
          const category = row.category || 'MEDICINE'
          const packSize = parseInt(row.pack_size) || 1
          const gstRate = parseFloat(row.gst_rate_pct) || 12
          const schedule = row.schedule_flag || 'NONE'
          const barcode = row.barcode || null

          if (barcode) {
            // Check if exists to avoid unique constraint error
            const exists = db.prepare('SELECT id FROM products WHERE barcode = ?').get(barcode)
            if (exists) {
              skipped++
              continue
            }
          }

          insertProduct.run(
            row.brand_name,
            row.generic_name || null,
            row.manufacturer || null,
            category,
            packSize,
            barcode,
            gstRate,
            schedule
          )
          
          processed++
          
          // Post progress every 1000 rows
          if (processed % 1000 === 0) {
            parentPort?.postMessage({ 
              type: 'progress', 
              percent: Math.min(99, 10 + Math.floor((i / total) * 90)),
              message: `Imported ${processed} rows...`
            })
          }
        } catch (err) {
          errors++
        }
      }
    })() // Execute transaction
    
    parentPort?.postMessage({ 
      type: 'complete', 
      result: { processed, skipped, errors, total } 
    })
    
  } catch (err: any) {
    parentPort?.postMessage({ type: 'error', error: err.message })
  } finally {
    db.close()
  }
}

runImport()
