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
  paymentMode: 'CASH' | 'UPI' | 'CARD'

  subtotalPaise: number
  totalDiscountPaise: number
  cgstPaise: number
  sgstPaise: number
  igstPaise: number
  grandTotalPaise: number

  customerId?: number
  ownerPin?: string

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

import { verifyOwnerPin } from './user.service'
import { getCustomer } from './customer.service'

/**
 * Creates a new sale, deducts inventory, and records ledger movements.
 * This function executes entirely within a single SQLite transaction to guarantee atomicity.
 */
export async function createSale(payload: SalePayload): Promise<{ id: number; billNumber: string }> {
  const db = getDatabase()

  if (payload.paymentMode === 'CREDIT') {
    if (!payload.customerId) throw new Error('Customer is required for credit sales')
    const customer = getCustomer(payload.customerId)
    if (!customer) throw new Error('Customer not found')

    if (customer.current_balance_paise + payload.grandTotalPaise > customer.max_credit_limit_paise) {
      if (!payload.ownerPin) throw new Error('CREDIT_LIMIT_EXCEEDED')
      await verifyOwnerPin(payload.ownerPin)
    }
  }


  // Generate a unique bill number: MED-YYYYMMDD-NNNN
  const billNumber = (() => {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const countRow = db.prepare(`SELECT COUNT(*) as cnt FROM sales WHERE bill_number LIKE ?`).get(`MED-${today}%`) as { cnt: number }
    return `MED-${today}-${String(countRow.cnt + 1).padStart(4, '0')}`
  })()

  const insertSale = db.prepare(`
    INSERT INTO sales (
      bill_number, cashier_id, payment_mode, customer_name, customer_mobile, doctor_name, doctor_reg_no,
      subtotal_paise, discount_paise, cgst_paise, sgst_paise, igst_paise, total_paise, customer_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const insertSaleItem = db.prepare(`
    INSERT INTO sale_items (
      sale_id, product_id, batch_id, quantity, taxable_value_paise, unit_price_paise, discount_paise,
      cgst_paise, sgst_paise, igst_paise, total_paise
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const deductBatch = db.prepare(`
    UPDATE batches SET quantity = quantity - ? WHERE id = ? AND quantity >= ?
  `)

  const insertLedger = db.prepare(`
  INSERT INTO stock_ledger (
    batch_id,
    movement_type,
    quantity_delta,
    actor_user_id,
    reason,
    reference_entity
  ) VALUES (?, 'SALE_OUT', ?, ?, ?, ?)
`)

  // Wrap everything in a transaction
  const executeCheckout = db.transaction(() => {
    // 1. Create the Sale record
    const saleResult = insertSale.run(
      billNumber,
      payload.userId,
      payload.paymentMode,
      payload.patientName || null,
      payload.patientPhone || null,
      payload.doctorName || null,
      payload.doctorRegNo || null,
      payload.subtotalPaise,
      payload.totalDiscountPaise,
      payload.cgstPaise,
      payload.sgstPaise,
      payload.igstPaise,
      payload.grandTotalPaise,
      payload.customerId || null
    )

    const saleId = saleResult.lastInsertRowid as number

    if (payload.paymentMode === 'CREDIT' && payload.customerId) {
      db.prepare(`
        INSERT INTO customer_ledger (customer_id, transaction_type, amount_paise, reference_id)
        VALUES (?, 'CREDIT_SALE', ?, ?)
      `).run(payload.customerId, payload.grandTotalPaise, billNumber)

      db.prepare(`
        UPDATE customers 
        SET current_balance_paise = current_balance_paise + ?
        WHERE id = ?
      `).run(payload.grandTotalPaise, payload.customerId)
    }

    // 2. Process each line item
    for (const item of payload.items) {
      // Deduct stock (ensure atomic check to prevent negative inventory)
      const deductResult = deductBatch.run(item.quantityUnits, item.batchId, item.quantityUnits)
      if (deductResult.changes === 0) {
        throw new Error(`Insufficient stock for Product ID ${item.productId}, Batch ID ${item.batchId}`)
      }

      // Record Sale Item
      // taxable_value = (unit_price * qty) - (discount * qty) per Indian GST law
      const taxableValuePaise = (item.salePricePaise * item.quantityUnits) - (item.discountPaise * item.quantityUnits)
      insertSaleItem.run(
        saleId, item.productId, item.batchId, item.quantityUnits,
        taxableValuePaise, item.salePricePaise, item.discountPaise,
        item.cgstPaise, item.sgstPaise, item.igstPaise, item.lineTotalPaise
      )

      // Record Ledger Movement (quantity is negative for a sale)
      // Columns: batch_id, quantity_delta, actor_user_id, reason, reference_entity
      insertLedger.run(
        item.batchId,
        -item.quantityUnits,
        payload.userId,
        null,
        `SALE-${saleId}`
      )
    }

    return { id: saleId, billNumber }
  })

  // Execute the transaction
  return executeCheckout()
}

/**
 * Gets all active batches for a product with stock, sorted by Expiry Date (FEFO).
 * Used by POS billing — only shows sellable batches.
 */
export function getActiveBatchesForProduct(productId: number): any[] {
  const db = getDatabase()
  return db.prepare(`
    SELECT 
      id, 
      batch_number, 
      expiry_date,
      expiry_date as expiry_sort_date,
      strftime('%m/%Y', expiry_date) as expiry_date_str,
      quantity, 
      mrp_paise, 
      purchase_rate_paise 
    FROM batches
    WHERE product_id = ? AND status = 'ACTIVE' AND quantity > 0
    ORDER BY expiry_date ASC
  `).all(productId)
}

/**
 * Gets ALL batches for a product (including quarantined, expired, zero-stock).
 * Used by Inventory UI to give a full picture for management.
 */
export function getAllBatchesForProduct(productId: number): any[] {
  const db = getDatabase()
  return db.prepare(`
    SELECT 
      b.id, 
      b.batch_number, 
      b.expiry_date,
      b.expiry_date as expiry_sort_date,
      strftime('%m/%Y', b.expiry_date) as expiry_date_str,
      b.quantity, 
      b.mrp_paise, 
      b.purchase_rate_paise,
      b.gst_rate_pct,
      b.status,
      b.vendor_id,
      v.name as vendor_name,
      b.created_at
    FROM batches b
    LEFT JOIN vendors v ON b.vendor_id = v.id
    WHERE b.product_id = ?
    ORDER BY 
      CASE b.status 
        WHEN 'ACTIVE' THEN 0 
        WHEN 'QUARANTINED' THEN 1 
        WHEN 'EXPIRED' THEN 2 
        WHEN 'RETURNED' THEN 3 
        WHEN 'DISPOSED' THEN 4 
      END,
      b.expiry_date ASC
  `).all(productId)
}

// ── Sales Returns ──

export interface ReturnItemPayload {
  saleItemId: number
  quantity: number
}

export function processSalesReturn(saleId: number, userId: number, reason: string | null, items: ReturnItemPayload[]): { returnNumber: string } {
  const db = getDatabase()

  const returnNumber = (() => {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const countRow = db.prepare(`SELECT COUNT(*) as cnt FROM sales_returns WHERE return_number LIKE ?`).get(`RET-${today}%`) as { cnt: number }
    return `RET-${today}-${String(countRow.cnt + 1).padStart(4, '0')}`
  })()

  const executeReturn = db.transaction(() => {
    // 1. Create sales_return record first to get ID
    const insertReturn = db.prepare(`
      INSERT INTO sales_returns (original_sale_id, return_number, processed_by, reason, refund_amount_paise)
      VALUES (?, ?, ?, ?, 0)
    `).run(saleId, returnNumber, userId, reason || null)
    const returnId = insertReturn.lastInsertRowid as number

    let totalRefundPaise = 0

    // 2. Process items
    const getSaleItem = db.prepare(`SELECT * FROM sale_items WHERE id = ? AND sale_id = ?`)
    const insertReturnItem = db.prepare(`
      INSERT INTO sales_return_items (return_id, original_sale_item_id, batch_id, quantity, refund_paise)
      VALUES (?, ?, ?, ?, ?)
    `)
    const updateBatch = db.prepare(`UPDATE batches SET quantity = quantity + ? WHERE id = ?`)
    const insertLedger = db.prepare(`
      INSERT INTO stock_ledger (batch_id, movement_type, quantity_delta, actor_user_id, reason, reference_entity)
      VALUES (?, 'RETURN_IN', ?, ?, ?, ?)
    `)

    for (const reqItem of items) {
      if (reqItem.quantity <= 0) continue

      const saleItem = getSaleItem.get(reqItem.saleItemId, saleId) as any
      if (!saleItem) throw new Error(`Sale item ${reqItem.saleItemId} not found`)

      // Check if already returned
      const returnedRow = db.prepare(`SELECT COALESCE(SUM(quantity), 0) as qty FROM sales_return_items WHERE original_sale_item_id = ?`).get(reqItem.saleItemId) as { qty: number }
      const remainingAllowed = saleItem.quantity - returnedRow.qty

      if (reqItem.quantity > remainingAllowed) {
        throw new Error(`Cannot return ${reqItem.quantity}. Only ${remainingAllowed} remaining.`)
      }

      // Calculate refund exactly based on what was paid for this item
      // The customer paid 'total_paise' for the whole quantity of this line item
      const unitRefundPaise = Math.floor(saleItem.total_paise / saleItem.quantity)
      const lineRefundPaise = unitRefundPaise * reqItem.quantity
      totalRefundPaise += lineRefundPaise

      insertReturnItem.run(returnId, reqItem.saleItemId, saleItem.batch_id, reqItem.quantity, lineRefundPaise)
      updateBatch.run(reqItem.quantity, saleItem.batch_id)
      insertLedger.run(saleItem.batch_id, reqItem.quantity, userId, reason, `RET-${returnId}`)
    }

    if (totalRefundPaise === 0) throw new Error('No items to return')

    db.prepare(`UPDATE sales_returns SET refund_amount_paise = ? WHERE id = ?`).run(totalRefundPaise, returnId)

    // If original sale was CREDIT, refund goes to ledger
    const originalSale = db.prepare(`SELECT payment_mode, customer_id FROM sales WHERE id = ?`).get(saleId) as any
    if (originalSale.payment_mode === 'CREDIT' && originalSale.customer_id) {
      db.prepare(`
        INSERT INTO customer_ledger (customer_id, transaction_type, amount_paise, reference_id)
        VALUES (?, 'ADJUSTMENT', ?, ?)
      `).run(originalSale.customer_id, -totalRefundPaise, returnNumber) // negative amount to reduce balance

      db.prepare(`
        UPDATE customers 
        SET current_balance_paise = current_balance_paise - ?
        WHERE id = ?
      `).run(totalRefundPaise, originalSale.customer_id)
    }

    return { returnNumber }
  })

  return executeReturn()
}

export function listSales(limit = 100): any[] {
  const db = getDatabase()
  const sales = db.prepare(`
    SELECT 
      s.id, s.bill_number, s.customer_name, s.customer_mobile, s.payment_mode, 
      s.total_paise, s.created_at, u.display_name as cashier_name
    FROM sales s
    LEFT JOIN users u ON s.cashier_id = u.id
    ORDER BY s.created_at DESC
    LIMIT ?
  `).all(limit) as any[]

  const getItems = db.prepare(`
    SELECT si.id as saleItemId, si.quantity, si.unit_price_paise, si.total_paise, 
           b.batch_number, p.brand_name
    FROM sale_items si
    JOIN batches b ON si.batch_id = b.id
    JOIN products p ON b.product_id = p.id
    WHERE si.sale_id = ?
  `)

  const getReturned = db.prepare(`
    SELECT COALESCE(SUM(quantity), 0) as qty FROM sales_return_items WHERE original_sale_item_id = ?
  `)

  return sales.map(sale => {
    const items = getItems.all(sale.id).map((item: any) => {
      const returnedQty = (getReturned.get(item.saleItemId) as any).qty
      return { ...item, returnedQty, returnableQty: item.quantity - returnedQty }
    })
    return { ...sale, items }
  })
}

// ── IPC Handlers ──

// ── IPC Handlers ──

export function registerSalesHandlers() {
  ipcMain.handle(IPC_CHANNELS.SALES_CREATE, async (_, payload: SalePayload) => {
    return await createSale(payload)
  })

  ipcMain.handle(IPC_CHANNELS.SALES_RETURN, (_, { saleId, userId, reason, items }) => {
    return processSalesReturn(saleId, userId, reason, items)
  })

  ipcMain.handle(IPC_CHANNELS.SALES_LIST, () => {
    return listSales()
  })

  ipcMain.handle(IPC_CHANNELS.BATCHES_LIST_BY_PRODUCT, (_, productId: number) => {
    return getAllBatchesForProduct(productId)
  })

  ipcMain.handle(IPC_CHANNELS.SALES_GET, (_, saleId: number) => {
    return getSaleForReceipt(saleId)
  })
}

export function getSaleForReceipt(saleId: number) {
  const db = getDatabase()

  const saleRow = db.prepare(`
    SELECT * FROM sales WHERE id = ?
  `).get(saleId) as any

  if (!saleRow) throw new Error('Sale not found')

  const itemsRows = db.prepare(`
    SELECT 
      si.*,
      b.batch_number, b.expiry_date,
      p.brand_name, p.pack_size, p.gst_rate_pct
    FROM sale_items si
    JOIN batches b ON si.batch_id = b.id
    JOIN products p ON b.product_id = p.id
    WHERE si.sale_id = ?
  `).all(saleId) as any[]

  // Reconstruct to match what PRINT_RECEIPT expects
  const sale = {
    billNumber: saleRow.bill_number,
    patientName: saleRow.customer_name,
    patientPhone: saleRow.customer_mobile,
    doctorName: saleRow.doctor_name,
    doctorRegNo: saleRow.doctor_reg_no,
    paymentMode: saleRow.payment_mode,
    subtotalPaise: saleRow.subtotal_paise,
    totalDiscountPaise: saleRow.discount_paise,
    totalTaxPaise: saleRow.cgst_paise + saleRow.sgst_paise + saleRow.igst_paise,
    grandTotalPaise: saleRow.total_paise
  }

  const items = itemsRows.map(row => ({
    productId: row.product_id,
    brandName: row.brand_name,
    batchNumber: row.batch_number,
    quantityUnits: row.quantity,
    packSize: row.pack_size,
    mrpPaise: (row.unit_price_paise * row.quantity) / row.quantity, // unit_price_paise is sale price per unit
    salePricePaise: row.unit_price_paise,
    discountPaise: row.discount_paise,
    gstRatePct: row.gst_rate_pct,
    gstBreakdown: {
      cgstPaise: row.cgst_paise,
      sgstPaise: row.sgst_paise,
      igstPaise: row.igst_paise,
      lineTotalPaise: row.total_paise
    }
  }))

  return { sale, items }
}
