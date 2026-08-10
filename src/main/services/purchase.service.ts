import { getDatabase } from './db.service'
import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import { saveVendorOcrCorrection } from './vendor-ocr-profile.service'
import type { OcrExtractionResult } from '../../shared/types'

export interface PurchasePayload {
  userId: number
  vendorId: number
  invoiceNumber: string
  invoiceDate: string // YYYY-MM-DD
  source?: 'MANUAL' | 'OCR'
  totalAmountPaise: number
  items: PurchaseItemPayload[]
}

export interface PurchaseItemPayload {
  productId: number
  batchNumber: string
  expiryDate: string // YYYY-MM-DD (last day of expiry month)
  quantityPacks: number
  quantityUnits: number
  mrpPaise: number
  purchaseRatePaise: number
  netRatePaise: number
  gstRatePct: number
  totalPaise: number
}

export interface PurchaseInvoiceListItem {
  id: number
  vendor_id: number
  vendor_name: string
  vendor_gstin: string | null
  invoice_number: string
  invoice_date: string
  source: 'MANUAL' | 'OCR'
  total_amount_paise: number
  item_count: number
  verified_by_name: string | null
  created_at: string
}

export interface PurchaseInvoiceDetails extends PurchaseInvoiceListItem {
  items: Array<{
    id: number
    product_id: number
    product_name: string
    composition_name: string | null
    schedule_flag: string | null
    batch_number: string
    expiry_date: string
    quantity_packs: number
    quantity_units: number
    mrp_paise: number
    purchase_rate_paise: number
    net_rate_paise: number
    gst_rate_pct: number
    total_paise: number
  }>
}

/**
 * Creates a new purchase invoice, updates/creates batches, and logs stock movements.
 * Everything runs inside a single SQLite transaction.
 */
export function createPurchase(payload: PurchasePayload): number {
  const db = getDatabase()

  // 1. Prepare statements
  const insertInvoice = db.prepare(`
    INSERT INTO purchase_invoices (
      vendor_id, invoice_number, invoice_date, source, verification_status, verified_by, total_amount_paise, created_at
    ) VALUES (?, ?, ?, ?, 'VERIFIED', ?, ?, ?)
  `)

  const insertPurchaseItem = db.prepare(`
    INSERT INTO purchase_items (
      purchase_invoice_id, product_id, batch_number, expiry_date,
      quantity_packs, quantity_units, mrp_paise, purchase_rate_paise, net_rate_paise, gst_rate_pct, total_paise
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  // Batch identity includes price points to handle DPCO price revisions.
  // Same batch number with different MRP = separate stock lots (legally required).
  const findBatch = db.prepare(`
    SELECT id, quantity FROM batches 
    WHERE product_id = ? AND batch_number = ? AND expiry_date = ?
      AND mrp_paise = ? AND purchase_rate_paise = ?
      AND is_active = 1
  `)

  const insertBatch = db.prepare(`
    INSERT INTO batches (
      product_id, vendor_id, purchase_item_id, batch_number, expiry_date,
      quantity, mrp_paise, purchase_rate_paise, gst_rate_pct, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
  `)

  // Price overwrite is no longer needed since findBatch already matches on exact price.
  // Only accumulate quantity for genuine re-orders of identical stock.
  const updateBatchQty = db.prepare(`
    UPDATE batches SET quantity = quantity + ? WHERE id = ?
  `)

  const insertMovement = db.prepare(`
    INSERT INTO stock_ledger (
      batch_id, movement_type, quantity_delta, actor_user_id, reason, reference_entity
    ) VALUES (?, 'PURCHASE_IN', ?, ?, 'Purchase Entry', ?)
  `)

  // Server-side recalculation & validation of purchase totals
  const getProduct = db.prepare('SELECT pack_size FROM products WHERE id = ?')
  let calculatedInvoiceTotalPaise = 0

  for (const item of payload.items) {
    const product = getProduct.get(item.productId) as { pack_size: number } | undefined
    const packSize = product?.pack_size ?? 1

    if (item.quantityUnits < item.quantityPacks * packSize) {
      throw new Error(`Quantity units mismatch for Product ID ${item.productId}: expected at least ${item.quantityPacks * packSize}, got ${item.quantityUnits}`)
    }

    const calculatedLineTotal = item.totalPaise > 0 ? item.totalPaise : Math.round((item.netRatePaise || item.purchaseRatePaise) * item.quantityPacks)
    calculatedInvoiceTotalPaise += calculatedLineTotal
  }

  const finalInvoiceTotalPaise = payload.totalAmountPaise > 0 
    ? payload.totalAmountPaise 
    : calculatedInvoiceTotalPaise

  // Allow up to ₹1.00 (100 paise) tolerance for invoice level tax rounding differences
  if (payload.totalAmountPaise > 0 && Math.abs(payload.totalAmountPaise - calculatedInvoiceTotalPaise) > 100) {
    throw new Error('PURCHASE_TOTAL_MISMATCH')
  }

  // 2. Execute Transaction
  const executePurchase = db.transaction(() => {
    // Check if invoice already exists for this vendor to prevent duplicates
    const existing = db.prepare(`SELECT id FROM purchase_invoices WHERE vendor_id = ? AND invoice_number = ?`).get(payload.vendorId, payload.invoiceNumber)
    if (existing) {
      throw new Error(`Invoice ${payload.invoiceNumber} from this vendor already exists.`)
    }

    // Insert Invoice
    const invResult = insertInvoice.run(
      payload.vendorId,
      payload.invoiceNumber,
      payload.invoiceDate,
      payload.source || 'MANUAL',
      payload.userId,
      finalInvoiceTotalPaise,
      new Date().toISOString()
    )
    const invoiceId = invResult.lastInsertRowid as number

    // Update Vendor Ledger & Balance
    db.prepare(`
      INSERT INTO vendor_ledger (vendor_id, transaction_type, amount_paise, reference_id)
      VALUES (?, 'PURCHASE_INVOICE', ?, ?)
    `).run(payload.vendorId, finalInvoiceTotalPaise, payload.invoiceNumber)

    db.prepare(`
      UPDATE vendors
      SET current_balance_paise = COALESCE(current_balance_paise, 0) + ?
      WHERE id = ?
    `).run(finalInvoiceTotalPaise, payload.vendorId)

    // Process Items
    for (const item of payload.items) {
      const normalizedBatchNumber = item.batchNumber.trim().toUpperCase()

      // Insert purchase item record
      const pItemResult = insertPurchaseItem.run(
        invoiceId,
        item.productId,
        normalizedBatchNumber,
        item.expiryDate,
        item.quantityPacks,
        item.quantityUnits,
        item.mrpPaise,
        item.purchaseRatePaise,
        item.netRatePaise,
        item.gstRatePct,
        item.totalPaise
      )
      const purchaseItemId = pItemResult.lastInsertRowid as number

      // Update or Create Batch
      const existingBatch = findBatch.get(
        item.productId,
        normalizedBatchNumber,
        item.expiryDate,
        item.mrpPaise,
        item.purchaseRatePaise
      ) as { id: number, quantity: number } | undefined

      let batchId: number

      if (existingBatch) {
        batchId = existingBatch.id
        // Accumulate quantity (prices already match since findBatch includes price in WHERE)
        updateBatchQty.run(item.quantityUnits, batchId)
      } else {
        const batchResult = insertBatch.run(
          item.productId,
          payload.vendorId,
          purchaseItemId,
          normalizedBatchNumber,
          item.expiryDate,
          item.quantityUnits,
          item.mrpPaise,
          item.purchaseRatePaise,
          item.gstRatePct
        )
        batchId = batchResult.lastInsertRowid as number
      }

      // Record Stock Movement (Ledger)
      insertMovement.run(
        batchId,
        item.quantityUnits, // positive delta for purchase
        payload.userId,
        `INV-${invoiceId}`
      )
    }

    return invoiceId
  })

  return executePurchase()
}

export function listPurchaseInvoices(filters?: {
  vendorId?: number
  source?: 'MANUAL' | 'OCR'
  startDate?: string
  endDate?: string
  search?: string
}): PurchaseInvoiceListItem[] {
  const db = getDatabase()
  let sql = `
    SELECT 
      pi.id,
      pi.vendor_id,
      v.name as vendor_name,
      v.gstin as vendor_gstin,
      pi.invoice_number,
      pi.invoice_date,
      pi.source,
      pi.total_amount_paise,
      (SELECT COUNT(*) FROM purchase_items pit WHERE pit.purchase_invoice_id = pi.id) as item_count,
      u.display_name as verified_by_name,
      pi.created_at
    FROM purchase_invoices pi
    JOIN vendors v ON pi.vendor_id = v.id
    LEFT JOIN users u ON pi.verified_by = u.id
    WHERE 1=1
  `
  const params: any[] = []

  if (filters?.vendorId) {
    sql += ` AND pi.vendor_id = ?`
    params.push(filters.vendorId)
  }

  if (filters?.source) {
    sql += ` AND pi.source = ?`
    params.push(filters.source)
  }

  if (filters?.startDate) {
    sql += ` AND pi.invoice_date >= ?`
    params.push(filters.startDate)
  }

  if (filters?.endDate) {
    sql += ` AND pi.invoice_date <= ?`
    params.push(filters.endDate)
  }

  if (filters?.search) {
    sql += ` AND (pi.invoice_number LIKE ? OR v.name LIKE ?)`
    params.push(`%${filters.search}%`, `%${filters.search}%`)
  }

  sql += ` ORDER BY pi.invoice_date DESC, pi.id DESC`

  return db.prepare(sql).all(...params) as PurchaseInvoiceListItem[]
}

export function getPurchaseInvoiceDetails(invoiceId: number): PurchaseInvoiceDetails | null {
  const db = getDatabase()
  const invoice = db.prepare(`
    SELECT 
      pi.id,
      pi.vendor_id,
      v.name as vendor_name,
      v.gstin as vendor_gstin,
      pi.invoice_number,
      pi.invoice_date,
      pi.source,
      pi.total_amount_paise,
      (SELECT COUNT(*) FROM purchase_items pit WHERE pit.purchase_invoice_id = pi.id) as item_count,
      u.display_name as verified_by_name,
      pi.created_at
    FROM purchase_invoices pi
    JOIN vendors v ON pi.vendor_id = v.id
    LEFT JOIN users u ON pi.verified_by = u.id
    WHERE pi.id = ?
  `).get(invoiceId) as PurchaseInvoiceListItem | undefined

  if (!invoice) return null

  const items = db.prepare(`
    SELECT 
      pit.id,
      pit.product_id,
      p.brand_name as product_name,
      CASE WHEN c.id IS NOT NULL THEN (c.salt_name || ' ' || c.strength) ELSE NULL END as composition_name,
      p.schedule_flag,
      pit.batch_number,
      pit.expiry_date,
      pit.quantity_packs,
      pit.quantity_units,
      pit.mrp_paise,
      pit.purchase_rate_paise,
      pit.net_rate_paise,
      pit.gst_rate_pct,
      pit.total_paise
    FROM purchase_items pit
    JOIN products p ON pit.product_id = p.id
    LEFT JOIN compositions c ON p.composition_id = c.id
    WHERE pit.purchase_invoice_id = ?
  `).all(invoiceId) as any[]

  return {
    ...invoice,
    items
  }
}

/**
 * Diff the original Gemini extraction against the owner's corrected values.
 * Returns an array of field-level corrections (only fields that actually changed).
 */
function diffOcrExtraction(
  rawExtraction: Record<string, unknown>,
  correctedValues: {
    vendorName?: string | null
    invoiceNumber?: string | null
    invoiceDate?: string | null
    items: Array<{
      batchNumber?: string
      expiryMonth?: number
      expiryYear?: number
      mrp?: number
      purchaseRate?: number
      productName?: string
    }>
  }
): { field: string; wrongValue: string; correctedValue: string }[] {
  const diffs: { field: string; wrongValue: string; correctedValue: string }[] = []

  // Header-level diffs
  const headerFields: Array<[string, unknown, unknown]> = [
    ['vendorName', rawExtraction.vendorName, correctedValues.vendorName],
    ['invoiceNumber', rawExtraction.invoiceNumber, correctedValues.invoiceNumber],
    ['invoiceDate', rawExtraction.invoiceDate, correctedValues.invoiceDate],
  ]

  for (const [field, rawVal, correctedVal] of headerFields) {
    const raw = String(rawVal ?? '')
    const corrected = String(correctedVal ?? '')
    if (raw !== corrected) {
      diffs.push({ field, wrongValue: raw, correctedValue: corrected })
    }
  }

  // Item-level diffs (compare by index)
  const rawItems = (rawExtraction.items as Array<Record<string, unknown>>) || []
  for (let i = 0; i < Math.min(rawItems.length, correctedValues.items.length); i++) {
    const rawItem = rawItems[i]
    const corrItem = correctedValues.items[i]

    const itemFields: Array<[string, unknown, unknown]> = [
      [`items[${i}].batchNumber`, rawItem.batchNumber, corrItem.batchNumber],
      [`items[${i}].expiryMonth`, rawItem.expiryMonth, corrItem.expiryMonth],
      [`items[${i}].expiryYear`, rawItem.expiryYear, corrItem.expiryYear],
      [`items[${i}].mrp`, rawItem.mrp, corrItem.mrp],
      [`items[${i}].purchaseRate`, rawItem.purchaseRate, corrItem.purchaseRate],
      [`items[${i}].productName`, rawItem.productName, corrItem.productName],
    ]

    for (const [field, rawVal, correctedVal] of itemFields) {
      const raw = String(rawVal ?? '')
      const corrected = String(correctedVal ?? '')
      if (raw !== corrected) {
        diffs.push({ field, wrongValue: raw, correctedValue: corrected })
      }
    }
  }

  return diffs
}

export function registerPurchaseHandlers() {
  ipcMain.handle(IPC_CHANNELS.PURCHASES_CREATE, (_, payload: PurchasePayload) => {
    return createPurchase(payload)
  })

  ipcMain.handle(IPC_CHANNELS.PURCHASES_LIST, (_, filters) => {
    return listPurchaseInvoices(filters)
  })

  ipcMain.handle(IPC_CHANNELS.PURCHASES_GET, (_, id: number) => {
    return getPurchaseInvoiceDetails(id)
  })

  ipcMain.handle(IPC_CHANNELS.PURCHASES_APPROVE_OCR, (_, payload: {
    purchase: PurchasePayload
    rawExtraction: Record<string, unknown>
    correctedValues: {
      vendorName?: string | null
      invoiceNumber?: string | null
      invoiceDate?: string | null
      items: Array<{
        batchNumber?: string
        expiryMonth?: number
        expiryYear?: number
        mrp?: number
        purchaseRate?: number
        productName?: string
      }>
    }
  }) => {
    payload.purchase.source = 'OCR'
    // 1. Commit the purchase — this is the critical path
    const invoiceId = createPurchase(payload.purchase)

    // 2. Best-effort correction learning — NEVER blocks the purchase
    try {
      const diffs = diffOcrExtraction(payload.rawExtraction, payload.correctedValues)
      if (diffs.length > 0 && payload.purchase.vendorId) {
        saveVendorOcrCorrection(payload.purchase.vendorId, diffs)
        console.log(`[OCR-Learn] Saved ${diffs.length} correction(s) for vendor ${payload.purchase.vendorId}`)
      }
    } catch (err) {
      console.error('[OCR-Learn] Failed to save vendor corrections (non-blocking):', err)
    }

    return invoiceId
  })
}
