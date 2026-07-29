import { getDatabase } from './db.service'
import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import { APP_DEFAULTS } from '../../shared/constants'
import { calculateItemGst, aggregateGst, GstBreakdown } from '../../shared/utils/gst'

export interface SalePayload {
  userId: number
  patientName: string | null
  patientPhone: string | null
  doctorName: string | null
  doctorRegNo: string | null
  paymentMode: 'CASH' | 'UPI' | 'CARD' | 'CREDIT'

  subtotalPaise: number
  totalDiscountPaise: number
  cgstPaise: number
  sgstPaise: number
  igstPaise: number
  grandTotalPaise: number

  customerId?: number
  ownerPin?: string
  isInterState?: boolean

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
 * Recalculates and verifies all financial and GST amounts on the server to prevent payload tampering.
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

  // Statements for processing checkout
  const getBatchInfo = db.prepare(`
    SELECT b.product_id, b.gst_rate_pct, b.mrp_paise, b.purchase_rate_paise
    FROM batches b WHERE b.id = ?
  `)

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

  // Pre-validate & calculate all items on server
  const computedItems: Array<{
    payloadItem: SaleItemPayload
    breakdown: GstBreakdown
  }> = []

  const isInterState = !!payload.isInterState

  for (const item of payload.items) {
    if (item.quantityUnits <= 0) {
      throw new Error(`Invalid item quantity ${item.quantityUnits} for product ${item.productId}`)
    }
    const batch = getBatchInfo.get(item.batchId) as { product_id: number; gst_rate_pct: number; mrp_paise: number } | undefined
    if (!batch) {
      throw new Error(`Batch ID ${item.batchId} not found`)
    }

    const gstRatePct = batch.gst_rate_pct ?? 0
    const breakdown = calculateItemGst(
      item.salePricePaise,
      item.discountPaise,
      item.quantityUnits,
      gstRatePct,
      isInterState
    )

    computedItems.push({ payloadItem: item, breakdown })
  }

  const aggregateTotals = aggregateGst(computedItems.map(c => c.breakdown))

  // Allow max 1 paise rounding tolerance between client & server calculations
  if (Math.abs(aggregateTotals.lineTotalPaise - payload.grandTotalPaise) > 1) {
    throw new Error(`PAYLOAD_TOTAL_MISMATCH: Server calculated ${aggregateTotals.lineTotalPaise} paise, but payload supplied ${payload.grandTotalPaise} paise`)
  }

  // Wrap everything in a transaction
  const executeCheckout = db.transaction(() => {
    // 1. Create the Sale record using server-verified financial totals
    const saleResult = insertSale.run(
      billNumber,
      payload.userId,
      payload.paymentMode,
      payload.patientName || null,
      payload.patientPhone || null,
      payload.doctorName || null,
      payload.doctorRegNo || null,
      aggregateTotals.taxableValuePaise,
      payload.totalDiscountPaise,
      aggregateTotals.cgstPaise,
      aggregateTotals.sgstPaise,
      aggregateTotals.igstPaise,
      aggregateTotals.lineTotalPaise,
      payload.customerId || null
    )

    const saleId = saleResult.lastInsertRowid as number

    if (payload.paymentMode === 'CREDIT' && payload.customerId) {
      db.prepare(`
        INSERT INTO customer_ledger (customer_id, transaction_type, amount_paise, reference_id)
        VALUES (?, 'CREDIT_SALE', ?, ?)
      `).run(payload.customerId, aggregateTotals.lineTotalPaise, billNumber)

      db.prepare(`
        UPDATE customers 
        SET current_balance_paise = current_balance_paise + ?
        WHERE id = ?
      `).run(aggregateTotals.lineTotalPaise, payload.customerId)
    }

    // 2. Process each line item
    for (const { payloadItem, breakdown } of computedItems) {
      // Deduct stock (ensure atomic check to prevent negative inventory)
      const deductResult = deductBatch.run(payloadItem.quantityUnits, payloadItem.batchId, payloadItem.quantityUnits)
      if (deductResult.changes === 0) {
        throw new Error(`Insufficient stock for Product ID ${payloadItem.productId}, Batch ID ${payloadItem.batchId}`)
      }

      // Record Sale Item with GST-inclusive reverse-calculated taxable value
      insertSaleItem.run(
        saleId,
        payloadItem.productId,
        payloadItem.batchId,
        payloadItem.quantityUnits,
        breakdown.taxableValuePaise,
        payloadItem.salePricePaise,
        payloadItem.discountPaise,
        breakdown.cgstPaise,
        breakdown.sgstPaise,
        breakdown.igstPaise,
        breakdown.lineTotalPaise
      )

      // Record Ledger Movement (quantity is negative for a sale)
      insertLedger.run(
        payloadItem.batchId,
        -payloadItem.quantityUnits,
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
      // Get previously refunded amount for this sale item to ensure no paise leakage
      const previouslyRefundedRow = db.prepare(`SELECT COALESCE(SUM(refund_paise), 0) as amount FROM sales_return_items WHERE original_sale_item_id = ?`).get(reqItem.saleItemId) as { amount: number }
      
      let lineRefundPaise: number
      if (reqItem.quantity === remainingAllowed) {
        // If returning all remaining items, refund the exact remaining balance of the line item total
        lineRefundPaise = saleItem.total_paise - previouslyRefundedRow.amount
      } else {
        // Pro-rate based on quantity and round to nearest paise
        lineRefundPaise = Math.round((saleItem.total_paise * reqItem.quantity) / saleItem.quantity)
      }

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

import { SalePayloadSchema } from '../../shared/schemas'

export function registerSalesHandlers() {
  ipcMain.handle(IPC_CHANNELS.SALES_CREATE, async (_, payload: SalePayload) => {
    const validatedPayload = SalePayloadSchema.parse(payload)
    return await createSale(validatedPayload as SalePayload)
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
