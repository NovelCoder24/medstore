import { getDatabase } from './db.service'
import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import { ProductCategory, ScheduleFlag, APP_DEFAULTS } from '../../shared/constants'
import { Composition } from './composition.service'
import { logAuditAction } from './audit.service'

export interface Product {
  id: number
  brand_name: string
  generic_name: string | null
  manufacturer: string | null
  category: ProductCategory
  composition_id: number | null
  pack_size: number
  barcode: string | null
  hsn_code: string | null
  gst_rate_pct: number
  schedule_flag: ScheduleFlag
  shelf_rack: string | null
  is_active: boolean
  created_at: string
  // Joined fields
  composition?: Composition
  total_stock_units?: number
}

interface ProductSearchParams {
  query?: string
  categoryId?: ProductCategory
  page?: number
  pageSize?: number
  hideOutOfStock?: boolean
  genericOnly?: boolean
  ethicalOnly?: boolean
  expiringSoon?: boolean
  onlyOutOfStock?: boolean
}

interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export function sanitizeFtsQuery(query: string): string {
  // Strip double quotes, asterisks, caret, colons, parentheses, and other special characters
  const words = query
    .replace(/["*^:()\-+]/g, ' ')
    .trim()
    .split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length > 0)

  if (words.length === 0) return ''
  return words.map(word => `"${word}"*`).join(' AND ')
}

export function searchProducts(params: ProductSearchParams): PaginatedResult<Product> {
  const db = getDatabase()
  const { query, categoryId, page = 1, pageSize = APP_DEFAULTS.PAGE_SIZE } = params
  
  const offset = (page - 1) * pageSize
  
  const conditions: string[] = []
  const values: any[] = []
  let hasFts = false

  if (query && query.trim().length > 0) {
    const trimmedQuery = query.trim()
    if (/^\d{8,14}$/.test(trimmedQuery)) {
      conditions.push(`p.barcode = ?`)
      values.push(trimmedQuery)
    } else {
      const ftsQuery = sanitizeFtsQuery(trimmedQuery)
      if (ftsQuery.length > 0) {
        conditions.push(`p.id IN (SELECT rowid FROM products_fts WHERE products_fts MATCH ?)`)
        values.push(ftsQuery)
        hasFts = true
      }
    }
  }

  if (categoryId) {
    conditions.push(`p.category = ?`)
    values.push(categoryId)
  }

  if (params.hideOutOfStock) {
    conditions.push(`COALESCE((SELECT SUM(quantity) FROM batches WHERE product_id = p.id AND status = 'ACTIVE'), 0) > 0`)
  }

  if (params.genericOnly) {
    conditions.push(`p.category = 'GENERIC'`)
  }

  if (params.ethicalOnly) {
    conditions.push(`p.category = 'ETHICAL'`)
  }

  if (params.expiringSoon) {
    conditions.push(`EXISTS (SELECT 1 FROM batches b WHERE b.product_id = p.id AND b.status = 'ACTIVE' AND b.quantity > 0 AND b.expiry_date <= date('now', '+90 days'))`)
  }

  if (params.onlyOutOfStock) {
    conditions.push(`COALESCE((SELECT SUM(quantity) FROM batches WHERE product_id = p.id AND status = 'ACTIVE'), 0) = 0`)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const orderClause = hasFts 
    ? `ORDER BY (SELECT rank FROM products_fts WHERE rowid = p.id) ASC`
    : `ORDER BY p.brand_name ASC`

  const finalCountSql = `SELECT count(*) as total FROM products p ${whereClause}`
  const finalDataSql = `
    SELECT 
      p.*,
      c.salt_name as comp_salt_name, c.strength as comp_strength, c.dosage_form as comp_dosage_form,
      COALESCE((SELECT SUM(quantity) FROM batches WHERE product_id = p.id AND status = 'ACTIVE'), 0) as total_stock_units
    FROM products p
    LEFT JOIN compositions c ON p.composition_id = c.id
    ${whereClause}
    ${orderClause}
    LIMIT ? OFFSET ?
  `

  const totalRow = db.prepare(finalCountSql).get(...values) as { total: number }
  const dataRows = db.prepare(finalDataSql).all(...values, pageSize, offset) as any[]

  const data = dataRows.map(row => {
    const product: Product = {
      id: row.id,
      brand_name: row.brand_name,
      generic_name: row.generic_name,
      manufacturer: row.manufacturer,
      category: row.category,
      composition_id: row.composition_id,
      pack_size: row.pack_size,
      barcode: row.barcode,
      hsn_code: row.hsn_code,
      gst_rate_pct: row.gst_rate_pct,
      schedule_flag: row.schedule_flag,
      shelf_rack: row.shelf_rack,
      is_active: Boolean(row.is_active),
      created_at: row.created_at,
      total_stock_units: row.total_stock_units
    }
    
    if (row.composition_id) {
      product.composition = {
        id: row.composition_id,
        salt_name: row.comp_salt_name,
        strength: row.comp_strength,
        dosage_form: row.comp_dosage_form,
        created_at: '' // omitted in join to save data, not needed for UI display
      }
    }
    
    return product
  })

  return {
    data,
    total: totalRow.total,
    page,
    pageSize,
    totalPages: Math.ceil(totalRow.total / pageSize)
  }
}

export function getProduct(id: number): Product | undefined {
  const db = getDatabase()
  const row = db.prepare(`
    SELECT 
      p.*,
      c.salt_name as comp_salt_name, c.strength as comp_strength, c.dosage_form as comp_dosage_form
    FROM products p
    LEFT JOIN compositions c ON p.composition_id = c.id
    WHERE p.id = ?
  `).get(id) as any

  if (!row) return undefined

  const product: Product = {
    id: row.id,
    brand_name: row.brand_name,
    generic_name: row.generic_name,
    manufacturer: row.manufacturer,
    category: row.category,
    composition_id: row.composition_id,
    pack_size: row.pack_size,
    barcode: row.barcode,
    hsn_code: row.hsn_code,
    gst_rate_pct: row.gst_rate_pct,
    schedule_flag: row.schedule_flag,
    shelf_rack: row.shelf_rack,
    is_active: Boolean(row.is_active),
    created_at: row.created_at,
  }
  
  if (row.composition_id) {
    product.composition = {
      id: row.composition_id,
      salt_name: row.comp_salt_name,
      strength: row.comp_strength,
      dosage_form: row.comp_dosage_form,
      created_at: ''
    }
  }
  
  return product
}

export interface CreateProductPayload extends Omit<Product, 'id' | 'created_at' | 'total_stock_units' | 'composition'> {
  initial_batch?: {
    batch_number: string
    expiry_date: string
    quantity: number
    mrp_paise: number
    purchase_rate_paise: number
  }
}

export function createProduct(data: CreateProductPayload): Product {
  const db = getDatabase()
  
  const cleanedBarcode = data.barcode && data.barcode.trim() !== '' ? data.barcode.trim() : null
  if (cleanedBarcode) {
    const existing = db.prepare('SELECT id FROM products WHERE barcode = ?').get(cleanedBarcode)
    if (existing) throw new Error('A product with this barcode already exists.')
  }

  const transaction = db.transaction((payload: CreateProductPayload) => {
    const result = db.prepare(`
      INSERT INTO products (
        brand_name, generic_name, manufacturer, category, composition_id, 
        pack_size, barcode, hsn_code, gst_rate_pct, schedule_flag, shelf_rack
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      payload.brand_name,
      payload.generic_name || null,
      payload.manufacturer || null,
      payload.category,
      payload.composition_id || null,
      payload.pack_size,
      cleanedBarcode,
      payload.hsn_code || null,
      payload.gst_rate_pct,
      payload.schedule_flag,
      payload.shelf_rack || null
    )
    
    const productId = result.lastInsertRowid as number

    if (payload.initial_batch) {
      const b = payload.initial_batch
      const batchResult = db.prepare(`
        INSERT INTO batches (
          product_id, batch_number, expiry_date, quantity, 
          mrp_paise, purchase_rate_paise, gst_rate_pct
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        productId,
        b.batch_number,
        b.expiry_date,
        b.quantity,
        b.mrp_paise,
        b.purchase_rate_paise,
        payload.gst_rate_pct
      )

      db.prepare(`
        INSERT INTO stock_ledger (
          batch_id, movement_type, quantity_delta, actor_user_id, reason
        ) VALUES (?, 'ADJUSTMENT', ?, ?, 'Initial Stock')
      `).run(
        batchResult.lastInsertRowid,
        b.quantity,
        1 // Default to user 1 for initial creation
      )
    }

    return productId
  })

  const newProductId = transaction(data)
  return getProduct(newProductId)!
}

export function updateProduct(id: number, data: Partial<Omit<Product, 'id' | 'created_at'>>): Product {
  const db = getDatabase()
  
  const cleanedBarcode = data.barcode !== undefined 
    ? (data.barcode && data.barcode.trim() !== '' ? data.barcode.trim() : null)
    : undefined

  if (cleanedBarcode) {
    const existing = db.prepare('SELECT id FROM products WHERE barcode = ? AND id != ?').get(cleanedBarcode, id)
    if (existing) throw new Error('A product with this barcode already exists.')
  }

  const updates: string[] = []
  const values: any[] = []

  // Strip virtual fields
  const dbData = { ...data }
  delete dbData.total_stock_units
  delete dbData.composition
  if (data.barcode !== undefined) {
    dbData.barcode = cleanedBarcode as any
  }

  for (const [key, value] of Object.entries(dbData)) {
    if (value !== undefined) {
      updates.push(`${key} = ?`)
      values.push(value)
    }
  }

  if (updates.length > 0) {
    values.push(id)
    db.prepare(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`).run(...values)
  }

  return getProduct(id)!
}

export interface UpdateBatchPayload {
  batchId: number
  actorUserId: number
  reason: string
  data: {
    batch_number?: string
    expiry_date?: string
    mrp_paise?: number
    purchase_rate_paise?: number
    quantity?: number
    gst_rate_pct?: number
    vendor_id?: number | null
  }
}

export function updateBatch(payload: UpdateBatchPayload) {
  const db = getDatabase()
  const current = db.prepare('SELECT * FROM batches WHERE id = ?').get(payload.batchId) as any
  if (!current) throw new Error('Batch not found')

  const updates: string[] = []
  const values: any[] = []

  if (payload.data.batch_number !== undefined) {
    updates.push('batch_number = ?')
    values.push(payload.data.batch_number)
  }
  if (payload.data.expiry_date !== undefined) {
    updates.push('expiry_date = ?')
    values.push(payload.data.expiry_date)
  }
  if (payload.data.mrp_paise !== undefined) {
    updates.push('mrp_paise = ?')
    values.push(payload.data.mrp_paise)
  }
  if (payload.data.purchase_rate_paise !== undefined) {
    updates.push('purchase_rate_paise = ?')
    values.push(payload.data.purchase_rate_paise)
  }
  if (payload.data.quantity !== undefined) {
    updates.push('quantity = ?')
    values.push(payload.data.quantity)
  }
  if (payload.data.gst_rate_pct !== undefined) {
    updates.push('gst_rate_pct = ?')
    values.push(payload.data.gst_rate_pct)
  }
  if (payload.data.vendor_id !== undefined) {
    updates.push('vendor_id = ?')
    values.push(payload.data.vendor_id)
  }

  if (updates.length > 0) {
    values.push(payload.batchId)
    db.prepare(`UPDATE batches SET ${updates.join(', ')} WHERE id = ?`).run(...values)
  }

  const updated = db.prepare('SELECT * FROM batches WHERE id = ?').get(payload.batchId)
  
  try {
    logAuditAction({
      actorUserId: payload.actorUserId || 1,
      action: 'BATCH_UPDATE',
      entityType: 'BATCH',
      entityId: payload.batchId,
      entityName: current.batch_number,
      beforeJson: current,
      afterJson: updated,
      reason: payload.reason
    })
  } catch (err) {
    console.error('Failed to log audit for batch update:', err)
  }

  return updated
}

export function updateBatchStatus(batchId: number, newStatus: string, actorUserId: number, reason: string) {
  const db = getDatabase()
  const current = db.prepare('SELECT * FROM batches WHERE id = ?').get(batchId) as any
  if (!current) throw new Error('Batch not found')

  db.prepare('UPDATE batches SET status = ? WHERE id = ?').run(newStatus, batchId)
  const updated = db.prepare('SELECT * FROM batches WHERE id = ?').get(batchId)

  try {
    logAuditAction({
      actorUserId: actorUserId || 1,
      action: 'BATCH_STATUS_CHANGE',
      entityType: 'BATCH',
      entityId: batchId,
      entityName: current.batch_number,
      beforeJson: current,
      afterJson: updated,
      reason
    })
  } catch (err) {
    console.error('Failed to log audit for batch status change:', err)
  }

  return updated
}

export function deleteBatch(batchId: number, actorUserId?: number, reason?: string) {
  const db = getDatabase()
  // Soft-delete with ledger synchronization (D3):
  // Preserve row for compliance, write compensating stock ledger entry, and zero out quantity
  const executeDelete = db.transaction(() => {
    const current = db.prepare('SELECT quantity, batch_number FROM batches WHERE id = ?').get(batchId) as { quantity: number; batch_number: string } | undefined
    if (!current) return

    if (current.quantity > 0) {
      db.prepare(`
        INSERT INTO stock_ledger (
          batch_id, movement_type, quantity_delta, actor_user_id, reason, reference_entity
        ) VALUES (?, 'ADJUSTMENT', ?, ?, ?, ?)
      `).run(
        batchId,
        -current.quantity,
        actorUserId ?? null,
        reason || 'Batch Disposed / Deleted',
        `BATCH_DISPOSAL-${batchId}`
      )
    }

    db.prepare('UPDATE batches SET is_active = 0, status = \'DISPOSED\', quantity = 0 WHERE id = ?').run(batchId)
  })

  executeDelete()
}

export function registerProductHandlers() {
  ipcMain.handle(IPC_CHANNELS.PRODUCTS_SEARCH, (_, args) => searchProducts(args))
  ipcMain.handle(IPC_CHANNELS.PRODUCTS_GET, (_, id: number) => getProduct(id))
  ipcMain.handle(IPC_CHANNELS.PRODUCTS_CREATE, (_, data) => createProduct(data))
  ipcMain.handle(IPC_CHANNELS.PRODUCTS_UPDATE, (_, args) => updateProduct(args.id, args.data))
  ipcMain.handle(IPC_CHANNELS.BATCHES_UPDATE, (_, payload) => updateBatch(payload))
  ipcMain.handle(IPC_CHANNELS.BATCHES_UPDATE_STATUS, (_, { batchId, newStatus, actorUserId, reason }) => updateBatchStatus(batchId, newStatus, actorUserId, reason))
  ipcMain.handle(IPC_CHANNELS.BATCHES_DELETE, (_, batchId: number) => deleteBatch(batchId))
}
