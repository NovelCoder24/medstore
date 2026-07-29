import { getDatabase } from './db.service'
import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'

export interface Customer {
  id: number
  name: string
  mobile: string
  address: string | null
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

export function createCustomer(data: { name: string, mobile: string, address?: string, max_credit_limit_paise?: number }): Customer {
  const db = getDatabase()
  const existing = db.prepare('SELECT id FROM customers WHERE mobile = ?').get(data.mobile)
  if (existing) throw new Error('Customer with this mobile already exists')

  const result = db.prepare(`
    INSERT INTO customers (name, mobile, address, max_credit_limit_paise)
    VALUES (?, ?, ?, ?)
  `).run(
    data.name,
    data.mobile,
    data.address || null,
    data.max_credit_limit_paise ?? 500000 // default 5000 INR
  )
  return getCustomer(result.lastInsertRowid as number)!
}

export function getCustomer(id: number): Customer | undefined {
  return getDatabase().prepare('SELECT * FROM customers WHERE id = ?').get(id) as Customer
}

export function searchCustomers(query: string): Customer[] {
  const db = getDatabase()
  return db.prepare(`
    SELECT * FROM customers 
    WHERE name LIKE ? OR mobile LIKE ?
    ORDER BY name ASC
    LIMIT 20
  `).all(`%${query}%`, `%${query}%`) as Customer[]
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
    db.prepare(`
      INSERT INTO customer_ledger (customer_id, transaction_type, amount_paise, reference_id)
      VALUES (?, 'PAYMENT_RECEIVED', ?, ?)
    `).run(customerId, amountPaise, referenceId || null)

    db.prepare(`
      UPDATE customers 
      SET current_balance_paise = current_balance_paise - ?
      WHERE id = ?
    `).run(amountPaise, customerId)

    return getCustomer(customerId)!
  })
  
  return transaction()
}

export function registerCustomerHandlers() {
  ipcMain.handle(IPC_CHANNELS.CUSTOMERS_CREATE, (_, data) => createCustomer(data))
  ipcMain.handle(IPC_CHANNELS.CUSTOMERS_SEARCH, (_, query) => searchCustomers(query))
  ipcMain.handle(IPC_CHANNELS.CUSTOMERS_GET, (_, id) => getCustomer(id))
  ipcMain.handle(IPC_CHANNELS.CUSTOMERS_LEDGER, (_, id) => getCustomerLedger(id))
  ipcMain.handle(IPC_CHANNELS.CUSTOMERS_LIST, () => listCustomers())
  ipcMain.handle(IPC_CHANNELS.CUSTOMERS_ACCEPT_PAYMENT, (_, { customerId, amountPaise, referenceId }) => acceptPayment(customerId, amountPaise, referenceId))
}
