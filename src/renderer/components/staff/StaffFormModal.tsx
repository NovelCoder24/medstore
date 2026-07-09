import React, { useState } from 'react'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import { APP_DEFAULTS, ROLES } from '../../../shared/constants'
import { Loader2, UserPlus, X } from 'lucide-react'

interface StaffFormModalProps {
  onClose: () => void
  onSuccess: () => void
}

export function StaffFormModal({ onClose, onSuccess }: StaffFormModalProps) {
  const [displayName, setDisplayName] = useState('')
  const [pin, setPin] = useState('')
  const [role, setRole] = useState<'OWNER' | 'CASHIER'>(ROLES.CASHIER as any)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!displayName.trim()) {
      setError('Name is required')
      return
    }
    if (pin.length !== APP_DEFAULTS.PIN_LENGTH) {
      setError(`PIN must be exactly ${APP_DEFAULTS.PIN_LENGTH} digits`)
      return
    }

    setLoading(true)
    try {
      await window.api.invoke(IPC_CHANNELS.USERS_CREATE, {
        isFirstRun: false,
        displayName: displayName.trim(),
        pin: pin,
        role: role
      })
      onSuccess()
    } catch (err: any) {
      setError(err.message || 'Failed to create user')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-md p-6 bg-card border rounded-2xl shadow-lg relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-muted-foreground hover:bg-muted rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-primary/10 text-primary rounded-lg">
            <UserPlus className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold tracking-tight">Add Staff Member</h2>
        </div>

        {error && (
          <div className="p-3 mb-6 text-sm text-red-500 bg-red-500/10 rounded-md">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background"
              placeholder="e.g. John Doe"
              disabled={loading}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'OWNER' | 'CASHIER')}
              className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background"
              disabled={loading}
            >
              <option value={ROLES.CASHIER}>Cashier (POS & Inventory)</option>
              <option value={ROLES.OWNER}>Owner (Full Access)</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Login PIN</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={APP_DEFAULTS.PIN_LENGTH}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              className="w-full px-3 py-2 text-2xl tracking-[0.5em] text-center border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background font-mono"
              placeholder="••••"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !displayName || pin.length !== APP_DEFAULTS.PIN_LENGTH}
            className="w-full py-2.5 mt-2 text-sm font-medium text-white transition-colors rounded-md bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Create User
          </button>
        </form>
      </div>
    </div>
  )
}
