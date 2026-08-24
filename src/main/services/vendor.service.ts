import { getDatabase } from './db.service'
import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'

export interface Vendor {
  id: number
  name: string
  gstin: string | null
  state_code: string | null
  contact_phone: string | null
  contact_email: string | null
  address: string | null
  ocr_profile_json: string | null
  current_balance_paise: number
  is_active?: number
  created_at: string
}

export interface VendorPayment {
  id: number
  vendor_id: number
  purchase_invoice_id: number | null
  amount_paise: number
  payment_mode: 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE' | 'CREDIT'
  reference_no: string | null
  notes: string | null
  recorded_by: number | null
  recorded_by_name?: string | null
  created_at: string
}

export interface VendorLedgerEntry {
  id: number
  vendor_id: number
  transaction_type: 'PURCHASE_INVOICE' | 'INSTALMENT_PAYMENT' | 'SUPPLIER_RETURN' | 'ADJUSTMENT'
  amount_paise: number
  payment_mode: string | null
  reference_id: string | null
  created_at: string
}

export function listVendors(): Vendor[] {
  const db = getDatabase()
  return db.prepare('SELECT * FROM vendors WHERE is_active = 1 ORDER BY name ASC').all() as Vendor[]
}

export function getVendor(id: number): Vendor | undefined {
  const db = getDatabase()
  return db.prepare('SELECT * FROM vendors WHERE id = ?').get(id) as Vendor | undefined
}

export function createVendor(data: Omit<Vendor, 'id' | 'created_at' | 'current_balance_paise'>): Vendor {
  const db = getDatabase()
  const trimmedName = (data.name || '').trim()
  if (!trimmedName) {
    throw new Error('Supplier / Vendor name is required.')
  }

  const trimmedGstin = data.gstin && data.gstin.trim() ? data.gstin.trim().toUpperCase() : null

  // 1. Check for duplicate Supplier Name (case-insensitive) among active vendors
  const existingByName = db.prepare(`
    SELECT id, name FROM vendors 
    WHERE LOWER(TRIM(name)) = LOWER(?) AND is_active = 1
  `).get(trimmedName) as { id: number; name: string } | undefined

  if (existingByName) {
    throw new Error(`A supplier with the name "${existingByName.name}" already exists.`)
  }

  // 2. Check for duplicate GSTIN (if provided) among active vendors
  if (trimmedGstin) {
    const existingByGstin = db.prepare(`
      SELECT id, name FROM vendors 
      WHERE UPPER(TRIM(gstin)) = ? AND is_active = 1
    `).get(trimmedGstin) as { id: number; name: string } | undefined

    if (existingByGstin) {
      throw new Error(`A supplier with GSTIN "${trimmedGstin}" already exists (${existingByGstin.name}).`)
    }
  }

  const result = db.prepare(`
    INSERT INTO vendors (name, gstin, state_code, contact_phone, contact_email, address, ocr_profile_json, current_balance_paise, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1)
  `).run(
    trimmedName,
    trimmedGstin,
    data.state_code ? data.state_code.trim() : null,
    data.contact_phone ? data.contact_phone.trim() : null,
    data.contact_email ? data.contact_email.trim().toLowerCase() : null,
    data.address ? data.address.trim() : null,
    data.ocr_profile_json || null
  )
  
  return getVendor(result.lastInsertRowid as number)!
}

export function updateVendor(id: number, data: Partial<Omit<Vendor, 'id' | 'created_at'>>): Vendor {
  const db = getDatabase()
  const existing = getVendor(id)
  if (!existing) {
    throw new Error(`Supplier with ID ${id} not found`)
  }

  const updates: string[] = []
  const values: any[] = []

  // Check Name duplication if name is being updated
  if (data.name !== undefined) {
    const trimmedName = data.name.trim()
    if (!trimmedName) {
      throw new Error('Supplier name cannot be empty.')
    }

    const existingByName = db.prepare(`
      SELECT id, name FROM vendors 
      WHERE LOWER(TRIM(name)) = LOWER(?) AND id != ? AND is_active = 1
    `).get(trimmedName, id) as { id: number; name: string } | undefined

    if (existingByName) {
      throw new Error(`Another supplier with the name "${existingByName.name}" already exists.`)
    }

    updates.push('name = ?')
    values.push(trimmedName)
  }

  // Check GSTIN duplication if GSTIN is being updated
  if (data.gstin !== undefined) {
    const trimmedGstin = data.gstin && data.gstin.trim() ? data.gstin.trim().toUpperCase() : null
    if (trimmedGstin) {
      const existingByGstin = db.prepare(`
        SELECT id, name FROM vendors 
        WHERE UPPER(TRIM(gstin)) = ? AND id != ? AND is_active = 1
      `).get(trimmedGstin, id) as { id: number; name: string } | undefined

      if (existingByGstin) {
        throw new Error(`Another supplier with GSTIN "${trimmedGstin}" already exists (${existingByGstin.name}).`)
      }
    }
    updates.push('gstin = ?')
    values.push(trimmedGstin)
  }

  if (data.state_code !== undefined) {
    updates.push('state_code = ?')
    values.push(data.state_code ? data.state_code.trim() : null)
  }
  if (data.contact_phone !== undefined) {
    updates.push('contact_phone = ?')
    values.push(data.contact_phone ? data.contact_phone.trim() : null)
  }
  if (data.contact_email !== undefined) {
    updates.push('contact_email = ?')
    values.push(data.contact_email ? data.contact_email.trim().toLowerCase() : null)
  }
  if (data.address !== undefined) {
    updates.push('address = ?')
    values.push(data.address ? data.address.trim() : null)
  }
  if (data.ocr_profile_json !== undefined) {
    updates.push('ocr_profile_json = ?')
    values.push(data.ocr_profile_json || null)
  }
  if (data.is_active !== undefined) {
    updates.push('is_active = ?')
    values.push(data.is_active ? 1 : 0)
  }

  if (updates.length > 0) {
    values.push(id)
    db.prepare(`UPDATE vendors SET ${updates.join(', ')} WHERE id = ?`).run(...values)
  }

  return getVendor(id)!
}

export function recordVendorPayment(payload: {
  vendorId: number
  amountPaise: number
  paymentMode: 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE' | 'CREDIT'
  referenceNo?: string
  notes?: string
  purchaseInvoiceId?: number
  userId?: number
}): Vendor {
  const { vendorId, amountPaise, paymentMode, referenceNo, notes, purchaseInvoiceId, userId } = payload

  if (!amountPaise || amountPaise <= 0) {
    throw new Error('Payment amount must be greater than zero')
  }

  const db = getDatabase()
  const vendor = getVendor(vendorId)
  if (!vendor) {
    throw new Error(`Vendor with ID ${vendorId} not found`)
  }

  const txn = db.transaction(() => {
    // 1. Insert Payment Record
    db.prepare(`
      INSERT INTO vendor_payments (vendor_id, purchase_invoice_id, amount_paise, payment_mode, reference_no, notes, recorded_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      vendorId,
      purchaseInvoiceId || null,
      amountPaise,
      paymentMode || 'CASH',
      referenceNo || null,
      notes || null,
      userId || null
    )

    // 2. Insert Ledger Record (Negative amount reduces supplier balance)
    db.prepare(`
      INSERT INTO vendor_ledger (vendor_id, transaction_type, amount_paise, payment_mode, reference_id)
      VALUES (?, 'INSTALMENT_PAYMENT', ?, ?, ?)
    `).run(
      vendorId,
      -amountPaise,
      paymentMode || 'CASH',
      referenceNo || (purchaseInvoiceId ? `INV-${purchaseInvoiceId}` : 'PAYMENT')
    )

    // 3. Update Vendor Current Balance
    db.prepare(`
      UPDATE vendors 
      SET current_balance_paise = COALESCE(current_balance_paise, 0) - ?
      WHERE id = ?
    `).run(amountPaise, vendorId)
  })

  txn()
  return getVendor(vendorId)!
}

export function getVendorLedger(vendorId: number): VendorLedgerEntry[] {
  const db = getDatabase()
  return db.prepare(`
    SELECT * FROM vendor_ledger 
    WHERE vendor_id = ? 
    ORDER BY created_at DESC, id DESC
  `).all(vendorId) as VendorLedgerEntry[]
}

export function getVendorPayments(vendorId: number): VendorPayment[] {
  const db = getDatabase()
  return db.prepare(`
    SELECT vp.*, u.display_name as recorded_by_name
    FROM vendor_payments vp
    LEFT JOIN users u ON vp.recorded_by = u.id
    WHERE vp.vendor_id = ?
    ORDER BY vp.created_at DESC, vp.id DESC
  `).all(vendorId) as VendorPayment[]
}

export function registerVendorHandlers() {
  ipcMain.handle(IPC_CHANNELS.VENDORS_LIST, () => listVendors())
  ipcMain.handle(IPC_CHANNELS.VENDORS_GET, (_, id: number) => getVendor(id))
  ipcMain.handle(IPC_CHANNELS.VENDORS_CREATE, (_, data) => createVendor(data))
  ipcMain.handle(IPC_CHANNELS.VENDORS_UPDATE, (_, args) => updateVendor(args.id, args.data))
  ipcMain.handle(IPC_CHANNELS.VENDORS_RECORD_PAYMENT, (_, payload) => recordVendorPayment(payload))
  ipcMain.handle(IPC_CHANNELS.VENDORS_GET_LEDGER, (_, vendorId: number) => getVendorLedger(vendorId))
  ipcMain.handle(IPC_CHANNELS.VENDORS_GET_PAYMENTS, (_, vendorId: number) => getVendorPayments(vendorId))
}
