import React, { useState } from 'react'
import { usePurchaseStore } from '../../store/purchase.store'
import { useVendors } from '../../hooks/useVendors'
import { PurchaseGrid } from './PurchaseGrid'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import { useAuthStore } from '../../store/auth.store'
import { formatPaise } from '../../../main/utils/paise'
import { FileDown, FileCheck2, Loader2, Save, ScanLine } from 'lucide-react'
import type { OcrExtractionResult } from '../../../main/services/ocr.service'

export function PurchaseForm() {
  const { 
    vendorId, invoiceNumber, invoiceDate, items, 
    setInvoiceDetails, getTotals, clearPurchase, addItem, updateItem 
  } = usePurchaseStore()
  
  const { user } = useAuthStore()
  const { data: vendors, isLoading: isLoadingVendors } = useVendors()
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totals = getTotals()

  const handleOcrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const path = (file as any).path
    if (!path) {
      setError('Could not resolve file path for OCR.')
      return
    }

    setIsScanning(true)
    setError(null)
    
    try {
      const result: OcrExtractionResult = await window.api.invoke(IPC_CHANNELS.OCR_EXTRACT, path)
      
      // Try to auto-match vendor by name if possible (simplified here)
      let matchedVendorId = vendorId
      if (result.vendorName && vendors) {
        const match = vendors.find(v => v.name.toLowerCase().includes(result.vendorName!.toLowerCase()))
        if (match) matchedVendorId = match.id
      }
      
      setInvoiceDetails(
        matchedVendorId || 0,
        result.invoiceNumber || invoiceNumber,
        result.invoiceDate || invoiceDate
      )

      // We need to resolve product IDs from the extracted product names.
      // For this implementation, we will query the FTS5 DB for each product name to find the best match.
      for (const item of result.items) {
        const searchParams = { query: item.productName, pageSize: 1 }
        const searchResult = await window.api.invoke(IPC_CHANNELS.PRODUCTS_SEARCH, searchParams)
        
        if (searchResult.data && searchResult.data.length > 0) {
          const product = searchResult.data[0]
          addItem(product)
          
          // Since addItem pushes to the end of the array, the new item's ID isn't immediately known without returning it.
          // In a real app, `addItem` should return the generated `id` so we can `updateItem` immediately, 
          // or we can fetch the last item in the state. Wait, Zustand updates state asynchronously in React but synchronously in store.
          // To make it simple, we'll dispatch a custom event or just trust the user to map it if we rebuild `addItem` to take full objects.
          // Let's rely on the store's sync update pattern.
          usePurchaseStore.setState((state) => {
            const lastItem = state.items[state.items.length - 1]
            lastItem.batchNumber = item.batchNumber
            lastItem.expiryMonth = item.expiryMonth.toString().padStart(2, '0')
            lastItem.expiryYear = item.expiryYear.toString()
            lastItem.quantityPacks = item.quantityPacks
            lastItem.quantityLoose = item.quantityLoose
            lastItem.quantityUnits = (item.quantityPacks * product.pack_size) + item.quantityLoose
            lastItem.mrpPaise = item.mrp * 100
            lastItem.purchaseRatePaise = item.purchaseRate * 100
            lastItem.discountPct = item.discountPct
            
            // Recalc total
            const baseAmount = item.quantityPacks * (item.purchaseRate * 100)
            const discountAmount = Math.round(baseAmount * (item.discountPct / 100))
            lastItem.totalPaise = baseAmount - discountAmount
            
            return { items: [...state.items] }
          })
        } else {
          // Could not find product, skip or add as dummy
          console.warn(`OCR: Could not find product matching ${item.productName}`)
        }
      }

    } catch (err: any) {
      setError('OCR Failed: ' + (err.message || 'Unknown error'))
    } finally {
      setIsScanning(false)
      // Reset input so the same file can be selected again
      e.target.value = ''
    }
  }

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
        <div className="flex gap-2">
          <label className="flex items-center gap-2 px-4 py-2 font-medium text-primary bg-primary/10 transition-colors rounded-md hover:bg-primary/20 cursor-pointer disabled:opacity-50">
            {isScanning ? <Loader2 className="w-5 h-5 animate-spin" /> : <ScanLine className="w-5 h-5" />}
            {isScanning ? 'Scanning...' : 'Scan Bill with AI'}
            <input 
              type="file" 
              className="hidden" 
              accept="image/*,application/pdf"
              onChange={handleOcrUpload}
              disabled={isScanning}
            />
          </label>
          <button
            onClick={handleSave}
            disabled={isSubmitting || items.length === 0}
            className="flex items-center gap-2 px-6 py-2 font-medium text-white transition-colors bg-primary rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            Save Invoice
          </button>
        </div>
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
