import { getDatabase } from './db.service'
import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'

export interface Composition {
  id: number
  salt_name: string
  strength: string
  dosage_form: string
  created_at: string
}

export function listCompositions(): Composition[] {
  const db = getDatabase()
  return db.prepare('SELECT * FROM compositions ORDER BY salt_name ASC').all() as Composition[]
}

export function getComposition(id: number): Composition | undefined {
  const db = getDatabase()
  return db.prepare('SELECT * FROM compositions WHERE id = ?').get(id) as Composition | undefined
}

export function createComposition(data: Omit<Composition, 'id' | 'created_at'>): Composition {
  const db = getDatabase()
  
  // Enforce uniqueness
  const existing = db.prepare(`
    SELECT id FROM compositions 
    WHERE salt_name = ? AND strength = ? AND dosage_form = ?
  `).get(data.salt_name, data.strength, data.dosage_form) as { id: number } | undefined

  if (existing) {
    throw new Error('This composition already exists.')
  }

  const result = db.prepare(`
    INSERT INTO compositions (salt_name, strength, dosage_form)
    VALUES (?, ?, ?)
  `).run(data.salt_name, data.strength, data.dosage_form)
  
  return getComposition(result.lastInsertRowid as number)!
}

export function updateComposition(id: number, data: Partial<Omit<Composition, 'id' | 'created_at'>>): Composition {
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
    db.prepare(`UPDATE compositions SET ${updates.join(', ')} WHERE id = ?`).run(...values)
  }

  return getComposition(id)!
}

export function registerCompositionHandlers() {
  ipcMain.handle(IPC_CHANNELS.COMPOSITIONS_LIST, () => listCompositions())
  ipcMain.handle(IPC_CHANNELS.COMPOSITIONS_CREATE, (_, data) => createComposition(data))
  ipcMain.handle(IPC_CHANNELS.COMPOSITIONS_UPDATE, (_, args) => updateComposition(args.id, args.data))
}
