import React, { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { usePurchaseStore } from '../../store/purchase.store'
import { useVendors } from '../../hooks/useVendors'
import { PurchaseGrid } from './PurchaseGrid'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import { useAuthStore } from '../../store/auth.store'
import { formatPaise, toPaise } from '../../../shared/utils/paise'
import { FileDown, FileCheck2, Loader2, Save, ScanLine } from 'lucide-react'
import type { OcrExtractionResult } from '../../../shared/types'

function extractPackSize(packText: string | null | undefined): number {
  if (!packText) return 1
  // Remove spaces and make uppercase for easy checking
  const normalized = packText.toUpperCase().replace(/\s+/g, '');

  // 1. INDIVISIBLE ITEMS (Syrups, Ointments, Drops, Injections)
  const indivisibleKeywords = ['ML', 'GM', 'KG', 'LTR', 'VIAL', 'AMP', 'TUBE', 'BOTTLE', 'DROP'];

  if (indivisibleKeywords.some(keyword => normalized.includes(keyword))) {
    return 1;
  }

  // 2. DIVISIBLE ITEMS (Strips/Blisters)
  // Example: "1X15" (1 strip of 15) -> We want the 15
  if (normalized.includes('X')) {
    const parts = normalized.split('X');
    return parseInt(parts[parts.length - 1], 10) || 1;
  }

  // Example: "10'S", "15TABS", "10" -> Extract the last number found
  const match = normalized.match(/\d+/g);
  if (match && match.length > 0) {
    return parseInt(match[match.length - 1], 10) || 1;
  }

  return 1
}

export function PurchaseForm() {
  const queryClient = useQueryClient()
  const {
    vendorId, invoiceNumber, invoiceDate, items,
    setInvoiceDetails, getTotals, clearPurchase, addItem, updateItem, setManualGrandTotal
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

    const arrayBuffer = await file.arrayBuffer()
    const mimeType = file.type

    setIsScanning(true)
    setError(null)

    try {
      const result: OcrExtractionResult = await window.api.invoke(IPC_CHANNELS.OCR_EXTRACT, { buffer: arrayBuffer, mimeType })

      // Try to auto-match vendor by GSTIN first, then by name
      let matchedVendorId = vendorId
      if (vendors) {
        if (result.vendorGstin) {
          const match = vendors.find(v => v.gstin?.toUpperCase() === result.vendorGstin!.toUpperCase())
          if (match) matchedVendorId = match.id
        }

        if (!matchedVendorId && result.vendorName) {
          const match = vendors.find(v => v.name.toLowerCase().includes(result.vendorName!.toLowerCase()))
          if (match) matchedVendorId = match.id
        }
      }

      if (!matchedVendorId && result.vendorName) {
        try {
          const newVendor = await window.api.invoke(IPC_CHANNELS.VENDORS_CREATE, {
            name: result.vendorName,
            gstin: result.vendorGstin || null
          })
          matchedVendorId = newVendor.id
          await queryClient.invalidateQueries({ queryKey: ['vendors'] })
        } catch (e) {
          console.error("Failed to auto-create vendor:", e)
        }
      }

      setInvoiceDetails(
        matchedVendorId || 0,
        result.invoiceNumber || invoiceNumber,
        result.invoiceDate || invoiceDate
      )

      // We need to resolve product IDs from the extracted product names.
      for (const item of result.items) {
        const searchParams = { query: item.productName || '', pageSize: 1 }
        const searchResult = await window.api.invoke(IPC_CHANNELS.PRODUCTS_SEARCH, searchParams)

        const purchaseRatePaise = toPaise(item.purchaseRate)
        const baseAmount = (item.quantityPacks || 0) * purchaseRatePaise
        const taxableValue = baseAmount * (1 - (item.discountPct || 0) / 100)
        const gstAmount = taxableValue * ((item.gstRatePct || 0) / 100)
        const totalPaise = Math.round(taxableValue + gstAmount)

        let productToUse
        let isDummy = false
        let dbPackSize = 1

        if (searchResult.data && searchResult.data.length > 0) {
          productToUse = searchResult.data[0]
          dbPackSize = productToUse.pack_size
        } else {
          // Unrecognized product
          isDummy = true
          dbPackSize = extractPackSize(item.packText) // Use the new helper!
          productToUse = {
            id: null,
            brand_name: item.productName || '(unrecognized product)',
            pack_size: dbPackSize,
            gst_rate_pct: item.gstRatePct || 0
          }
          console.warn(`OCR: Added dummy product for ${item.productName}`)
        }

        // Build the complete item FIRST, then add it to Zustand
        addItem({
          ...productToUse,
          needsProductLink: isDummy,
          ocrProductNameRaw: item.productName || '',
          batchNumber: item.batchNumber || '',
          expiryMonth: item.expiryMonth ? item.expiryMonth.toString().padStart(2, '0') : '',
          expiryYear: item.expiryYear ? item.expiryYear.toString() : '',
          quantityPacks: item.quantityPacks || 0,
          quantityLoose: item.quantityLoose || 0,
          quantityUnits: ((item.quantityPacks || 0) * dbPackSize) + (item.quantityLoose || 0),
          mrpPaise: toPaise(item.mrp),
          purchaseRatePaise: purchaseRatePaise,
          netRatePaise: toPaise(item.netRateRupees || item.purchaseRate),
          discountPct: item.discountPct || 0,
          gstRatePct: item.gstRatePct || 0,
          hsnCode: item.hsnCode || '',
          totalPaise: totalPaise
        } as any)
      }

    } catch (err: any) {
      // If it's the timeout error we explicitly threw, use its message
      const msg = err.message || 'Unknown error'
      if (msg.includes('timed out')) {
        setError(msg)
      } else {
        setError(`OCR Failed: ${msg}. Please proceed with manual entry.`)
      }
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
    const invalidItem = items.find(i => {
      const hasNoQty = (i.quantityPacks <= 0 && (i.quantityLoose || 0) <= 0); // Allow free items!
      const missingDetails = !i.batchNumber || !i.expiryMonth || !i.expiryYear;
      return missingDetails || hasNoQty; 
      // Notice we removed the purchaseRate <= 0 check, because free scheme items are ₹0.
    })

    if (invalidItem) {
      setError(`Item "${invalidItem.brandName}" is missing required fields (Batch, Expiry, or Qty).`)
      return
    }

    setIsSubmitting(true)
    setError(null)
    setSuccess(false)

    try {
      // Auto-create any unmatched dummy products in the database
      const resolvedItems = await Promise.all(items.map(async (item) => {
        if (item.needsProductLink || !item.productId) {
          const newProduct = await window.api.invoke(IPC_CHANNELS.PRODUCTS_CREATE, {
            brand_name: item.ocrProductNameRaw || item.brandName,
            generic_name: '',
            category: 'GENERIC', // Default fallback that respects DB CHECK constraint
            pack_size: item.packSize || (item as any).pack_size || 1, // <--- Correctly uses the parsed size
            gst_rate_pct: item.gstRatePct || 0,
            hsn_code: item.hsnCode || null,
            schedule_flag: 'NONE'
          })
          
          // Invalidate products query in background so other lists update
          queryClient.invalidateQueries({ queryKey: ['products'] })
          
          return {
            ...item,
            productId: newProduct.id,
            needsProductLink: false
          }
        }
        return item
      }))

      const payload = {
        userId: user.id,
        vendorId,
        invoiceNumber,
        invoiceDate,
        totalAmountPaise: totals.grandTotalPaise,
        items: resolvedItems.map(item => {
          // Convert month/year to YYYY-MM-DD (last day of month)
          const yr = parseInt(item.expiryYear)
          const mo = parseInt(item.expiryMonth)
          // new Date(year, month, 0) gives the last day of the previous month
          // so new Date(2025, 8, 0) = Aug 31, 2025 (month is 1-indexed here via this trick)
          const lastDay = new Date(yr, mo, 0).getDate()
          const expiryDate = `${yr}-${String(mo).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

          return {
            productId: item.productId,
            batchNumber: item.batchNumber,
            expiryDate,
            quantityPacks: item.quantityPacks,
            quantityUnits: item.quantityUnits,
            mrpPaise: item.mrpPaise,
            purchaseRatePaise: item.purchaseRatePaise,
            netRatePaise: item.netRatePaise,
            gstRatePct: item.gstRatePct,
            totalPaise: item.totalPaise
          }
        })
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
            <div className="flex items-center justify-end gap-1">
              <span className="text-2xl font-bold text-primary">₹</span>
              <input 
                type="number"
                step="0.01"
                className="text-2xl font-bold text-primary w-32 text-right bg-transparent border-b-2 border-transparent hover:border-border focus:border-primary outline-none transition-colors"
                value={totals.grandTotalPaise !== undefined ? totals.grandTotalPaise / 100 : ''}
                onChange={(e) => {
                  if (e.target.value === '') {
                    setManualGrandTotal(null)
                  } else {
                    const val = parseFloat(e.target.value) || 0;
                    setManualGrandTotal(Math.round(val * 100));
                  }
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
