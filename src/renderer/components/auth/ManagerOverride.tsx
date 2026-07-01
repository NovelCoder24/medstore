import React, { useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import { APP_DEFAULTS } from '../../../shared/constants'
import { ShieldAlert, Loader2, X } from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'

interface ManagerOverrideProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (ownerId: number) => void
  actionDescription: string
}

export function ManagerOverride({
  isOpen,
  onOpenChange,
  onSuccess,
  actionDescription
}: ManagerOverrideProps) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { isOwner, user } = useAuthStore()

  // If the active user is already an Owner, bypass the modal automatically
  useEffect(() => {
    if (isOpen && isOwner() && user) {
      onSuccess(user.id)
      onOpenChange(false)
    }
  }, [isOpen, isOwner, user, onSuccess, onOpenChange])

  const handleVerify = async (currentPin: string) => {
    setLoading(true)
    setError(null)
    try {
      const ownerUser = await window.api.invoke(IPC_CHANNELS.USERS_VERIFY_OWNER_PIN, currentPin)
      onSuccess(ownerUser.id)
      onOpenChange(false)
      setPin('')
    } catch (err: any) {
      setError('Invalid Owner PIN')
      setPin('')
    } finally {
      setLoading(false)
    }
  }

  // Handle keyboard input when modal is open
  useEffect(() => {
    if (!isOpen || isOwner()) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (loading) return
      
      if (/^[0-9]$/.test(e.key) && pin.length < APP_DEFAULTS.PIN_LENGTH) {
        setPin((prev) => {
          const newPin = prev + e.key
          if (newPin.length === APP_DEFAULTS.PIN_LENGTH) {
            handleVerify(newPin)
          }
          return newPin
        })
        setError(null)
      } else if (e.key === 'Backspace') {
        setPin((prev) => prev.slice(0, -1))
        setError(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, pin, loading, isOwner])

  if (isOwner()) {
    return null // Modal won't render for Owners; the useEffect automatically approves.
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-sm translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-xl">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="p-3 rounded-full bg-red-100 text-red-600 mb-4">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <Dialog.Title className="text-xl font-semibold leading-none tracking-tight">
              Manager Override Required
            </Dialog.Title>
            <Dialog.Description className="text-sm text-muted-foreground mt-2">
              {actionDescription}
            </Dialog.Description>
          </div>

          <div className="flex justify-center gap-3 my-4">
            {Array.from({ length: APP_DEFAULTS.PIN_LENGTH }).map((_, i) => (
              <div
                key={i}
                className={`w-4 h-4 rounded-full transition-all duration-200 ${
                  i < pin.length ? "bg-red-600 scale-110" : "bg-muted"
                }`}
              />
            ))}
          </div>

          {error && (
            <p className="text-sm text-red-500 text-center animate-in shake">
              {error}
            </p>
          )}

          {loading && (
            <div className="flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-red-600" />
            </div>
          )}

          <p className="text-xs text-center text-muted-foreground mt-4">
            Enter an OWNER PIN to authorize this action.
          </p>
          
          <Dialog.Close asChild>
            <button className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
