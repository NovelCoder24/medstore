import React, { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import * as Dialog from '@radix-ui/react-dialog'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import { useCartStore } from '../../store/cart.store'
import { useAuthStore } from '../../store/auth.store'
import { useCustomerSearch } from '../../hooks/useCustomers'
import { formatPaise } from '../../../shared/utils/paise'
import { CheckCircle2, Loader2, X, AlertTriangle, Search } from 'lucide-react'

interface CheckoutModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function CheckoutModal({ isOpen, onOpenChange }: CheckoutModalProps) {
  const queryClient = useQueryClient()
  const { items, patient, getTotals, clearCart, updatePatient } = useCartStore()
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'UPI' | 'CARD' | 'CREDIT'>('CASH')
  const [saleId, setSaleId] = useState<number | null>(null)
  const [billNumber, setBillNumber] = useState<string | null>(null)
  const [lastReceiptData, setLastReceiptData] = useState<{ sale: any, items: any[] } | null>(null)

  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const { data: searchResults, isLoading: searching } = useCustomerSearch(customerSearch)
  
  const [showPinOverride, setShowPinOverride] = useState(false)
  const [overridePin, setOverridePin] = useState('')

  React.useEffect(() => {
    if (!success) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        if (lastReceiptData) {
          window.api.invoke(IPC_CHANNELS.PRINT_RECEIPT, lastReceiptData.sale, lastReceiptData.items)
        }
      } else if (e.key === 'Escape' || e.key === ' ') {
        e.preventDefault()
        clearCart()
        onOpenChange(false)
        setSuccess(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [success, lastReceiptData, clearCart, onOpenChange])

  const totals = getTotals()

  const hasScheduleHDrug = items.some(item => ['H', 'H1', 'X'].includes(item.scheduleFlag))
  const isDoctorDetailsIncomplete = !patient.doctorName?.trim() || !patient.doctorRegNo?.trim()

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
        paymentMode,
        
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
          purchaseRatePaise: item.purchaseRatePaise,
          salePricePaise: item.salePricePaise,
          discountPaise: item.discountPaise,
          cgstPaise: item.gstBreakdown.cgstPaise,
          sgstPaise: item.gstBreakdown.sgstPaise,
          igstPaise: item.gstBreakdown.igstPaise,
          lineTotalPaise: item.gstBreakdown.lineTotalPaise
        })),
        customerId: paymentMode === 'CREDIT' ? selectedCustomer?.id : undefined,
        ownerPin: overridePin || undefined
      }

      // Record the sale
      const result = await window.api.invoke(IPC_CHANNELS.SALES_CREATE, payload)
      const { id, billNumber: generatedBillNumber } = result

      // Invalidate products and batch queries so inventory lists reflect stock changes immediately
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['productBatches'] })

      setSaleId(id)
      setBillNumber(generatedBillNumber)
      setSuccess(true)
      
      // Auto-Print the receipt
      try {
        // Construct sale object for the template
        const receiptSale = {
          billNumber: generatedBillNumber,
          patientName: payload.patientName,
          patientPhone: payload.patientPhone,
          doctorName: payload.doctorName,
          doctorRegNo: payload.doctorRegNo,
          paymentMode: payload.paymentMode,
          subtotalPaise: payload.subtotalPaise,
          totalDiscountPaise: payload.totalDiscountPaise,
          totalTaxPaise: totals.totalTaxBreakdown.totalTaxPaise,
          grandTotalPaise: payload.grandTotalPaise
        }
        
        setLastReceiptData({ sale: receiptSale, items })
        await window.api.invoke(IPC_CHANNELS.PRINT_RECEIPT, receiptSale, items)
      } catch (printErr) {
        console.error("Failed to print receipt", printErr)
        // We don't fail the checkout if printing fails, but maybe show a toast in a real app
      }

    } catch (err: any) {
      if (err.message?.includes('CREDIT_LIMIT_EXCEEDED')) {
        setShowPinOverride(true)
        setError('Credit limit exceeded. Owner PIN required.')
      } else {
        setError(err.message || 'Checkout failed')
      }
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
              <p className="text-muted-foreground">Bill {billNumber} has been recorded.</p>
              
              <div className="flex gap-4 w-full mt-6">
                <button
                  type="button"
                  onClick={() => {
                    clearCart()
                    onOpenChange(false)
                    setSuccess(false)
                  }}
                  className="flex-1 px-4 py-2 bg-muted hover:bg-muted-foreground/20 text-foreground font-medium rounded-md transition-colors"
                >
                  Start New Bill (Esc)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (lastReceiptData) {
                      window.api.invoke(IPC_CHANNELS.PRINT_RECEIPT, lastReceiptData.sale, lastReceiptData.items)
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md transition-colors"
                >
                  Print Receipt (Enter)
                </button>
              </div>
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

                <div className="border-t pt-4 space-y-4">
                  {hasScheduleHDrug && isDoctorDetailsIncomplete && (
                    <div className="p-3 text-sm text-yellow-700 bg-yellow-50 rounded-md flex gap-2 items-start border border-yellow-200">
                      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-yellow-600" />
                      <p><strong>Schedule H/H1/X drugs detected in cart.</strong> Doctor Name and Registration Number are legally required.</p>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-muted-foreground">Doctor Name {hasScheduleHDrug ? <span className="text-red-500">*</span> : '(Optional)'}</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border rounded-md outline-none focus:ring-2 focus:ring-primary"
                        value={patient.doctorName}
                        onChange={e => updatePatient({ doctorName: e.target.value })}
                        placeholder="Dr. Smith"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-muted-foreground">Reg No. {hasScheduleHDrug ? <span className="text-red-500">*</span> : ''}</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border rounded-md outline-none focus:ring-2 focus:ring-primary"
                        value={patient.doctorRegNo}
                        onChange={e => updatePatient({ doctorRegNo: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 pt-2">
                  <label className="text-sm font-medium">Payment Mode</label>
                  <div className="grid grid-cols-4 gap-3">
                    {['CASH', 'UPI', 'CARD', 'CREDIT'].map(mode => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setPaymentMode(mode as any)}
                        className={`py-2 px-3 border rounded-md text-sm font-medium transition-colors ${
                          paymentMode === mode 
                            ? 'bg-primary/10 border-primary text-primary' 
                            : 'hover:bg-muted'
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                {paymentMode === 'CREDIT' && (
                  <div className="space-y-2 p-3 bg-muted/30 rounded-md border">
                    <label className="text-sm font-medium">Link to Khata Account <span className="text-red-500">*</span></label>
                    
                    {selectedCustomer ? (
                      <div className="flex items-center justify-between bg-white p-2 border rounded-md">
                        <div>
                          <p className="font-semibold text-sm">{selectedCustomer.name}</p>
                          <p className="text-xs text-muted-foreground">{selectedCustomer.mobile}</p>
                        </div>
                        <button type="button" onClick={() => setSelectedCustomer(null)} className="text-xs text-red-500 hover:underline">Change</button>
                      </div>
                    ) : (
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder="Search customer by name or mobile..."
                          value={customerSearch}
                          onChange={e => setCustomerSearch(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 border rounded-md outline-none focus:ring-2 focus:ring-primary text-sm"
                        />
                        {customerSearch.length > 1 && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto z-10">
                            {searching ? (
                              <div className="p-3 text-center text-sm text-muted-foreground">Searching...</div>
                            ) : searchResults?.length ? (
                              searchResults.map(c => (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedCustomer(c)
                                    if (!patient.name) updatePatient({ name: c.name, phone: c.mobile })
                                  }}
                                  className="w-full text-left px-3 py-2 hover:bg-muted text-sm border-b last:border-0 flex justify-between"
                                >
                                  <span>{c.name} ({c.mobile})</span>
                                  <span className={c.current_balance_paise > 0 ? 'text-red-500' : 'text-green-600'}>
                                    Bal: {formatPaise(c.current_balance_paise)}
                                  </span>
                                </button>
                              ))
                            ) : (
                              <div className="p-3 text-center text-sm text-muted-foreground">No customers found. Add them in the Customers tab.</div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                
                {showPinOverride && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                    <label className="text-sm font-medium text-red-800">Owner PIN Override</label>
                    <input
                      type="password"
                      autoFocus
                      placeholder="Enter Owner PIN"
                      value={overridePin}
                      onChange={e => setOverridePin(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md outline-none focus:ring-2 focus:ring-red-500 mt-1"
                    />
                  </div>
                )}

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
