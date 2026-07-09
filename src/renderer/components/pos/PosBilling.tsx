import React, { useState } from 'react'
import { ProductSearchDropdown } from './ProductSearchDropdown'
import { CartTable } from './CartTable'
import { CheckoutModal } from './CheckoutModal'
import { useCartStore } from '../../store/cart.store'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import { formatPaise } from '../../../shared/utils/paise'
import { ShoppingBag, Receipt } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'

export function PosBilling() {
  const { addItem, getTotals, items } = useCartStore()
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  
  const totals = getTotals()

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
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center gap-2 mb-2">
        <ShoppingBag className="w-6 h-6 text-primary" />
        <h2 className="text-2xl font-bold tracking-tight">Point of Sale</h2>
      </div>

      <div className="flex gap-4 h-[calc(100vh-140px)]">
        {/* Left Side: Search & Cart */}
        <div className="flex flex-col flex-[3] gap-4">
          <div className="relative z-50">
            <ProductSearchDropdown onSelectProduct={handleProductSelect} />
            {errorMsg && (
              <p className="text-sm text-red-500 mt-2 px-2 animate-in slide-in-from-top-2">{errorMsg}</p>
            )}
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
              className="w-full py-4 bg-primary text-primary-foreground font-bold text-lg rounded-xl shadow-md hover:bg-primary/90 hover:shadow-lg hover:-translate-y-0.5 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
            >
              Checkout / Pay
            </button>
            <p className="text-xs text-center text-muted-foreground">
              Press F12 to checkout (Shortcut)
            </p>
          </div>
        </div>
      </div>

      <CheckoutModal isOpen={isCheckoutOpen} onOpenChange={setIsCheckoutOpen} />
    </div>
  )
}
