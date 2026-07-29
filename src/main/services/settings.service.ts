import { safeStorage, ipcMain } from 'electron'
import { getDatabase } from './db.service'
import { IPC_CHANNELS } from '../../shared/ipc-channels'

/**
 * Store a secret string in the settings table, encrypted via Electron safeStorage.
 */
export function setSecretSetting(key: string, plainText: string): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Electron safeStorage is not available on this system.')
  }
  const encryptedBuffer = safeStorage.encryptString(plainText)
  const encryptedBase64 = encryptedBuffer.toString('base64')

  const db = getDatabase()
  db.prepare(`
    INSERT INTO settings (key, value, updated_at) 
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `).run(key, encryptedBase64)
}

/**
 * Retrieve and decrypt a secret string from the settings table.
 */
export function getSecretSetting(key: string): string | null {
  const db = getDatabase()
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
  if (!row) return null

  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Electron safeStorage is not available to decrypt the setting.')
  }

  try {
    const encryptedBuffer = Buffer.from(row.value, 'base64')
    return safeStorage.decryptString(encryptedBuffer)
  } catch (error) {
    console.error(`Failed to decrypt secret setting [${key}]:`, error)
    return null
  }
}

export function getSetting(key: string): string | null {
  const db = getDatabase()
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
  return row ? row.value : null
}

export function setSetting(key: string, value: string): void {
  const db = getDatabase()
  db.prepare(`
    INSERT INTO settings (key, value, updated_at) 
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `).run(key, value)
}

export interface StoreHeaderSettings {
  storeName: string
  storeSubtitle: string
  storeAddress: string
  storePhone: string
  storeProprietor: string
  storeGstin: string
  storeDl: string
}

export function getStoreHeaderSettings(): StoreHeaderSettings {
  return {
    storeName: getSetting('STORE_NAME') || 'SHIV SHAKTI MEDICAL STORE',
    storeSubtitle: getSetting('STORE_SUBTITLE') || 'Chemist & Druggist',
    storeAddress: getSetting('STORE_ADDRESS') || 'Shop No. 14, Near Govt. Hospital, G.E. Road, Bhilai 3',
    storePhone: getSetting('STORE_PHONE') || '9131741818',
    storeProprietor: getSetting('STORE_PROPRIETOR') || 'P. L. Sahu',
    storeGstin: getSetting('STORE_GSTIN') || '',
    storeDl: getSetting('STORE_DL') || ''
  }
}

export function saveStoreHeaderSettings(settings: Partial<StoreHeaderSettings>): void {
  if (settings.storeName !== undefined) setSetting('STORE_NAME', settings.storeName.trim())
  if (settings.storeSubtitle !== undefined) setSetting('STORE_SUBTITLE', settings.storeSubtitle.trim())
  if (settings.storeAddress !== undefined) setSetting('STORE_ADDRESS', settings.storeAddress.trim())
  if (settings.storePhone !== undefined) setSetting('STORE_PHONE', settings.storePhone.trim())
  if (settings.storeProprietor !== undefined) setSetting('STORE_PROPRIETOR', settings.storeProprietor.trim())
  if (settings.storeGstin !== undefined) setSetting('STORE_GSTIN', settings.storeGstin.trim())
  if (settings.storeDl !== undefined) setSetting('STORE_DL', settings.storeDl.trim())
}

export function registerSettingsHandlers() {
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET_SECRET, (_, key: string) => {
    // Only return boolean to frontend for security: "is it set?"
    const val = getSecretSetting(key)
    return !!val
  })
  
  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET_SECRET, (_, key: string, value: string) => {
    setSecretSetting(key, value)
    return true
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, () => {
    return getStoreHeaderSettings()
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, (_, settingsData: Partial<StoreHeaderSettings>) => {
    saveStoreHeaderSettings(settingsData)
    return true
  })
}
