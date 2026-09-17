import { getDatabase } from './db.service'
import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'

export interface Customer {
  id: number
  name: string
  mobile: string
  address: string | null
  notes: string | null
  current_balance_paise: number
  max_credit_limit_paise: number
  created_at: string
}

export interface CustomerLedgerEntry {
  id: number
  customer_id: number
  transaction_type: 'CREDIT_SALE' | 'PAYMENT_RECEIVED' | 'ADJUSTMENT'
  amount_paise: number
  reference_id: string | null
  created_at: string
}

export function createCustomer(data: { name: string, mobile: string, address?: string, notes?: string, max_credit_limit_paise?: number }): Customer {
  const db = getDatabase()
  const existing = db.prepare('SELECT id FROM customers WHERE mobile = ?').get(data.mobile)
  if (existing) throw new Error('Customer with this mobile already exists')

  const result = db.prepare(`
    INSERT INTO customers (name, mobile, address, notes, max_credit_limit_paise)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    data.name,
    data.mobile,
    data.address || null,
    data.notes?.trim() || null,
    data.max_credit_limit_paise ?? 500000 // default 5000 INR
  )
  return getCustomer(result.lastInsertRowid as number)!
}

export function updateCustomer(id: number, data: {
  name?: string
  mobile?: string
  address?: string | null
  notes?: string | null
  max_credit_limit_paise?: number
}): Customer {
  const db = getDatabase()
  const current = getCustomer(id)
  if (!current) throw new Error(`Customer with ID ${id} not found`)

  if (data.mobile && data.mobile !== current.mobile) {
    const existing = db.prepare('SELECT id FROM customers WHERE mobile = ? AND id != ?').get(data.mobile, id)
    if (existing) throw new Error('Another customer with this mobile already exists')
  }

  const name = data.name !== undefined ? data.name : current.name
  const mobile = data.mobile !== undefined ? data.mobile : current.mobile
  const address = data.address !== undefined ? (data.address || null) : current.address
  const notes = data.notes !== undefined ? (data.notes ? data.notes.trim() : null) : current.notes
  const maxCreditLimit = data.max_credit_limit_paise !== undefined ? data.max_credit_limit_paise : current.max_credit_limit_paise

  db.prepare(`
    UPDATE customers 
    SET name = ?, mobile = ?, address = ?, notes = ?, max_credit_limit_paise = ?
    WHERE id = ?
  `).run(name, mobile, address, notes, maxCreditLimit, id)

  return getCustomer(id)!
}

export function getCustomer(id: number): Customer | undefined {
  return getDatabase().prepare('SELECT * FROM customers WHERE id = ?').get(id) as Customer
}

export function searchCustomers(query: string): Customer[] {
  const db = getDatabase()
  const searchTerm = `%${query}%`
  return db.prepare(`
    SELECT * FROM customers 
    WHERE name LIKE ? OR mobile LIKE ? OR notes LIKE ?
    ORDER BY name ASC
    LIMIT 20
  `).all(searchTerm, searchTerm, searchTerm) as Customer[]
}

export function listCustomers(): Customer[] {
  return getDatabase().prepare('SELECT * FROM customers ORDER BY name ASC').all() as Customer[]
}

export function getCustomerLedger(customerId: number): CustomerLedgerEntry[] {
  return getDatabase().prepare('SELECT * FROM customer_ledger WHERE customer_id = ? ORDER BY created_at DESC LIMIT 100').all(customerId) as CustomerLedgerEntry[]
}

export function acceptPayment(customerId: number, amountPaise: number, referenceId?: string): Customer {
  if (!amountPaise || amountPaise <= 0) {
    throw new Error('Payment amount must be greater than zero')
  }

  const db = getDatabase()
  const transaction = db.transaction(() => {
    // 1. Verify customer exists before creating ledger entries (L2)
    const customer = db.prepare('SELECT id, current_balance_paise FROM customers WHERE id = ?').get(customerId) as { id: number; current_balance_paise: number } | undefined
    if (!customer) {
      throw new Error(`Customer with ID ${customerId} not found`)
    }

    // 2. Prevent overpayment creating negative balance
    if (amountPaise > customer.current_balance_paise) {
      throw new Error(`Payment amount (₹${(amountPaise / 100).toFixed(2)}) exceeds current outstanding balance (₹${(customer.current_balance_paise / 100).toFixed(2)})`)
    }

    db.prepare(`
      INSERT INTO customer_ledger (customer_id, transaction_type, amount_paise, reference_id)
      VALUES (?, 'PAYMENT_RECEIVED', ?, ?)
    `).run(customerId, amountPaise, referenceId || null)

    db.prepare(`
      UPDATE customers 
      SET current_balance_paise = MAX(0, current_balance_paise - ?)
      WHERE id = ?
    `).run(amountPaise, customerId)

    return getCustomer(customerId)!
  })
  
  return transaction()
}

export function registerCustomerHandlers() {
  ipcMain.handle(IPC_CHANNELS.CUSTOMERS_CREATE, (_, data) => createCustomer(data))
  ipcMain.handle(IPC_CHANNELS.CUSTOMERS_UPDATE, (_, { id, data }) => updateCustomer(id, data))
  ipcMain.handle(IPC_CHANNELS.CUSTOMERS_SEARCH, (_, query) => searchCustomers(query))
  ipcMain.handle(IPC_CHANNELS.CUSTOMERS_GET, (_, id) => getCustomer(id))
  ipcMain.handle(IPC_CHANNELS.CUSTOMERS_LEDGER, (_, id) => getCustomerLedger(id))
  ipcMain.handle(IPC_CHANNELS.CUSTOMERS_LIST, () => listCustomers())
  ipcMain.handle(IPC_CHANNELS.CUSTOMERS_ACCEPT_PAYMENT, (_, { customerId, amountPaise, referenceId }) => acceptPayment(customerId, amountPaise, referenceId))
}
