import { getDatabase } from './db.service'
import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import { ProductCategory, ScheduleFlag, APP_DEFAULTS } from '../../shared/constants'
import { Composition } from './composition.service'

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

export function searchProducts(params: ProductSearchParams): PaginatedResult<Product> {
  const db = getDatabase()
  const { query, categoryId, page = 1, pageSize = APP_DEFAULTS.PAGE_SIZE } = params
  
  const offset = (page - 1) * pageSize
  
  let countSql = `SELECT count(*) as total FROM products p WHERE 1=1`
  let dataSql = `
    SELECT 
      p.*,
      c.salt_name as comp_salt_name, c.strength as comp_strength, c.dosage_form as comp_dosage_form,
      COALESCE((SELECT SUM(quantity) FROM batches WHERE product_id = p.id AND status = 'ACTIVE'), 0) as total_stock_units
    FROM products p
    LEFT JOIN compositions c ON p.composition_id = c.id
    WHERE 1=1
  `
  
  const queryParams: any[] = []

  if (query && query.trim().length > 0) {
    // If the query is just digits and perfectly matches a barcode length, try an exact barcode match first
    if (/^\d{8,14}$/.test(query.trim())) {
      const barcodeClause = ` AND p.barcode = ?`
      countSql += barcodeClause
      dataSql += barcodeClause
      queryParams.push(query.trim())
    } else {
      // Use FTS5
      // Clean query for FTS MATCH: append * to each word for prefix matching
      const ftsQuery = query.trim().split(/\s+/).map(word => `"${word}"*`).join(' AND ')
      
      const ftsClause = ` AND p.id IN (SELECT rowid FROM products_fts WHERE products_fts MATCH ?)`
      countSql += ftsClause
      dataSql += ftsClause
      queryParams.push(ftsQuery)
      
      // Order by rank for relevance when using FTS
      dataSql += ` ORDER BY (SELECT rank FROM products_fts WHERE rowid = p.id) ASC`
    }
  } else {
    // Default order if no FTS
    dataSql += ` ORDER BY p.brand_name ASC`
  }

  if (categoryId) {
    const categoryClause = ` AND p.category = ?`
    countSql += categoryClause
    // Insert before ORDER BY in dataSql
    dataSql = dataSql.replace(' ORDER BY', `${categoryClause} ORDER BY`)
    queryParams.push(categoryId) // Wait, we need to push it before the FTS query if FTS query exists? No, queryParams order matters.
    // Let's rebuild properly.
  }

  // Rebuilding SQL parameters safely
  const conditions: string[] = []
  const values: any[] = []

  if (query && query.trim().length > 0) {
    if (/^\d{8,14}$/.test(query.trim())) {
      conditions.push(`p.barcode = ?`)
      values.push(query.trim())
    } else {
      const ftsQuery = query.trim().split(/\s+/).map(word => `"${word}"*`).join(' AND ')
      conditions.push(`p.id IN (SELECT rowid FROM products_fts WHERE products_fts MATCH ?)`)
      values.push(ftsQuery)
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
  const orderClause = query && !/^\d{8,14}$/.test(query.trim()) 
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
  
  if (data.barcode) {
    const existing = db.prepare('SELECT id FROM products WHERE barcode = ?').get(data.barcode)
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
      payload.barcode || null,
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
  
  if (data.barcode) {
    const existing = db.prepare('SELECT id FROM products WHERE barcode = ? AND id != ?').get(data.barcode, id)
    if (existing) throw new Error('A product with this barcode already exists.')
  }

  const updates: string[] = []
  const values: any[] = []

  // Strip virtual fields
  const dbData = { ...data }
  delete dbData.total_stock_units
  delete dbData.composition

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

export function registerProductHandlers() {
  ipcMain.handle(IPC_CHANNELS.PRODUCTS_SEARCH, (_, args) => searchProducts(args))
  ipcMain.handle(IPC_CHANNELS.PRODUCTS_GET, (_, id: number) => getProduct(id))
  ipcMain.handle(IPC_CHANNELS.PRODUCTS_CREATE, (_, data) => createProduct(data))
  ipcMain.handle(IPC_CHANNELS.PRODUCTS_UPDATE, (_, args) => updateProduct(args.id, args.data))
}
