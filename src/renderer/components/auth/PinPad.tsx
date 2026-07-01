import React, { useState, useEffect } from 'react'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import { useAuthStore } from '../../store/auth.store'
import { cn } from '../../lib/utils'
import { APP_DEFAULTS } from '../../../shared/constants'
import { Lock, Delete, XCircle } from 'lucide-react'

export function PinPad() {
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const login = useAuthStore((s) => s.login)

  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (loading) return
      
      if (/^[0-9]$/.test(e.key) && pin.length < APP_DEFAULTS.PIN_LENGTH) {
        setPin((prev) => prev + e.key)
        setError(null)
      } else if (e.key === 'Backspace') {
        setPin((prev) => prev.slice(0, -1))
        setError(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [pin, loading])

  // Auto-submit when PIN length is reached
  useEffect(() => {
    if (pin.length === APP_DEFAULTS.PIN_LENGTH) {
      handleLogin(pin)
    }
  }, [pin])

  const handleLogin = async (currentPin: string) => {
    setLoading(true)
    setError(null)
    try {
      const user = await window.api.invoke(IPC_CHANNELS.USERS_LOGIN, currentPin)
      login(user)
    } catch (err: any) {
      setError('Invalid PIN')
      setPin('')
    } finally {
      setLoading(false)
    }
  }

  const handleNumpad = (num: string) => {
    if (pin.length < APP_DEFAULTS.PIN_LENGTH) {
      setPin((prev) => prev + num)
      setError(null)
    }
  }

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1))
    setError(null)
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-muted/30">
      <div className="w-full max-w-sm p-8 bg-card border rounded-2xl shadow-lg">
        <div className="flex flex-col items-center mb-8">
          <div className="p-3 mb-4 rounded-full bg-primary/10 text-primary">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Enter PIN</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Sign in to POS
          </p>
        </div>

        {/* PIN Dots Display */}
        <div className="flex justify-center gap-4 mb-8">
          {Array.from({ length: APP_DEFAULTS.PIN_LENGTH }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-4 h-4 rounded-full transition-all duration-200",
                i < pin.length ? "bg-primary scale-110" : "bg-muted-foreground/20"
              )}
            />
          ))}
        </div>

        {error && (
          <div className="flex items-center justify-center gap-2 mb-6 text-sm text-red-500 bg-red-500/10 py-2 rounded-md animate-in shake">
            <XCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {/* Numpad Grid */}
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              disabled={loading}
              onClick={() => handleNumpad(num.toString())}
              className="flex items-center justify-center h-14 text-2xl font-medium bg-muted hover:bg-muted-foreground/20 active:scale-95 rounded-xl transition-all"
            >
              {num}
            </button>
          ))}
          <div /> {/* Empty slot */}
          <button
            disabled={loading}
            onClick={() => handleNumpad('0')}
            className="flex items-center justify-center h-14 text-2xl font-medium bg-muted hover:bg-muted-foreground/20 active:scale-95 rounded-xl transition-all"
          >
            0
          </button>
          <button
            disabled={loading || pin.length === 0}
            onClick={handleBackspace}
            className="flex items-center justify-center h-14 text-muted-foreground hover:bg-muted-foreground/20 active:scale-95 rounded-xl transition-all"
          >
            <Delete className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  )
}
