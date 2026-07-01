import { getDatabase } from './db.service'
import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'

export interface PurchasePayload {
  userId: number
  vendorId: number
  invoiceNumber: string
  invoiceDate: string // YYYY-MM-DD
  totalAmountPaise: number
  items: PurchaseItemPayload[]
}

export interface PurchaseItemPayload {
  productId: number
  batchNumber: string
  expiryYear: number
  expiryMonth: number
  quantityPacks: number
  quantityUnits: number
  mrpPaise: number
  purchaseRatePaise: number
  gstRatePct: number
  totalPaise: number
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
      vendor_id, invoice_number, invoice_date, source, verification_status, verified_by, total_amount_paise
    ) VALUES (?, ?, ?, 'MANUAL', 'VERIFIED', ?, ?)
  `)

  const insertPurchaseItem = db.prepare(`
    INSERT INTO purchase_items (
      purchase_invoice_id, product_id, batch_number, expiry_year, expiry_month,
      quantity_packs, quantity_units, mrp_paise, purchase_rate_paise, gst_rate_pct, total_paise
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  // Upsert batch (if exact batch + expiry exists for this product, add to quantity. Otherwise create new)
  // SQLite 3.24+ supports UPSERT (ON CONFLICT), but since we don't have a UNIQUE constraint covering
  // (product_id, vendor_id, batch_number, expiry_year, expiry_month), we must manually check or use
  // a targeted query. A pharmacy usually just accumulates stock into the exact same batch if it exists.
  
  const findBatch = db.prepare(`
    SELECT id, quantity FROM batches 
    WHERE product_id = ? AND batch_number = ? AND expiry_year = ? AND expiry_month = ?
  `)

  const insertBatch = db.prepare(`
    INSERT INTO batches (
      product_id, vendor_id, purchase_item_id, batch_number, expiry_year, expiry_month,
      quantity, mrp_paise, purchase_rate_paise, gst_rate_pct, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
  `)

  const updateBatchQty = db.prepare(`
    UPDATE batches SET quantity = quantity + ?, mrp_paise = ?, purchase_rate_paise = ? WHERE id = ?
  `)

  const insertMovement = db.prepare(`
    INSERT INTO stock_movements (
      batch_id, movement_type, quantity_delta, actor_user_id, reason, reference_entity
    ) VALUES (?, 'PURCHASE_IN', ?, ?, 'Manual Purchase Entry', ?)
  `)

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
      payload.userId, 
      payload.totalAmountPaise
    )
    const invoiceId = invResult.lastInsertRowid as number

    // Process Items
    for (const item of payload.items) {
      // Insert purchase item record
      const pItemResult = insertPurchaseItem.run(
        invoiceId,
        item.productId,
        item.batchNumber,
        item.expiryYear,
        item.expiryMonth,
        item.quantityPacks,
        item.quantityUnits,
        item.mrpPaise,
        item.purchaseRatePaise,
        item.gstRatePct,
        item.totalPaise
      )
      const purchaseItemId = pItemResult.lastInsertRowid as number

      // Update or Create Batch
      const existingBatch = findBatch.get(
        item.productId, 
        item.batchNumber, 
        item.expiryYear, 
        item.expiryMonth
      ) as { id: number, quantity: number } | undefined

      let batchId: number

      if (existingBatch) {
        batchId = existingBatch.id
        // Accumulate quantity and update prices to the latest purchase rate
        updateBatchQty.run(item.quantityUnits, item.mrpPaise, item.purchaseRatePaise, batchId)
      } else {
        const batchResult = insertBatch.run(
          item.productId,
          payload.vendorId,
          purchaseItemId,
          item.batchNumber,
          item.expiryYear,
          item.expiryMonth,
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

export function registerPurchaseHandlers() {
  ipcMain.handle(IPC_CHANNELS.PURCHASES_CREATE, (_, payload: PurchasePayload) => {
    return createPurchase(payload)
  })
}
