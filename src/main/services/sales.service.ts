import { getDatabase } from './db.service'
import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import { APP_DEFAULTS } from '../../shared/constants'

export interface SalePayload {
  userId: number
  patientName: string | null
  patientPhone: string | null
  doctorName: string | null
  doctorRegNo: string | null
  
  subtotalPaise: number
  totalDiscountPaise: number
  cgstPaise: number
  sgstPaise: number
  igstPaise: number
  grandTotalPaise: number
  
  items: SaleItemPayload[]
}

export interface SaleItemPayload {
  productId: number
  batchId: number
  quantityUnits: number
  mrpPaise: number
  salePricePaise: number
  discountPaise: number
  cgstPaise: number
  sgstPaise: number
  igstPaise: number
  lineTotalPaise: number
}

/**
 * Creates a new sale, deducts inventory, and records ledger movements.
 * This function executes entirely within a single SQLite transaction to guarantee atomicity.
 */
export function createSale(payload: SalePayload): number {
  const db = getDatabase()
  
  const insertSale = db.prepare(`
    INSERT INTO sales (
      user_id, status, patient_name, patient_phone, doctor_name, doctor_reg_no,
      subtotal_paise, total_discount_paise, cgst_paise, sgst_paise, igst_paise, grand_total_paise
    ) VALUES (?, 'COMPLETED', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const insertSaleItem = db.prepare(`
    INSERT INTO sale_items (
      sale_id, product_id, batch_id, quantity, mrp_paise, sale_price_paise, discount_paise,
      cgst_paise, sgst_paise, igst_paise, line_total_paise
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const deductBatch = db.prepare(`
    UPDATE batches SET quantity = quantity - ? WHERE id = ? AND quantity >= ?
  `)

  const insertLedger = db.prepare(`
    INSERT INTO stock_ledger (
      product_id, batch_id, type, quantity, reference_id, user_id
    ) VALUES (?, ?, 'SALE', ?, ?, ?)
  `)

  // Wrap everything in a transaction
  const executeCheckout = db.transaction(() => {
    // 1. Create the Sale record
    const saleResult = insertSale.run(
      payload.userId,
      payload.patientName || null,
      payload.patientPhone || null,
      payload.doctorName || null,
      payload.doctorRegNo || null,
      payload.subtotalPaise,
      payload.totalDiscountPaise,
      payload.cgstPaise,
      payload.sgstPaise,
      payload.igstPaise,
      payload.grandTotalPaise
    )
    
    const saleId = saleResult.lastInsertRowid as number

    // 2. Process each line item
    for (const item of payload.items) {
      // Deduct stock (ensure atomic check to prevent negative inventory)
      const deductResult = deductBatch.run(item.quantityUnits, item.batchId, item.quantityUnits)
      if (deductResult.changes === 0) {
        throw new Error(`Insufficient stock for Product ID ${item.productId}, Batch ID ${item.batchId}`)
      }

      // Record Sale Item
      insertSaleItem.run(
        saleId, item.productId, item.batchId, item.quantityUnits,
        item.mrpPaise, item.salePricePaise, item.discountPaise,
        item.cgstPaise, item.sgstPaise, item.igstPaise, item.lineTotalPaise
      )

      // Record Ledger Movement (quantity is negative for a sale)
      insertLedger.run(
        item.productId, item.batchId, -item.quantityUnits, saleId, payload.userId
      )
    }

    return saleId
  })

  // Execute the transaction
  return executeCheckout()
}

/**
 * Gets all active batches for a product, sorted by Expiry Date (FIFO).
 */
export function getActiveBatchesForProduct(productId: number): any[] {
  const db = getDatabase()
  return db.prepare(`
    SELECT id, batch_number, expiry_date, quantity, mrp_paise, purchase_rate_paise, sale_price_paise
    FROM batches
    WHERE product_id = ? AND status = 'ACTIVE' AND quantity > 0
    ORDER BY expiry_date ASC
  `).all(productId)
}

// ── IPC Handlers ──

export function registerSalesHandlers() {
  ipcMain.handle(IPC_CHANNELS.SALES_CREATE, (_, payload: SalePayload) => {
    return createSale(payload)
  })

  ipcMain.handle(IPC_CHANNELS.BATCHES_LIST_BY_PRODUCT, (_, productId: number) => {
    return getActiveBatchesForProduct(productId)
  })
}
