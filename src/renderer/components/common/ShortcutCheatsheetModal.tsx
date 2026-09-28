import React, { useEffect, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Keyboard, X, Sparkles, ShoppingBag, CreditCard, Layers } from 'lucide-react'

interface ShortcutRowProps {
  hotkey: string
  label: string
  description?: string
}

function ShortcutRow({ hotkey, label, description }: ShortcutRowProps) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
      <div>
        <span className="text-xs font-semibold text-slate-800">{label}</span>
        {description && <p className="text-[11px] text-slate-400">{description}</p>}
      </div>
      <kbd className="px-2 py-0.5 text-xs font-mono font-bold text-slate-700 bg-slate-100 border border-slate-300 rounded shadow-2xs shrink-0">
        {hotkey}
      </kbd>
    </div>
  )
}

export function ShortcutCheatsheetModal() {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const activeTag = document.activeElement?.tagName
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return

      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault()
        setIsOpen((prev) => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-[200] animate-in fade-in" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-xl bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 z-[201] animate-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
                <Keyboard className="w-5 h-5" />
              </div>
              <div>
                <Dialog.Title className="text-lg font-bold text-slate-900 tracking-tight">
                  Keyboard Shortcuts Cheatsheet
                </Dialog.Title>
                <Dialog.Description className="text-xs text-slate-500">
                  Master hands-on-keyboard counter velocity in MedStore
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer">
              <X className="w-4 h-4" />
            </Dialog.Close>
          </div>

          <div className="py-4 space-y-5 max-h-[70vh] overflow-y-auto pr-1">
            {/* POS Section */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-blue-700 uppercase tracking-wider">
                <ShoppingBag className="w-3.5 h-3.5" /> Point of Sale (POS)
              </div>
              <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-3">
                <ShortcutRow hotkey="F2" label="Search Medicine" description="Focus medicine search input instantly" />
                <ShortcutRow hotkey="F12" label="Checkout / Pay" description="Open payment dialog when cart has items" />
                <ShortcutRow hotkey="F6" label="Hold Bill (Park Cart)" description="Suspend current bill to serve next customer" />
                <ShortcutRow hotkey="↑ / ↓" label="Navigate Results" description="Scroll through medicine search results" />
                <ShortcutRow hotkey="Enter" label="Select Medicine" description="Add selected medicine to billing cart" />
                <ShortcutRow hotkey="Esc" label="Dismiss Search" description="Clear search or close open dropdown" />
              </div>
            </div>

            {/* Checkout Section */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 uppercase tracking-wider">
                <CreditCard className="w-3.5 h-3.5" /> Checkout & Payment Modal
              </div>
              <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-3">
                <ShortcutRow hotkey="1 or C" label="Select Cash" description="Set payment mode to Cash" />
                <ShortcutRow hotkey="2 or U" label="Select UPI" description="Set payment mode to UPI / QR Code" />
                <ShortcutRow hotkey="3 or K" label="Select Card" description="Set payment mode to Credit / Debit Card" />
                <ShortcutRow hotkey="4 or D" label="Select Khata" description="Set payment mode to Customer Due Credit" />
                <ShortcutRow hotkey="Enter" label="Confirm & Pay" description="Submit transaction when outside text inputs" />
                <ShortcutRow hotkey="Enter" label="Print Receipt" description="Print thermal invoice on success screen" />
                <ShortcutRow hotkey="Esc / Space" label="Start New Bill" description="Reset and prepare next customer bill" />
              </div>
            </div>

            {/* General Section */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
                <Layers className="w-3.5 h-3.5" /> General Navigation
              </div>
              <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-3">
                <ShortcutRow hotkey="?" label="Toggle Cheatsheet" description="Press ? anywhere outside text inputs" />
                <ShortcutRow hotkey="Esc" label="Close Modal" description="Dismiss any active modal or sheet" />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Tip: Press <kbd className="px-1.5 py-0.5 bg-slate-100 font-mono font-semibold rounded border">?</kbd> anytime to open this guide</span>
            <button
              onClick={() => setIsOpen(false)}
              className="px-3.5 py-1.5 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              Got it
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
