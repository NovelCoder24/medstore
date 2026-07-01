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

export function createVendor(data: Omit<Vendor, 'id' | 'created_at'>): Vendor {
  const db = getDatabase()
  const result = db.prepare(`
    INSERT INTO vendors (name, gstin, state_code, contact_phone, contact_email, address, ocr_profile_json)
    VALUES (?, ?, ?, ?, ?, ?, ?)
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

export function registerVendorHandlers() {
  ipcMain.handle(IPC_CHANNELS.VENDORS_LIST, () => listVendors())
  ipcMain.handle(IPC_CHANNELS.VENDORS_GET, (_, id: number) => getVendor(id))
  ipcMain.handle(IPC_CHANNELS.VENDORS_CREATE, (_, data) => createVendor(data))
  ipcMain.handle(IPC_CHANNELS.VENDORS_UPDATE, (_, args) => updateVendor(args.id, args.data))
}
