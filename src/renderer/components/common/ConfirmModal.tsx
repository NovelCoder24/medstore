import React, { useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useConfirmStore } from '../../store/confirm.store'
import { AlertTriangle, HelpCircle, X } from 'lucide-react'

export function ConfirmModal() {
  const {
    confirmOpen,
    confirmOptions,
    closeConfirm,
    promptOpen,
    promptOptions,
    closePrompt
  } = useConfirmStore()

  const [promptInput, setPromptInput] = useState('')
  const [promptError, setPromptError] = useState<string | null>(null)

  useEffect(() => {
    if (promptOpen && promptOptions) {
      setPromptInput(promptOptions.initialValue || '')
      setPromptError(null)
    }
  }, [promptOpen, promptOptions])

  const handlePromptSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (promptOptions?.required !== false && !promptInput.trim()) {
      setPromptError('This field is required.')
      return
    }
    closePrompt(promptInput.trim())
  }

  return (
    <>
      {/* 1. Confirmation Modal */}
      <Dialog.Root open={confirmOpen} onOpenChange={(open) => !open && closeConfirm(false)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs data-[state=open]:animate-in data-[state=closed]:animate-out" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out sm:rounded-2xl">
            <div className="flex items-start gap-3.5">
              <div
                className={`p-2.5 rounded-xl shrink-0 ${
                  confirmOptions?.variant === 'danger'
                    ? 'bg-rose-100 text-rose-600 border border-rose-200'
                    : 'bg-blue-100 text-blue-600 border border-blue-200'
                }`}
              >
                {confirmOptions?.variant === 'danger' ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : (
                  <HelpCircle className="w-5 h-5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <Dialog.Title className="text-base font-bold text-slate-900 leading-tight">
                  {confirmOptions?.title || 'Confirm Action'}
                </Dialog.Title>
                <Dialog.Description className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
                  {confirmOptions?.message}
                </Dialog.Description>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 mt-6 pt-2">
              <button
                type="button"
                onClick={() => closeConfirm(false)}
                className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                {confirmOptions?.cancelText || 'Cancel'}
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => closeConfirm(true)}
                className={`px-4 py-2 text-xs sm:text-sm font-bold text-white rounded-xl shadow-xs transition cursor-pointer ${
                  confirmOptions?.variant === 'danger'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-primary hover:bg-primary/90'
                }`}
              >
                {confirmOptions?.confirmText || 'Confirm'}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* 2. Prompt Modal */}
      <Dialog.Root open={promptOpen} onOpenChange={(open) => !open && closePrompt(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs data-[state=open]:animate-in data-[state=closed]:animate-out" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out">
            <div className="flex items-center justify-between pb-3 border-b">
              <Dialog.Title className="text-base font-bold text-slate-900">
                {promptOptions?.title || 'Input Required'}
              </Dialog.Title>
              <button
                type="button"
                onClick={() => closePrompt(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handlePromptSubmit} className="mt-4 space-y-4">
              <Dialog.Description className="text-xs sm:text-sm text-slate-600">
                {promptOptions?.message}
              </Dialog.Description>

              <div>
                <input
                  type="text"
                  autoFocus
                  value={promptInput}
                  placeholder={promptOptions?.placeholder || 'Enter value...'}
                  onChange={(e) => {
                    setPromptInput(e.target.value)
                    if (promptError) setPromptError(null)
                  }}
                  className={`w-full px-3.5 py-2 text-sm border rounded-xl outline-none transition ${
                    promptError 
                      ? 'border-rose-400 ring-2 ring-rose-200' 
                      : 'border-slate-300 focus:ring-2 focus:ring-primary/40 focus:border-primary'
                  }`}
                />
                {promptError && (
                  <p className="text-xs text-rose-600 font-medium mt-1">{promptError}</p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => closePrompt(null)}
                  className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                >
                  {promptOptions?.cancelText || 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs sm:text-sm font-bold text-white bg-primary hover:bg-primary/90 rounded-xl shadow-xs transition cursor-pointer"
                >
                  {promptOptions?.confirmText || 'Submit'}
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}
