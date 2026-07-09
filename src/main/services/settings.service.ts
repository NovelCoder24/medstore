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
}
