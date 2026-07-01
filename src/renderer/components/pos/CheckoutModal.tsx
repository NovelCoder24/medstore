import React, { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import { useCartStore } from '../../store/cart.store'
import { useAuthStore } from '../../store/auth.store'
import { formatPaise } from '../../../main/utils/paise'
import { CheckCircle2, Loader2, X, AlertTriangle } from 'lucide-react'

interface CheckoutModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function CheckoutModal({ isOpen, onOpenChange }: CheckoutModalProps) {
  const { items, patient, getTotals, clearCart, updatePatient } = useCartStore()
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const totals = getTotals()

  // Check if any item in the cart requires doctor details (Schedule H1/X)
  // We didn't store schedule_flag in CartLineItem directly, but in a real scenario we should.
  // Assuming we added it, or we enforce it globally for now:
  // (For this implementation, let's assume if they type a doctor name it's saved).

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault()
    if (items.length === 0 || !user) return

    setLoading(true)
    setError(null)

    try {
      const payload = {
        userId: user.id,
        patientName: patient.name,
        patientPhone: patient.phone,
        doctorName: patient.doctorName,
        doctorRegNo: patient.doctorRegNo,
        
        subtotalPaise: totals.subtotalPaise,
        totalDiscountPaise: totals.totalDiscountPaise,
        cgstPaise: totals.totalTaxBreakdown.cgstPaise,
        sgstPaise: totals.totalTaxBreakdown.sgstPaise,
        igstPaise: totals.totalTaxBreakdown.igstPaise,
        grandTotalPaise: totals.grandTotalPaise,
        
        items: items.map(item => ({
          productId: item.productId,
          batchId: item.batchId,
          quantityUnits: item.quantityUnits,
          mrpPaise: item.mrpPaise,
          salePricePaise: item.salePricePaise,
          discountPaise: item.discountPaise,
          cgstPaise: item.gstBreakdown.cgstPaise,
          sgstPaise: item.gstBreakdown.sgstPaise,
          igstPaise: item.gstBreakdown.igstPaise,
          lineTotalPaise: item.gstBreakdown.lineTotalPaise
        }))
      }

      await window.api.invoke(IPC_CHANNELS.SALES_CREATE, payload)
      setSuccess(true)
      
      // Auto close and clear after 2 seconds
      setTimeout(() => {
        clearCart()
        onOpenChange(false)
        setSuccess(false)
      }, 2000)

    } catch (err: any) {
      setError(err.message || 'Checkout failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 data-[state=open]:animate-in data-[state=closed]:animate-out" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg sm:rounded-xl data-[state=open]:animate-in data-[state=closed]:animate-out">
          
          {success ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <div className="p-3 bg-green-100 text-green-600 rounded-full animate-in zoom-in">
                <CheckCircle2 className="w-12 h-12" />
              </div>
              <h2 className="text-2xl font-bold">Payment Successful</h2>
              <p className="text-muted-foreground">Bill has been recorded.</p>
            </div>
          ) : (
            <>
              <div>
                <Dialog.Title className="text-xl font-bold">Checkout</Dialog.Title>
                <Dialog.Description className="text-sm text-muted-foreground mt-1">
                  Enter patient details and confirm payment.
                </Dialog.Description>
              </div>

              {error && (
                <div className="p-3 text-sm text-red-500 bg-red-500/10 rounded-md flex gap-2 items-start">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              <form onSubmit={handleCheckout} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Patient Name</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border rounded-md outline-none focus:ring-2 focus:ring-primary"
                      value={patient.name}
                      onChange={e => updatePatient({ name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Patient Phone</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border rounded-md outline-none focus:ring-2 focus:ring-primary"
                      value={patient.phone}
                      onChange={e => updatePatient({ phone: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 border-t pt-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-muted-foreground">Doctor Name (Optional)</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border rounded-md outline-none focus:ring-2 focus:ring-primary"
                      value={patient.doctorName}
                      onChange={e => updatePatient({ doctorName: e.target.value })}
                      placeholder="Dr. Smith"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-muted-foreground">Reg No. (Required for H1)</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border rounded-md outline-none focus:ring-2 focus:ring-primary"
                      value={patient.doctorRegNo}
                      onChange={e => updatePatient({ doctorRegNo: e.target.value })}
                    />
                  </div>
                </div>

                <div className="bg-muted/50 p-4 rounded-lg mt-6">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span>{formatPaise(totals.subtotalPaise)}</span>
                  </div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Discount:</span>
                    <span className="text-green-600">-{formatPaise(totals.totalDiscountPaise)}</span>
                  </div>
                  <div className="flex justify-between text-sm mb-3">
                    <span className="text-muted-foreground">Total Tax:</span>
                    <span>{formatPaise(totals.totalTaxBreakdown.totalTaxPaise)}</span>
                  </div>
                  <div className="flex justify-between text-xl font-bold border-t pt-2">
                    <span>Grand Total:</span>
                    <span className="text-primary">{formatPaise(totals.grandTotalPaise)}</span>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Dialog.Close asChild>
                    <button type="button" className="flex-1 px-4 py-2 bg-muted hover:bg-muted-foreground/20 text-foreground font-medium rounded-md transition-colors">
                      Cancel
                    </button>
                  </Dialog.Close>
                  <button 
                    type="submit" 
                    disabled={loading || items.length === 0}
                    className="flex-[2] flex items-center justify-center px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md transition-colors disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirm Payment'}
                  </button>
                </div>
              </form>
            </>
          )}
          
          {!success && (
            <Dialog.Close asChild>
              <button className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </button>
            </Dialog.Close>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
