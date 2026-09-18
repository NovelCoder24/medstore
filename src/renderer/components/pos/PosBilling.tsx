import React, { useState, useEffect } from 'react'
import { ProductSearchDropdown } from './ProductSearchDropdown'
import { CartTable } from './CartTable'
import { CheckoutModal } from './CheckoutModal'
import { AlertBanner } from '../common/AlertBanner'
import { useCartStore } from '../../store/cart.store'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import { formatPaise } from '../../../shared/utils/paise'
import { ShoppingBag, Receipt, PauseCircle, PlayCircle, X, Clock } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'

export function PosBilling() {
  const { 
    addItem, 
    getTotals, 
    items, 
    parkedCarts, 
    parkCurrentCart, 
    resumeCart, 
    discardParkedCart 
  } = useCartStore()
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [parkFeedback, setParkFeedback] = useState<string | null>(null)

  const totals = getTotals()

  // F12 Hotkey for checkout, F6 Hotkey for parking current bill
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'F12') {
        e.preventDefault()
        if (items.length > 0) {
          setIsCheckoutOpen(true)
        }
      } else if (e.key === 'F6') {
        e.preventDefault()
        if (items.length > 0) {
          const success = parkCurrentCart()
          if (success) {
            setParkFeedback('Current cart parked. You can now serve the next customer.')
            setTimeout(() => setParkFeedback(null), 4000)
          }
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [items.length, parkCurrentCart])

  const handleProductSelect = async (product: any) => {
    setErrorMsg(null)
    try {
      const batches = await window.api.invoke(IPC_CHANNELS.BATCHES_LIST_BY_PRODUCT, product.id)
      
      if (!batches || batches.length === 0) {
        setErrorMsg(`"${product.brand_name}" is out of stock.`)
        return
      }

      // Auto-select FIFO (First to Expire) batch
      const batch = batches[0]
      
      const unitMrp = Math.round(batch.mrp_paise / product.pack_size)
      const unitPurchaseRate = Math.round((batch.purchase_rate_paise || 0) / product.pack_size)
      
      const initialQty = Math.min(product.pack_size, batch.quantity)
      
      addItem({
        productId: product.id,
        brandName: product.brand_name,
        packSize: product.pack_size,
        batchId: batch.id,
        batchNumber: batch.batch_number,
        expiryDate: batch.expiry_date,
        availableQuantity: batch.quantity,
        scheduleFlag: product.schedule_flag || 'NONE',
        mrpPaise: unitMrp as any,
        purchaseRatePaise: unitPurchaseRate as any,
        salePricePaise: unitMrp as any, // Default sale price is MRP
        discountPaise: Math.round(unitMrp * 0.10) as any,
        quantityUnits: initialQty, // Default to 1 full pack or whatever is left
        gstRatePct: product.gst_rate_pct,
        isInterState: false // Default to intra-state unless modified
      })
      
    } catch (err: any) {
      setErrorMsg('Failed to fetch batches: ' + err.message)
    }
  }

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Header with Title & Parked Carts Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShoppingBag className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold tracking-tight">Point of Sale</h2>
        </div>

        {/* Parked Carts Tabs */}
        {parkedCarts.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto py-1">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1 shrink-0">
              <PauseCircle className="w-3.5 h-3.5 text-amber-500" />
              Held Bills ({parkedCarts.length}):
            </span>
            {parkedCarts.map((pc) => (
              <div
                key={pc.id}
                className="inline-flex items-center gap-2 px-2.5 py-1 text-xs bg-amber-50/80 border border-amber-300/80 text-amber-900 rounded-lg shadow-2xs hover:bg-amber-100/80 transition group"
              >
                <button
                  type="button"
                  onClick={() => resumeCart(pc.id)}
                  className="font-medium hover:underline flex items-center gap-1 cursor-pointer"
                  title="Click to resume this bill"
                >
                  <PlayCircle className="w-3 h-3 text-amber-700" />
                  <span>{pc.label}</span>
                  <span className="font-bold font-mono">({formatPaise(pc.grandTotalPaise)})</span>
                  <span className="text-[10px] text-amber-700/80">· {pc.parkedAt}</span>
                </button>
                <button
                  type="button"
                  onClick={() => discardParkedCart(pc.id)}
                  className="text-amber-600 hover:text-amber-900 p-0.5 rounded hover:bg-amber-200/60 transition cursor-pointer"
                  title="Discard held bill"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {parkFeedback && (
        <AlertBanner
          type="info"
          message={parkFeedback}
          onDismiss={() => setParkFeedback(null)}
        />
      )}

      {errorMsg && (
        <AlertBanner
          type="error"
          message={errorMsg}
          onDismiss={() => setErrorMsg(null)}
        />
      )}

      <div className="flex gap-4 h-[calc(100vh-170px)]">
        {/* Left Side: Search & Cart */}
        <div className="flex flex-col flex-[3] gap-3">
          <div className="relative z-50">
            <ProductSearchDropdown onSelectProduct={handleProductSelect} />
          </div>
          <CartTable />
        </div>

        {/* Right Side: Totals & Actions */}
        <div className="flex flex-col flex-1 bg-card border rounded-lg shadow-sm p-6 justify-between">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2 mb-6 border-b pb-3">
              <Receipt className="w-5 h-5 text-muted-foreground" />
              Bill Summary
            </h3>
            
            <div className="space-y-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{formatPaise(totals.subtotalPaise)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Discount</span>
                <span className="font-medium text-green-600">-{formatPaise(totals.totalDiscountPaise)}</span>
              </div>
              <div className="flex justify-between border-b pb-4">
                <span className="text-muted-foreground">Tax (GST)</span>
                <span className="font-medium">{formatPaise(totals.totalTaxBreakdown.totalTaxPaise)}</span>
              </div>
              
              <div className="flex justify-between items-end pt-2">
                <span className="text-base font-semibold">Grand Total</span>
                <span className="text-3xl font-bold text-primary tracking-tight">
                  {formatPaise(totals.grandTotalPaise)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-8 space-y-3">
            <button
              disabled={items.length === 0}
              onClick={() => setIsCheckoutOpen(true)}
              className="w-full py-3.5 bg-primary text-primary-foreground font-bold text-base rounded-xl shadow-md hover:bg-primary/90 hover:shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            >
              Checkout / Pay (F12)
            </button>

            <button
              type="button"
              disabled={items.length === 0}
              onClick={() => {
                const success = parkCurrentCart()
                if (success) {
                  setParkFeedback('Current cart parked. You can now serve the next customer.')
                  setTimeout(() => setParkFeedback(null), 4000)
                }
              }}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-sm rounded-lg border border-slate-200 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer flex items-center justify-center gap-1.5"
              title="Park current customer cart to serve next customer (Hotkey: F6)"
            >
              <PauseCircle className="w-4 h-4 text-amber-600" />
              <span>Hold Bill (F6)</span>
            </button>

            <p className="text-xs text-center text-muted-foreground">
              Press <kbd className="px-1.5 py-0.5 bg-muted rounded border text-[11px] font-mono">F12</kbd> to pay · <kbd className="px-1.5 py-0.5 bg-muted rounded border text-[11px] font-mono">F6</kbd> to hold
            </p>
          </div>
        </div>
      </div>

      <CheckoutModal isOpen={isCheckoutOpen} onOpenChange={setIsCheckoutOpen} />
    </div>
  )
}
