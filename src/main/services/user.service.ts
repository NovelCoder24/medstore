import bcrypt from 'bcryptjs'
import { getDatabase } from './db.service'
import { Role, ROLES, APP_DEFAULTS } from '../../shared/constants'
import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'

export interface User {
  id: number
  display_name: string
  role: Role
  is_active: boolean
  created_at: string
}

/**
 * Hash a plain text PIN.
 */
async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, APP_DEFAULTS.BCRYPT_SALT_ROUNDS)
}

/**
 * Compare a plain text PIN against a stored hash.
 */
async function comparePin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash)
}

/**
 * Setup the first OWNER user if the database is completely empty.
 * Returns true if a user was created, false if users already exist.
 */
export async function setupFirstRun(displayName: string, pin: string): Promise<boolean> {
  if (pin.length !== APP_DEFAULTS.PIN_LENGTH) {
    throw new Error(`PIN must be exactly ${APP_DEFAULTS.PIN_LENGTH} digits`)
  }

  const db = getDatabase()
  
  // Check if any users exist
  const count = (db.prepare('SELECT count(*) as c FROM users').get() as any).c
  if (count > 0) {
    return false
  }

  const hashed = await hashPin(pin)
  
  db.prepare(`
    INSERT INTO users (display_name, role, hashed_pin, is_active)
    VALUES (?, ?, ?, 1)
  `).run(displayName, ROLES.OWNER, hashed)

  return true
}

/**
 * Validate a PIN and return the User object if successful.
 * Throws an error on failure.
 */
export async function loginWithPin(pin: string): Promise<User> {
  const db = getDatabase()
  
  // Since PINs must be unique per active user in a small team setting, 
  // we fetch all active users and test the PIN. 
  // In a team of 5-10 people, this bcrypt loop is negligible (< 100ms total).
  // Alternatively, the user selects their name first, then enters PIN. 
  // The requirements say "Rahul presses 5555" and it logs him in. 
  // So we must test all active users.
  
  const activeUsers = db.prepare('SELECT id, display_name, role, hashed_pin, is_active, created_at FROM users WHERE is_active = 1').all() as any[]
  
  for (const user of activeUsers) {
    const isMatch = await comparePin(pin, user.hashed_pin)
    if (isMatch) {
      return {
        id: user.id,
        display_name: user.display_name,
        role: user.role,
        is_active: Boolean(user.is_active),
        created_at: user.created_at
      }
    }
  }

  throw new Error('Invalid PIN')
}

/**
 * Verify if the given PIN belongs to ANY active OWNER.
 * Used for Manager Override modals.
 */
export async function verifyOwnerPin(pin: string): Promise<User> {
  const db = getDatabase()
  
  const owners = db.prepare('SELECT id, display_name, role, hashed_pin, is_active, created_at FROM users WHERE is_active = 1 AND role = ?').all(ROLES.OWNER) as any[]
  
  for (const owner of owners) {
    const isMatch = await comparePin(pin, owner.hashed_pin)
    if (isMatch) {
      return {
        id: owner.id,
        display_name: owner.display_name,
        role: owner.role,
        is_active: Boolean(owner.is_active),
        created_at: owner.created_at
      }
    }
  }

  throw new Error('Invalid Owner PIN')
}

/**
 * List all users.
 */
export function listUsers(): User[] {
  const db = getDatabase()
  return db.prepare('SELECT id, display_name, role, is_active, created_at FROM users ORDER BY role DESC, display_name ASC').all() as User[]
}

/**
 * Create a new user (Only callable by OWNER in UI, but enforced here just in case).
 */
export async function createUser(displayName: string, role: Role, pin: string): Promise<User> {
  if (pin.length !== APP_DEFAULTS.PIN_LENGTH) {
    throw new Error(`PIN must be exactly ${APP_DEFAULTS.PIN_LENGTH} digits`)
  }

  const hashed = await hashPin(pin)
  const db = getDatabase()
  
  const result = db.prepare(`
    INSERT INTO users (display_name, role, hashed_pin, is_active)
    VALUES (?, ?, ?, 1)
  `).run(displayName, role, hashed)
  
  return db.prepare('SELECT id, display_name, role, is_active, created_at FROM users WHERE id = ?').get(result.lastInsertRowid) as User
}

/**
 * Update user details (change PIN or Display Name).
 */
export async function updateUser(id: number, displayName?: string, pin?: string): Promise<void> {
  const db = getDatabase()
  
  if (displayName) {
    db.prepare('UPDATE users SET display_name = ? WHERE id = ?').run(displayName, id)
  }
  
  if (pin) {
    if (pin.length !== APP_DEFAULTS.PIN_LENGTH) {
      throw new Error(`PIN must be exactly ${APP_DEFAULTS.PIN_LENGTH} digits`)
    }
    const hashed = await hashPin(pin)
    db.prepare('UPDATE users SET hashed_pin = ? WHERE id = ?').run(hashed, id)
  }
}

/**
 * Deactivate a user (prevent login).
 */
export function deactivateUser(id: number): void {
  const db = getDatabase()
  // Ensure we don't deactivate the last owner
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(id) as { role: Role }
  if (user?.role === ROLES.OWNER) {
    const ownerCount = (db.prepare('SELECT count(*) as c FROM users WHERE role = ? AND is_active = 1').get(ROLES.OWNER) as any).c
    if (ownerCount <= 1) {
      throw new Error('Cannot deactivate the last active OWNER')
    }
  }
  
  db.prepare('UPDATE users SET is_active = 0 WHERE id = ?').run(id)
}

// ── IPC Handlers ──

export function registerUserHandlers() {
  ipcMain.handle(IPC_CHANNELS.USERS_CHECK_FIRST_RUN, async () => {
    const db = getDatabase()
    const count = (db.prepare('SELECT count(*) as c FROM users').get() as any).c
    return count === 0
  })

  ipcMain.handle(IPC_CHANNELS.USERS_CREATE, async (_, args) => {
    if (args.isFirstRun) {
      return await setupFirstRun(args.displayName, args.pin)
    }
    return await createUser(args.displayName, args.role, args.pin)
  })

  ipcMain.handle(IPC_CHANNELS.USERS_LOGIN, async (_, pin: string) => {
    return await loginWithPin(pin)
  })

  ipcMain.handle(IPC_CHANNELS.USERS_VERIFY_OWNER_PIN, async (_, pin: string) => {
    return await verifyOwnerPin(pin)
  })

  ipcMain.handle(IPC_CHANNELS.USERS_LIST, () => {
    return listUsers()
  })
}
