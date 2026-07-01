import React, { useState } from 'react'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import { APP_DEFAULTS, ROLES } from '../../../shared/constants'
import { ShieldCheck, Loader2 } from 'lucide-react'

export function FirstRunSetup({ onComplete }: { onComplete: () => void }) {
  const [displayName, setDisplayName] = useState('')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
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
    if (pin !== confirmPin) {
      setError('PINs do not match')
      return
    }

    setLoading(true)
    try {
      await window.api.invoke(IPC_CHANNELS.USERS_CREATE, {
        isFirstRun: true,
        displayName: displayName.trim(),
        pin: pin,
        role: ROLES.OWNER
      })
      onComplete()
    } catch (err: any) {
      setError(err.message || 'Failed to create user')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-muted/30">
      <div className="w-full max-w-md p-8 bg-card border rounded-2xl shadow-lg">
        <div className="flex flex-col items-center mb-8">
          <div className="p-4 mb-4 rounded-full bg-primary/10 text-primary">
            <ShieldCheck className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Welcome to MedStore</h2>
          <p className="text-sm text-muted-foreground mt-2 text-center">
            Let's set up the Owner account. This PIN will be required for manager overrides.
          </p>
        </div>

        {error && (
          <div className="p-3 mb-6 text-sm text-red-500 bg-red-500/10 rounded-md">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Your Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="e.g. Rahul Sharma"
              disabled={loading}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Create PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                className="w-full px-3 py-2 border rounded-md text-center text-xl tracking-widest focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="••••"
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Confirm PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                className="w-full px-3 py-2 border rounded-md text-center text-xl tracking-widest focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="••••"
                disabled={loading}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center h-10 px-4 mt-6 text-primary-foreground bg-primary rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Complete Setup'}
          </button>
        </form>
      </div>
    </div>
  )
}
