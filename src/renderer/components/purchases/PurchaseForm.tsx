import React, { useState } from 'react'
import { usePurchaseStore } from '../../store/purchase.store'
import { useVendors } from '../../hooks/useVendors'
import { PurchaseGrid } from './PurchaseGrid'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import { useAuthStore } from '../../store/auth.store'
import { formatPaise } from '../../../main/utils/paise'
import { FileDown, FileCheck2, Loader2, Save } from 'lucide-react'

export function PurchaseForm() {
  const { 
    vendorId, invoiceNumber, invoiceDate, items, 
    setInvoiceDetails, getTotals, clearPurchase 
  } = usePurchaseStore()
  
  const { user } = useAuthStore()
  const { data: vendors, isLoading: isLoadingVendors } = useVendors()
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totals = getTotals()

  const handleSave = async () => {
    if (!vendorId || !invoiceNumber || items.length === 0 || !user) {
      setError('Please select a vendor, enter invoice number, and add at least one item.')
      return
    }

    // Validate grid items
    const invalidItem = items.find(i => !i.batchNumber || !i.expiryMonth || !i.expiryYear || i.quantityPacks <= 0 || i.purchaseRatePaise <= 0)
    if (invalidItem) {
      setError(`Item "${invalidItem.brandName}" is missing required fields (Batch, Expiry, Qty, or Rate).`)
      return
    }

    setIsSubmitting(true)
    setError(null)
    setSuccess(false)

    try {
      const payload = {
        userId: user.id,
        vendorId,
        invoiceNumber,
        invoiceDate,
        totalAmountPaise: totals.grandTotalPaise,
        items: items.map(item => ({
          productId: item.productId,
          batchNumber: item.batchNumber,
          expiryYear: parseInt(item.expiryYear),
          expiryMonth: parseInt(item.expiryMonth),
          quantityPacks: item.quantityPacks,
          quantityUnits: item.quantityUnits,
          mrpPaise: item.mrpPaise,
          purchaseRatePaise: item.purchaseRatePaise,
          gstRatePct: item.gstRatePct,
          totalPaise: item.totalPaise
        }))
      }

      await window.api.invoke(IPC_CHANNELS.PURCHASES_CREATE, payload)
      
      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        clearPurchase()
      }, 2000)

    } catch (err: any) {
      setError(err.message || 'Failed to save purchase')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileDown className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold tracking-tight">Purchase Entry</h2>
        </div>
        <button
          onClick={handleSave}
          disabled={isSubmitting || items.length === 0}
          className="flex items-center gap-2 px-6 py-2 font-medium text-white transition-colors bg-primary rounded-md hover:bg-primary/90 disabled:opacity-50"
        >
          {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          Save Invoice
        </button>
      </div>

      {error && (
        <div className="p-3 text-sm text-red-500 bg-red-50 rounded-md border border-red-200">
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 text-sm text-green-600 bg-green-50 rounded-md border border-green-200 flex items-center gap-2">
          <FileCheck2 className="w-5 h-5" />
          Purchase invoice saved successfully! Stock has been updated.
        </div>
      )}

      {/* Invoice Header Form */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 bg-card border rounded-lg shadow-sm">
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Supplier / Vendor</label>
          <select
            className="w-full px-3 py-2 border rounded-md outline-none focus:ring-2 focus:ring-primary bg-background"
            value={vendorId || ''}
            onChange={(e) => setInvoiceDetails(Number(e.target.value), invoiceNumber, invoiceDate)}
            disabled={isLoadingVendors}
          >
            <option value="">Select a vendor...</option>
            {vendors?.map(v => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>
        
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Invoice Number</label>
          <input
            type="text"
            className="w-full px-3 py-2 border rounded-md outline-none focus:ring-2 focus:ring-primary bg-background uppercase"
            value={invoiceNumber}
            onChange={(e) => setInvoiceDetails(vendorId!, e.target.value, invoiceDate)}
            placeholder="INV-XXXX"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Invoice Date</label>
          <input
            type="date"
            className="w-full px-3 py-2 border rounded-md outline-none focus:ring-2 focus:ring-primary bg-background"
            value={invoiceDate}
            onChange={(e) => setInvoiceDetails(vendorId!, invoiceNumber, e.target.value)}
          />
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 flex flex-col overflow-hidden bg-card border rounded-lg shadow-sm">
        <PurchaseGrid />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end p-4 bg-card border rounded-lg shadow-sm">
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-sm text-muted-foreground mb-1">Total Items</p>
            <p className="font-semibold">{items.length}</p>
          </div>
          <div className="h-10 w-px bg-border"></div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground mb-1">Grand Total</p>
            <p className="text-2xl font-bold text-primary">{formatPaise(totals.grandTotalPaise)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
