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
  return db.prepare('SELECT * FROM vendors ORDER BY name ASC').all() as Vendor[]
}

export function getVendor(id: number): Vendor | undefined {
  const db = getDatabase()
  return db.prepare('SELECT * FROM vendors WHERE id = ?').get(id) as Vendor | undefined
}

export function createVendor(data: Omit<Vendor, 'id' | 'created_at' | 'current_balance_paise'>): Vendor {
  const db = getDatabase()
  const result = db.prepare(`
    INSERT INTO vendors (name, gstin, state_code, contact_phone, contact_email, address, ocr_profile_json, current_balance_paise)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0)
  `).run(
    data.name,
    data.gstin || null,
    data.state_code || null,
    data.contact_phone || null,
    data.contact_email || null,
    data.address || null,
    data.ocr_profile_json || null
  )
  
  return getVendor(result.lastInsertRowid as number)!
}

export function updateVendor(id: number, data: Partial<Omit<Vendor, 'id' | 'created_at'>>): Vendor {
  const db = getDatabase()
  const updates: string[] = []
  const values: any[] = []

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      updates.push(`${key} = ?`)
      values.push(value)
    }
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
