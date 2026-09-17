import { ipcMain, BrowserWindow } from 'electron'
import * as fs from 'fs'
import * as crypto from 'crypto'
import { EventEmitter } from 'events'
import { getDatabase } from './db.service'
import { archiveInvoiceImage, extractInvoiceData } from './ocr.service'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import type {
  OcrQueueStatus,
  OcrQueueSummaryItem,
  OcrQueueItem,
  OcrQueueProgressEvent,
  OcrQueueUpdateEvent,
  OcrExtractionResult,
  OcrExtractedItem
} from '../../shared/types'

// ── Rate Limit & Cooldown Configuration ──
// Gemini Free Tier enforces 15 requests per minute.
// 5000ms delay + ~5-8s inference duration = ~11-13s per call (~5 RPM), perfectly safe.
const MIN_DELAY_MS = 5000
const RATE_LIMIT_BACKOFF_MS = 25000

class OcrQueueEmitter extends EventEmitter {}
export const ocrQueueEvents = new OcrQueueEmitter()

let isQueueRunning = false
let rollingAvgDurationMs = 12000 // Default initial estimate: 12 seconds

function broadcastToWindows(channel: string, payload: any) {
  try {
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, payload)
      }
    }
  } catch (err) {
    console.error('[OCR-Queue] Failed to broadcast event:', err)
  }
}

// ── Event forwarding ──
ocrQueueEvents.on('updated', (event: OcrQueueUpdateEvent) => {
  broadcastToWindows(IPC_CHANNELS.OCR_QUEUE_UPDATED, event)
})

ocrQueueEvents.on('progress', (progress: OcrQueueProgressEvent) => {
  broadcastToWindows(IPC_CHANNELS.OCR_QUEUE_PROGRESS, progress)
})

function getQueueSummaryCounts(): { total: number; pending: number; processing: number; ready: number; failed: number; approved: number } {
  const db = getDatabase()
  const rows = db.prepare(`
    SELECT status, COUNT(*) as count 
    FROM ocr_queue 
    GROUP BY status
  `).all() as Array<{ status: string; count: number }>

  const counts = { total: 0, pending: 0, processing: 0, ready: 0, failed: 0, approved: 0 }
  for (const r of rows) {
    counts.total += r.count
    if (r.status === 'PENDING') counts.pending = r.count
    else if (r.status === 'PROCESSING') counts.processing = r.count
    else if (r.status === 'READY') counts.ready = r.count
    else if (r.status === 'FAILED') counts.failed = r.count
    else if (r.status === 'APPROVED') counts.approved = r.count
  }
  return counts
}

function sanitizeFtsTerm(term: string): string {
  return term
    .replace(/["*^:()\-+]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(w => w.length > 0)
    .map(w => `"${w}"*`)
    .join(' AND ')
}

/**
 * Pre-computes catalog matching and flag reasons in the background using SQLite FTS5.
 * This runs completely off the React thread so opening the invoice in the UI takes 0ms.
 */
function preComputeItemMatchingAndFlags(items: OcrExtractedItem[]): OcrExtractedItem[] {
  const db = getDatabase()

  // Prepare SQLite statements for fast lookup
  const exactStmt = db.prepare(`
    SELECT id, brand_name, pack_size, gst_rate_pct 
    FROM products 
    WHERE UPPER(TRIM(brand_name)) = UPPER(?) AND is_active = 1 
    LIMIT 1
  `)

  const ftsStmt = db.prepare(`
    SELECT p.id, p.brand_name, p.pack_size 
    FROM products p
    JOIN products_fts ON products_fts.rowid = p.id
    WHERE products_fts MATCH ? AND p.is_active = 1
    ORDER BY rank
    LIMIT 3
  `)

  const fallbackLikeStmt = db.prepare(`
    SELECT id, brand_name, pack_size 
    FROM products 
    WHERE brand_name LIKE ? AND is_active = 1 
    LIMIT 3
  `)

  return items.map(item => {
    const flagReasons: string[] = []
    let suggestedMatches: Array<{ id: number; brandName: string; packSize: number }> = []
    let isFlagged = false

    const rawName = (item.productName || '').trim()

    if (rawName.length > 0) {
      // 1. Try Exact match
      const exact = exactStmt.get(rawName) as { id: number; brand_name: string; pack_size: number } | undefined
      if (exact) {
        // Unambiguous exact match found
        suggestedMatches = [{ id: exact.id, brandName: exact.brand_name, packSize: exact.pack_size }]
      } else {
        // 2. Try FTS5 fuzzy match
        const sanitized = sanitizeFtsTerm(rawName)
        let matches: any[] = []
        if (sanitized.length > 0) {
          try {
            matches = ftsStmt.all(sanitized)
          } catch (e) {
            // fallback if FTS syntax error
          }
        }

        // 3. Fallback to prefix LIKE if FTS yielded nothing
        if (matches.length === 0 && rawName.length >= 3) {
          const prefix = rawName.slice(0, 4) + '%'
          matches = fallbackLikeStmt.all(prefix)
        }

        if (matches.length > 0) {
          suggestedMatches = matches.map((m: any) => ({
            id: m.id,
            brandName: m.brand_name,
            packSize: m.pack_size
          }))
          // If close match exists (e.g. slight spelling variation in catalog), attach suggestedMatches for 1-click linking
        }
      }
    } else {
      isFlagged = true
      flagReasons.push('Product name not visible / missing in image')
    }

    // 2. Image clarity & AI confidence check (Based directly on the invoice image)
    const conf = item.confidence ?? 1.0
    if (conf < 0.80) {
      isFlagged = true
      const reason = item.imageClarityReason
        ? `Not clear in image: ${item.imageClarityReason}`
        : `Low image clarity / AI confidence (${Math.round(conf * 100)}%)`
      flagReasons.push(reason)
    }

    // 3. Essential elements visibility (Missing or unreadable on invoice image)
    if (!item.batchNumber || !item.batchNumber.trim()) {
      isFlagged = true
      flagReasons.push('Batch number not visible / missing in image')
    }
    if (!item.expiryMonth || !item.expiryYear) {
      isFlagged = true
      flagReasons.push('Expiry date not visible / missing in image')
    }

    return {
      ...item,
      isFlagged,
      flagReasons,
      suggestedMatches
    }
  })
}

/**
 * Background queue worker loop.
 * Sequential execution prevents concurrency issues and strictly manages Gemini rate limits.
 */
async function runQueueWorker() {
  if (isQueueRunning) return
  isQueueRunning = true

  const db = getDatabase()

  try {
    while (true) {
      const item = db.prepare(`
        SELECT * FROM ocr_queue 
        WHERE status = 'PENDING' 
        ORDER BY id ASC 
        LIMIT 1
      `).get() as any

      if (!item) {
        break // Queue is empty
      }

      // Count remaining items for ETA computation
      const pendingCount = (db.prepare(`SELECT COUNT(*) as count FROM ocr_queue WHERE status = 'PENDING'`).get() as any).count
      const totalActive = (db.prepare(`SELECT COUNT(*) as count FROM ocr_queue WHERE status IN ('PENDING', 'PROCESSING')`).get() as any).count
      const currentIndex = Math.max(1, totalActive - pendingCount + 1)
      const estimatedSecondsRemaining = Math.round(pendingCount * (rollingAvgDurationMs / 1000))

      // 1. Mark item as PROCESSING
      db.prepare(`
        UPDATE ocr_queue 
        SET status = 'PROCESSING', processed_at = datetime('now', 'localtime') 
        WHERE id = ?
      `).run(item.id)

      ocrQueueEvents.emit('updated', {
        type: 'STATUS_CHANGED',
        itemId: item.id,
        status: 'PROCESSING',
        summary: getQueueSummaryCounts()
      })

      ocrQueueEvents.emit('progress', {
        status: 'PROCESSING',
        currentItemId: item.id,
        currentFileName: item.file_name,
        currentIndex,
        totalCount: totalActive,
        pendingCount,
        estimatedSecondsRemaining
      })

      console.log(`[OCR-Queue] Processing item #${item.id} (${item.file_name})...`)
      const startTime = Date.now()

      try {
        if (!fs.existsSync(item.file_path)) {
          throw new Error(`File not found at: ${item.file_path}`)
        }

        const fileBuffer = fs.readFileSync(item.file_path)
        const extractionResult: OcrExtractionResult = await extractInvoiceData(
          { buffer: fileBuffer, mimeType: item.mime_type },
          item.vendor_hint_id ? { vendorId: item.vendor_hint_id } : undefined
        )

        // 2. Pre-compute catalog matching and flag reasons in the background!
        const enrichedItems = preComputeItemMatchingAndFlags(extractionResult.items)
        const enrichedResult: OcrExtractionResult = {
          ...extractionResult,
          items: enrichedItems
        }

        const durationMs = Date.now() - startTime
        // Update rolling average with weight (70% existing, 30% new)
        rollingAvgDurationMs = Math.round((rollingAvgDurationMs * 0.7) + (durationMs * 0.3))

        const flaggedCount = enrichedItems.filter(i => i.isFlagged).length
        const itemCount = enrichedItems.length

        // 3. Mark as READY and store lightweight preview fields + full enriched JSON
        db.prepare(`
          UPDATE ocr_queue 
          SET status = 'READY',
              extracted_data_json = ?,
              vendor_name_preview = ?,
              invoice_number_preview = ?,
              invoice_date_preview = ?,
              total_amount_preview = ?,
              item_count = ?,
              flagged_count = ?,
              processing_duration_ms = ?,
              completed_at = datetime('now', 'localtime')
          WHERE id = ?
        `).run(
          JSON.stringify(enrichedResult),
          enrichedResult.vendorName || null,
          enrichedResult.invoiceNumber || null,
          enrichedResult.invoiceDate || null,
          enrichedResult.totalAmount || enrichedResult.grandTotalRupees || 0,
          itemCount,
          flaggedCount,
          durationMs,
          item.id
        )

        console.log(`[OCR-Queue] Item #${item.id} completed successfully in ${durationMs}ms (${itemCount} items, ${flaggedCount} flagged)`)

        ocrQueueEvents.emit('updated', {
          type: 'STATUS_CHANGED',
          itemId: item.id,
          status: 'READY',
          summary: getQueueSummaryCounts()
        })

        // Enforce 5s cooldown between successful API calls
        await new Promise(resolve => setTimeout(resolve, MIN_DELAY_MS))

      } catch (err: any) {
        const durationMs = Date.now() - startTime
        const isRateLimit = err?.message?.includes('429') || err?.message?.includes('RESOURCE_EXHAUSTED') || err?.message?.includes('quota')
        const errorMsg = err?.message || 'Unknown OCR processing error'

        console.warn(`[OCR-Queue] Failed item #${item.id}:`, errorMsg)

        if (isRateLimit) {
          console.warn(`[OCR-Queue] 429 Quota Exceeded detected. Pausing queue for ${RATE_LIMIT_BACKOFF_MS / 1000}s and keeping item PENDING.`)
          // Reset to PENDING so it retries after backoff
          db.prepare(`
            UPDATE ocr_queue 
            SET status = 'PENDING', error_message = ? 
            WHERE id = ?
          `).run(`Rate limit hit: ${errorMsg}. Retrying in ${RATE_LIMIT_BACKOFF_MS / 1000}s...`, item.id)

          ocrQueueEvents.emit('updated', {
            type: 'STATUS_CHANGED',
            itemId: item.id,
            status: 'PENDING',
            summary: getQueueSummaryCounts()
          })

          await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_BACKOFF_MS))
        } else {
          // General failure
          db.prepare(`
            UPDATE ocr_queue 
            SET status = 'FAILED', 
                error_message = ?, 
                retry_count = retry_count + 1,
                processing_duration_ms = ?,
                completed_at = datetime('now', 'localtime')
            WHERE id = ?
          `).run(errorMsg, durationMs, item.id)

          ocrQueueEvents.emit('updated', {
            type: 'STATUS_CHANGED',
            itemId: item.id,
            status: 'FAILED',
            summary: getQueueSummaryCounts()
          })

          // Cooldown before next item
          await new Promise(resolve => setTimeout(resolve, MIN_DELAY_MS))
        }
      }
    }
  } finally {
    isQueueRunning = false
    ocrQueueEvents.emit('progress', {
      status: 'IDLE',
      currentIndex: 0,
      totalCount: 0,
      pendingCount: 0,
      estimatedSecondsRemaining: 0
    })
  }
}

/**
 * Initializes the OCR queue service on application startup.
 * Automatically recovers any stranded PROCESSING items from previous app exits.
 */
export function initOcrQueue() {
  const db = getDatabase()
  try {
    const recovered = db.prepare(`
      UPDATE ocr_queue 
      SET status = 'PENDING' 
      WHERE status = 'PROCESSING'
    `).run()

    if (recovered.changes > 0) {
      console.log(`[OCR-Queue] Recovered ${recovered.changes} stranded processing item(s) to PENDING`)
    }

    // If there are pending items, trigger the queue worker
    const pending = db.prepare(`SELECT COUNT(*) as count FROM ocr_queue WHERE status = 'PENDING'`).get() as any
    if (pending && pending.count > 0) {
      console.log(`[OCR-Queue] ${pending.count} pending items found on startup. Starting queue worker...`)
      runQueueWorker().catch(err => console.error('[OCR-Queue] Error in worker:', err))
    }
  } catch (err) {
    console.error('[OCR-Queue] Failed to initialize queue:', err)
  }
}

/**
 * Register all IPC handlers for the OCR Queue.
 */
export function registerOcrQueueHandlers() {
  const db = getDatabase()

  // 1. Enqueue files with SHA-256 deduplication
  ipcMain.handle(IPC_CHANNELS.OCR_QUEUE_ENQUEUE, async (_, payload: {
    files: Array<{ name: string; buffer: ArrayBuffer | Uint8Array; mimeType: string }>
  }) => {
    if (!payload?.files || payload.files.length === 0) {
      return { enqueuedCount: 0, skippedCount: 0, skippedItems: [] }
    }

    const checkHashStmt = db.prepare(`
      SELECT id, file_name, status FROM ocr_queue 
      WHERE image_hash = ? AND status IN ('PENDING', 'PROCESSING', 'READY', 'APPROVED')
      LIMIT 1
    `)

    const insertStmt = db.prepare(`
      INSERT INTO ocr_queue (
        image_hash, file_name, file_path, mime_type, file_size_bytes, status
      ) VALUES (?, ?, ?, ?, ?, 'PENDING')
    `)

    let enqueuedCount = 0
    const skippedItems: Array<{ fileName: string; reason: string }> = []

    for (const file of payload.files) {
      try {
        const rawBuf = Buffer.isBuffer(file.buffer) ? file.buffer : Buffer.from(file.buffer as any)
        const imageHash = crypto.createHash('sha256').update(rawBuf).digest('hex')

        // Check for deduplication
        const existing = checkHashStmt.get(imageHash) as { id: number; file_name: string; status: string } | undefined
        if (existing) {
          skippedItems.push({
            fileName: file.name,
            reason: `Invoice already exists in queue as #${existing.id} (${existing.status.toLowerCase()})`
          })
          continue
        }

        // Archive and compress to disk
        const savedFilePath = archiveInvoiceImage(rawBuf, file.mimeType)
        const fileStats = fs.existsSync(savedFilePath) ? fs.statSync(savedFilePath) : { size: rawBuf.length }

        insertStmt.run(
          imageHash,
          file.name,
          savedFilePath,
          file.mimeType,
          fileStats.size
        )

        enqueuedCount++
      } catch (err: any) {
        console.error(`[OCR-Queue] Error archiving file ${file.name}:`, err)
        skippedItems.push({
          fileName: file.name,
          reason: `Failed to save file: ${err.message || 'unknown error'}`
        })
      }
    }

    if (enqueuedCount > 0) {
      ocrQueueEvents.emit('updated', {
        type: 'ENQUEUED',
        summary: getQueueSummaryCounts()
      })

      // Kick off queue processor in background
      runQueueWorker().catch(e => console.error('[OCR-Queue] Error starting worker:', e))
    }

    return {
      enqueuedCount,
      skippedCount: skippedItems.length,
      skippedItems
    }
  })

  // 2. List queue items (LIGHTWEIGHT SUMMARY ONLY — excludes extracted_data_json)
  ipcMain.handle(IPC_CHANNELS.OCR_QUEUE_LIST, () => {
    const rows = db.prepare(`
      SELECT 
        id, image_hash, file_name, file_path, mime_type, file_size_bytes,
        status, error_message, vendor_name_preview, invoice_number_preview,
        invoice_date_preview, total_amount_preview, item_count, flagged_count,
        retry_count, processing_duration_ms, created_at, processed_at, completed_at
      FROM ocr_queue 
      ORDER BY id DESC
    `).all() as any[]

    return rows.map(r => ({
      id: r.id,
      imageHash: r.image_hash,
      fileName: r.file_name,
      filePath: r.file_path,
      mimeType: r.mime_type,
      fileSizeBytes: r.file_size_bytes,
      status: r.status as OcrQueueStatus,
      errorMessage: r.error_message,
      vendorNamePreview: r.vendor_name_preview,
      invoiceNumberPreview: r.invoice_number_preview,
      invoiceDatePreview: r.invoice_date_preview,
      totalAmountPreview: r.total_amount_preview,
      itemCount: r.item_count || 0,
      flaggedCount: r.flagged_count || 0,
      retryCount: r.retry_count,
      processingDurationMs: r.processing_duration_ms,
      createdAt: r.created_at,
      processedAt: r.processed_at,
      completedAt: r.completed_at
    })) as OcrQueueSummaryItem[]
  })

  // 3. Get single queue item WITH full extracted JSON (on-demand fetch)
  ipcMain.handle(IPC_CHANNELS.OCR_QUEUE_GET, (_, id: number) => {
    const row = db.prepare(`SELECT * FROM ocr_queue WHERE id = ?`).get(id) as any
    if (!row) return null

    let extractedData: OcrExtractionResult | null = null
    if (row.extracted_data_json) {
      try {
        extractedData = JSON.parse(row.extracted_data_json)
      } catch (e) {
        console.error(`[OCR-Queue] Failed to parse extracted_data_json for item #${id}:`, e)
      }
    }

    return {
      id: row.id,
      imageHash: row.image_hash,
      fileName: row.file_name,
      filePath: row.file_path,
      mimeType: row.mime_type,
      fileSizeBytes: row.file_size_bytes,
      status: row.status as OcrQueueStatus,
      errorMessage: row.error_message,
      vendorNamePreview: row.vendor_name_preview,
      invoiceNumberPreview: row.invoice_number_preview,
      invoiceDatePreview: row.invoice_date_preview,
      totalAmountPreview: row.total_amount_preview,
      itemCount: row.item_count || 0,
      flaggedCount: row.flagged_count || 0,
      retryCount: row.retry_count,
      processingDurationMs: row.processing_duration_ms,
      createdAt: row.created_at,
      processedAt: row.processed_at,
      completedAt: row.completed_at,
      extractedData
    } as OcrQueueItem
  })

  // 3b. Get physical file as base64 data URL for side-by-side invoice review
  ipcMain.handle(IPC_CHANNELS.OCR_QUEUE_GET_FILE, (_, id: number) => {
    const row = db.prepare(`SELECT file_path, mime_type, file_name FROM ocr_queue WHERE id = ?`).get(id) as {
      file_path: string
      mime_type: string
      file_name: string
    } | undefined

    if (!row || !row.file_path) {
      throw new Error(`Queue item #${id} not found`)
    }

    if (!fs.existsSync(row.file_path)) {
      throw new Error(`Source invoice file not found at: ${row.file_path}`)
    }

    const fileBuffer = fs.readFileSync(row.file_path)
    const mime = row.mime_type || (row.file_name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg')
    const base64 = fileBuffer.toString('base64')
    const dataUrl = `data:${mime};base64,${base64}`

    return {
      id,
      fileName: row.file_name,
      mimeType: mime,
      dataUrl
    }
  })

  // 4. Retry failed item
  ipcMain.handle(IPC_CHANNELS.OCR_QUEUE_RETRY, (_, id: number) => {
    const info = db.prepare(`
      UPDATE ocr_queue 
      SET status = 'PENDING', error_message = NULL 
      WHERE id = ? AND status = 'FAILED'
    `).run(id)

    if (info.changes > 0) {
      ocrQueueEvents.emit('updated', {
        type: 'STATUS_CHANGED',
        itemId: id,
        status: 'PENDING',
        summary: getQueueSummaryCounts()
      })
      runQueueWorker().catch(e => console.error('[OCR-Queue] Error starting worker:', e))
    }
    return { success: info.changes > 0 }
  })

  // 5. Update item status (e.g. APPROVED or DISCARDED)
  ipcMain.handle(IPC_CHANNELS.OCR_QUEUE_UPDATE_STATUS, (_, payload: { id: number; status: OcrQueueStatus }) => {
    const info = db.prepare(`
      UPDATE ocr_queue 
      SET status = ? 
      WHERE id = ?
    `).run(payload.status, payload.id)

    if (info.changes > 0) {
      ocrQueueEvents.emit('updated', {
        type: 'STATUS_CHANGED',
        itemId: payload.id,
        status: payload.status,
        summary: getQueueSummaryCounts()
      })
    }
    return { success: info.changes > 0 }
  })

  // 6. Delete queue item and remove physical file from disk
  ipcMain.handle(IPC_CHANNELS.OCR_QUEUE_DELETE, (_, id: number) => {
    const row = db.prepare(`SELECT file_path FROM ocr_queue WHERE id = ?`).get(id) as { file_path: string } | undefined
    if (row && row.file_path && fs.existsSync(row.file_path)) {
      try {
        fs.unlinkSync(row.file_path)
      } catch (e) {
        console.warn(`[OCR-Queue] Could not delete physical file ${row.file_path}:`, e)
      }
    }

    const info = db.prepare(`DELETE FROM ocr_queue WHERE id = ?`).run(id)

    if (info.changes > 0) {
      ocrQueueEvents.emit('updated', {
        type: 'DELETED',
        itemId: id,
        summary: getQueueSummaryCounts()
      })
    }
    return { success: info.changes > 0 }
  })

  // 7. Clear completed (APPROVED and DISCARDED)
  ipcMain.handle(IPC_CHANNELS.OCR_QUEUE_CLEAR_COMPLETED, () => {
    const rows = db.prepare(`
      SELECT id, file_path FROM ocr_queue 
      WHERE status IN ('APPROVED', 'DISCARDED')
    `).all() as Array<{ id: number; file_path: string }>

    for (const r of rows) {
      if (r.file_path && fs.existsSync(r.file_path)) {
        try {
          fs.unlinkSync(r.file_path)
        } catch (e) {}
      }
    }

    const info = db.prepare(`DELETE FROM ocr_queue WHERE status IN ('APPROVED', 'DISCARDED')`).run()

    if (info.changes > 0) {
      ocrQueueEvents.emit('updated', {
        type: 'CLEARED',
        summary: getQueueSummaryCounts()
      })
    }
    return { clearedCount: info.changes }
  })
}
