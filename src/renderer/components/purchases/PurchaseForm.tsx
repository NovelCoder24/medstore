import React, { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { usePurchaseStore, PurchaseLineItem } from '../../store/purchase.store'
import { useVendors } from '../../hooks/useVendors'
import { PurchaseGrid } from './PurchaseGrid'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import { useAuthStore } from '../../store/auth.store'
import {
  FileDown,
  Loader2,
  Save,
  ScanLine,
  History as HistoryIcon,
  AlertTriangle,
  Layers,
  Eye,
  EyeOff
} from 'lucide-react'
import type { OcrExtractionResult, OcrQueueItem, OcrQueueUpdateEvent, OcrQueueSummaryItem } from '../../../shared/types'
import { toPaise, formatPaise } from '../../../shared/utils/paise'
import { PurchaseHistory } from './PurchaseHistory'
import { OcrReviewQueue } from './OcrReviewQueue'
import { InvoiceDocumentViewer } from './InvoiceDocumentViewer'
import { PurchaseProductSearch } from './PurchaseProductSearch'
import { VendorCombobox } from './VendorCombobox'

function extractPackSize(packText: string | null | undefined): number {
  if (!packText) return 1
  const normalized = packText.toUpperCase().replace(/\s+/g, '')

  const indivisibleKeywords = ['ML', 'GM', 'KG', 'LTR', 'VIAL', 'AMP', 'TUBE', 'BOTTLE', 'DROP']
  if (indivisibleKeywords.some(keyword => normalized.includes(keyword))) {
    return 1
  }

  if (normalized.includes('X')) {
    const parts = normalized.split('X')
    return parseInt(parts[parts.length - 1], 10) || 1
  }

  const match = normalized.match(/\d+/g)
  if (match && match.length > 0) {
    return parseInt(match[match.length - 1], 10) || 1
  }

  return 1
}

export function PurchaseForm() {
  const queryClient = useQueryClient()
  const {
    vendorId,
    invoiceNumber,
    invoiceDate,
    items,
    activeQueueItemId,
    invoicePreview,
    showInvoicePreview,
    setInvoiceDetails,
    setActiveQueueItemId,
    setInvoicePreview,
    setShowInvoicePreview,
    toggleInvoicePreview,
    getTotals,
    clearPurchase,
    setAllItems
  } = usePurchaseStore()

  const { user } = useAuthStore()
  const { data: vendors, isLoading: isLoadingVendors } = useVendors()

  const [activeTab, setActiveTab] = useState<'ENTRY' | 'QUEUE' | 'HISTORY'>('ENTRY')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [queueReadyCount, setQueueReadyCount] = useState(0)
  const [queueFileName, setQueueFileName] = useState<string>('')
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null)

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 7000)
      return () => clearTimeout(timer)
    }
  }, [error])

  // Track Ready count in Review Queue
  useEffect(() => {
    const fetchQueueCount = async () => {
      try {
        const list: OcrQueueSummaryItem[] = await window.api.invoke(IPC_CHANNELS.OCR_QUEUE_LIST)
        if (list) {
          setQueueReadyCount(list.filter(i => i.status === 'READY').length)
        }
      } catch (e) {
        console.error('Failed to fetch queue list count:', e)
      }
    }
    fetchQueueCount()

    const unsub = window.api.on(IPC_CHANNELS.OCR_QUEUE_UPDATED, async (evt: OcrQueueUpdateEvent) => {
      if (evt?.summary) {
        setQueueReadyCount(evt.summary.ready)
      } else {
        fetchQueueCount()
      }
    })

    return () => unsub()
  }, [])

  const checkDuplicate = async (invNum: string, vId: number | null) => {
    if (!invNum || !invNum.trim()) {
      setDuplicateWarning(null)
      return
    }
    try {
      const res = await window.api.invoke(IPC_CHANNELS.PURCHASES_CHECK_EXISTS, {
        invoiceNumber: invNum.trim(),
        vendorId: vId || null
      })
      if (res && res.exists) {
        setDuplicateWarning(
          `already exist invoice: Invoice #${invNum.trim()} from ${res.invoice?.vendor_name || 'this supplier'} (${res.invoice?.invoice_date || ''}) is already in the database.`
        )
      } else {
        setDuplicateWarning(null)
      }
    } catch (e) {
      // non-blocking
    }
  }

  const handleClear = () => {
    const hasData = items.length > 0 || !!invoiceNumber || !!vendorId
    if (hasData) {
      if (window.confirm('Are you sure you want to clear all added purchase items and reset the form?')) {
        clearPurchase()
        setError(null)
        setDuplicateWarning(null)
        setSuccess(false)
        setQueueFileName('')
      }
    } else {
      clearPurchase()
      setError(null)
      setDuplicateWarning(null)
      setSuccess(false)
      setQueueFileName('')
    }
  }

  const totals = getTotals()

  /**
   * Loads an OCR extraction result into the purchase store state.
   * Auto-matches or creates the vendor, maps pre-computed suggested matches,
   * calculates paise totals, and opens the Inward Stock template with 2 dropdown sections.
   */
  const loadExtractionIntoState = async (
    result: OcrExtractionResult,
    queueId?: number,
    fileName?: string
  ) => {
    try {
      if (!result) {
        alert('Invoice extraction data is empty or invalid.')
        return
      }

      setQueueFileName(fileName || '')

      // Fetch source invoice document for side-by-side preview if loaded from queue
      if (queueId) {
        try {
          const fileData = await window.api.invoke(IPC_CHANNELS.OCR_QUEUE_GET_FILE, queueId)
          if (fileData?.dataUrl) {
            setInvoicePreview({
              dataUrl: fileData.dataUrl,
              mimeType: fileData.mimeType,
              fileName: fileData.fileName || fileName || `Invoice #${queueId}`
            })
          }
        } catch (fErr) {
          console.warn('Could not load original invoice file for preview:', fErr)
        }
      }

      // 1. Try to auto-match vendor by GSTIN first, then by name
      let matchedVendor: any = null
      if (vendors && Array.isArray(vendors)) {
        if (result.vendorGstin && typeof result.vendorGstin === 'string' && result.vendorGstin.trim()) {
          const searchGstin = result.vendorGstin.trim().toUpperCase()
          matchedVendor = vendors.find(v => v?.gstin && typeof v.gstin === 'string' && v.gstin.trim().toUpperCase() === searchGstin) || null
        }

        if (!matchedVendor && result.vendorName && typeof result.vendorName === 'string' && result.vendorName.trim()) {
          const searchName = result.vendorName.trim().toLowerCase()
          matchedVendor =
            vendors.find(v => {
              if (!v?.name || typeof v.name !== 'string') return false
              const vName = v.name.trim().toLowerCase()
              return vName === searchName || vName.includes(searchName) || searchName.includes(vName)
            }) || null
        }
      }

      let matchedVendorId = matchedVendor?.id || vendorId

      if (matchedVendor) {
        // Update missing fields
        const updatesToApply: Record<string, string> = {}
        if (!matchedVendor.contact_phone && result.vendorPhone && typeof result.vendorPhone === 'string') {
          updatesToApply.contact_phone = result.vendorPhone.trim()
        }
        if (!matchedVendor.contact_email && result.vendorEmail && typeof result.vendorEmail === 'string') {
          updatesToApply.contact_email = result.vendorEmail.trim().toLowerCase()
        }
        if (!matchedVendor.address && result.vendorAddress && typeof result.vendorAddress === 'string') {
          updatesToApply.address = result.vendorAddress.trim()
        }
        if (!matchedVendor.gstin && result.vendorGstin && typeof result.vendorGstin === 'string') {
          updatesToApply.gstin = result.vendorGstin.trim().toUpperCase()
        }

        if (Object.keys(updatesToApply).length > 0) {
          try {
            await window.api.invoke(IPC_CHANNELS.VENDORS_UPDATE, { id: matchedVendor.id, data: updatesToApply })
            await queryClient.invalidateQueries({ queryKey: ['vendors'] })
          } catch (e) {
            console.error('Failed to sync missing vendor fields from OCR:', e)
          }
        }
      } else if (result.vendorName && typeof result.vendorName === 'string' && result.vendorName.trim()) {
        // Auto-create new vendor
        try {
          const newVendor = await window.api.invoke(IPC_CHANNELS.VENDORS_CREATE, {
            name: result.vendorName.trim(),
            gstin: result.vendorGstin && typeof result.vendorGstin === 'string' ? result.vendorGstin.trim().toUpperCase() : null,
            contact_phone: result.vendorPhone && typeof result.vendorPhone === 'string' ? result.vendorPhone.trim() : null,
            contact_email: result.vendorEmail && typeof result.vendorEmail === 'string' ? result.vendorEmail.trim().toLowerCase() : null,
            address: result.vendorAddress && typeof result.vendorAddress === 'string' ? result.vendorAddress.trim() : null
          })
          if (newVendor?.id) {
            matchedVendorId = newVendor.id
          }
          await queryClient.invalidateQueries({ queryKey: ['vendors'] })
        } catch (e) {
          await queryClient.invalidateQueries({ queryKey: ['vendors'] })
        }
      }

      // Check duplicate invoice in database (non-blocking for review, but flags with banner & prevents duplicate save)
      const invoiceNumberToScan = (result.invoiceNumber || '').trim()
      if (invoiceNumberToScan) {
        try {
          const check = await window.api.invoke(IPC_CHANNELS.PURCHASES_CHECK_EXISTS, {
            invoiceNumber: invoiceNumberToScan,
            vendorId: matchedVendorId || null
          })
          if (check && check.exists) {
            const warnMsg = `already exist invoice: Tax Invoice #${invoiceNumberToScan} from ${check.invoice?.vendor_name || 'supplier'} (dated ${check.invoice?.invoice_date || ''}) is already in the database.`
            setDuplicateWarning(warnMsg)
            setError(warnMsg)
          } else {
            setDuplicateWarning(null)
          }
        } catch (checkErr) {
          console.error('Failed to check duplicate invoice during OCR load:', checkErr)
        }
      } else {
        setDuplicateWarning(null)
      }

      setInvoiceDetails(
        matchedVendorId || 0,
        result.invoiceNumber || invoiceNumber || '',
        result.invoiceDate || invoiceDate || new Date().toISOString().split('T')[0],
        'OCR'
      )

      if (queueId) {
        setActiveQueueItemId(queueId)
      }

      // Build line items with pre-computed suggested matches and flag reasons
      const parsedItems: PurchaseLineItem[] = []
      const itemsToParse = Array.isArray(result.items) ? result.items : []
      for (const item of itemsToParse) {
        const purchaseRatePaise = toPaise(item.purchaseRate)
        const baseAmount = (item.quantityPacks || 0) * purchaseRatePaise
        const taxableValue = baseAmount * (1 - (item.discountPct || 0) / 100)
        const gstAmount = taxableValue * ((item.gstRatePct || 0) / 100)
        const totalPaise = Math.round(taxableValue + gstAmount)

        // Use pre-computed suggested matches if available
        let productId = item.suggestedMatches && item.suggestedMatches.length > 0 ? item.suggestedMatches[0].id : null
        let brandName = item.suggestedMatches && item.suggestedMatches.length > 0 ? item.suggestedMatches[0].brandName : (item.productName || '(unrecognized)')
        let packSize = item.suggestedMatches && item.suggestedMatches.length > 0 ? item.suggestedMatches[0].packSize : extractPackSize(item.packText)
        let needsProductLink = !productId

        // If item was exact match, link cleanly
        if (!item.isFlagged && item.suggestedMatches && item.suggestedMatches.length > 0) {
          productId = item.suggestedMatches[0].id
          brandName = item.suggestedMatches[0].brandName
          packSize = item.suggestedMatches[0].packSize
          needsProductLink = false
        }

        // Strip any legacy/stale 'Rate × Qty' flags and rely strictly on image visibility & confidence
        const cleanFlagReasons = (item.flagReasons || []).filter(
          r => !r.includes('Rate × Qty') && !r.includes('differs from invoice line total')
        )
        const isFlagged = (item.confidence !== undefined && item.confidence < 0.80) ||
          !item.batchNumber || !item.batchNumber.trim() ||
          !item.expiryMonth || !item.expiryYear ||
          cleanFlagReasons.length > 0

        parsedItems.push({
          id: crypto.randomUUID(),
          productId: productId as any,
          brandName,
          packSize,
          gstRatePct: item.gstRatePct || 0,
          hsnCode: item.hsnCode || '',
          batchNumber: item.batchNumber || '',
          expiryMonth: item.expiryMonth ? item.expiryMonth.toString().padStart(2, '0') : '',
          expiryYear: item.expiryYear ? item.expiryYear.toString() : '',
          quantityPacks: item.quantityPacks || 0,
          quantityLoose: item.quantityLoose || 0,
          quantityUnits: ((item.quantityPacks || 0) * packSize) + (item.quantityLoose || 0),
          mrpPaise: toPaise(item.mrp),
          purchaseRatePaise,
          netRatePaise: toPaise(item.netRateRupees || item.purchaseRate),
          discountPct: item.discountPct || 0,
          totalPaise,
          needsProductLink,
          ocrProductNameRaw: item.productName || '',
          confidence: item.confidence,
          isFlagged,
          flagReasons: cleanFlagReasons,
          suggestedMatches: item.suggestedMatches || []
        })
      }

      setAllItems(parsedItems)
      setActiveTab('ENTRY')
    } catch (err: any) {
      console.error('Failed to load invoice into state:', err)
      setError(`Failed to open invoice: ${err?.message || 'Unknown error'}`)
      alert(`Could not load invoice data: ${err?.message || 'Unknown error'}`)
    }
  }

  const handleSave = async () => {
    if (!vendorId || !invoiceNumber || items.length === 0 || !user) {
      setError('Please select a vendor, enter invoice number, and add at least one item.')
      return
    }

    // Validate grid items
    const invalidItem = items.find(i => {
      const hasNoQty = i.quantityPacks <= 0 && (i.quantityLoose || 0) <= 0
      const missingDetails = !i.batchNumber || !i.expiryMonth || !i.expiryYear
      return missingDetails || hasNoQty
    })

    if (invalidItem) {
      setError(`Item "${invalidItem.brandName}" is missing required fields (Batch, Expiry, or Qty).`)
      return
    }

    if (duplicateWarning) {
      setError(duplicateWarning)
      return
    }

    try {
      const check = await window.api.invoke(IPC_CHANNELS.PURCHASES_CHECK_EXISTS, {
        invoiceNumber: invoiceNumber.trim(),
        vendorId: vendorId || null
      })
      if (check && check.exists) {
        setError(
          `already exist invoice: Invoice #${invoiceNumber.trim()} from ${check.invoice?.vendor_name || 'this supplier'} already exists in database.`
        )
        return
      }
    } catch (e) { }

    setIsSubmitting(true)
    setError(null)
    setSuccess(false)

    try {
      // Auto-create any unmatched dummy products in the database
      const resolvedItems = await Promise.all(
        items.map(async item => {
          if (item.needsProductLink || !item.productId) {
            const newProduct = await window.api.invoke(IPC_CHANNELS.PRODUCTS_CREATE, {
              brand_name: item.brandName && item.brandName !== '(unrecognized)' ? item.brandName : item.ocrProductNameRaw || 'Unknown Product',
              category: 'GENERIC',
              schedule_flag: 'NONE',
              pack_size: item.packSize || 1,
              gst_rate_pct: item.gstRatePct || 12,
              hsn_code: item.hsnCode || '3004'
            })
            return {
              ...item,
              productId: newProduct.id,
              needsProductLink: false
            }
          }
          return item
        })
      )

      const payload = {
        vendorId,
        invoiceNumber: invoiceNumber.trim(),
        invoiceDate,
        source: 'MANUAL',
        userId: user.id,
        items: resolvedItems.map(item => {
          const m = item.expiryMonth.padStart(2, '0')
          const y = item.expiryYear
          const lastDay = new Date(Number(y), Number(m), 0).getDate()
          const expiryDate = `${y}-${m}-${lastDay.toString().padStart(2, '0')}`

          return {
            productId: item.productId!,
            batchNumber: item.batchNumber.trim().toUpperCase(),
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

      // If loaded from Review Queue, mark as APPROVED in queue
      if (activeQueueItemId) {
        try {
          await window.api.invoke(IPC_CHANNELS.OCR_QUEUE_UPDATE_STATUS, {
            id: activeQueueItemId,
            status: 'APPROVED'
          })
          setActiveQueueItemId(null)
        } catch (qErr) {
          console.error('Failed to update queue item status to APPROVED:', qErr)
        }
      }

      // Invalidate queries so inventory lists and invoice history update immediately
      await queryClient.invalidateQueries({ queryKey: ['products'] })
      await queryClient.invalidateQueries({ queryKey: ['productBatches'] })
      await queryClient.invalidateQueries({ queryKey: ['vendors'] })
      await queryClient.invalidateQueries({ queryKey: ['purchaseInvoices'] })

      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        clearPurchase()
        setQueueFileName('')
        setActiveTab('HISTORY')
      }, 1200)
    } catch (err: any) {
      const msg = err.message || ''
      if (msg.includes('already exists')) {
        const warnMsg = `already exist invoice: ${msg}`
        setDuplicateWarning(warnMsg)
        setError(warnMsg)
      } else {
        setError(msg || 'Failed to save purchase invoice')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Top Header & Tab Switcher */}
      <div className="flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <FileDown className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-bold tracking-tight">Stock Purchases</h2>
            {queueFileName && (
              <span className="text-xs bg-muted px-2.5 py-0.5 rounded-full font-mono text-muted-foreground border">
                File: {queueFileName}
              </span>
            )}
          </div>

          <div className="flex bg-muted/60 p-1 rounded-xl border border-border">
            <button
              onClick={() => setActiveTab('ENTRY')}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${activeTab === 'ENTRY'
                  ? 'bg-background text-primary shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              <ScanLine className="w-4 h-4" />
              Inward Stock
            </button>

            <button
              onClick={() => setActiveTab('QUEUE')}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${activeTab === 'QUEUE'
                  ? 'bg-background text-primary shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              <Layers className="w-4 h-4" />
              <span>Review Queue</span>
              {queueReadyCount > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-extrabold bg-emerald-600 text-white rounded-full">
                  {queueReadyCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('HISTORY')}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${activeTab === 'HISTORY'
                  ? 'bg-background text-primary shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              <HistoryIcon className="w-4 h-4" />
              Past Purchase Invoices
            </button>
          </div>
        </div>

        {activeTab === 'ENTRY' && (
          <div className="flex items-center gap-3">
            {invoicePreview && (
              <button
                type="button"
                onClick={toggleInvoicePreview}
                className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md border transition cursor-pointer ${
                  showInvoicePreview
                    ? 'bg-slate-100 text-slate-800 border-slate-300'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
                title={showInvoicePreview ? 'Hide original invoice preview' : 'View original invoice preview'}
              >
                {showInvoicePreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                <span>{showInvoicePreview ? 'Hide Invoice Scan' : 'View Invoice Scan'}</span>
              </button>
            )}

            <button
              onClick={handleSave}
              disabled={isSubmitting || items.length === 0 || !!duplicateWarning}
              className="flex items-center gap-2 px-6 py-2 font-medium text-white transition-colors bg-primary rounded-md hover:bg-primary/90 disabled:opacity-50 shadow-sm cursor-pointer"
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Save Invoice
            </button>
          </div>
        )}
      </div>

      {/* Main Tab Views */}
      {activeTab === 'QUEUE' ? (
        <div className="flex-1 overflow-hidden">
          <OcrReviewQueue
            onOpenItemForReview={async (fullItem) => {
              await loadExtractionIntoState(fullItem.extractedData!, fullItem.id, fullItem.fileName)
            }}
          />
        </div>
      ) : activeTab === 'HISTORY' ? (
        <div className="flex-1 overflow-auto">
          <PurchaseHistory />
        </div>
      ) : (
        <>
          {/* Notifications */}
          {error && (
            <div className="p-3 text-sm font-semibold text-destructive bg-destructive/10 rounded-md border border-destructive/20 flex items-center justify-between animate-in fade-in">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => setError(null)}
                className="text-xs underline hover:opacity-80 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {success && (
            <div className="p-3 text-sm font-semibold text-emerald-800 bg-emerald-50 rounded-md border border-emerald-300 animate-in fade-in">
              Purchase Invoice #{invoiceNumber} saved successfully to inventory!
            </div>
          )}

          {duplicateWarning && (
            <div className="p-3 text-sm font-semibold text-red-600 bg-red-50 rounded-md border border-red-300 flex items-center justify-between animate-in fade-in">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{duplicateWarning}</span>
              </div>
              <button
                type="button"
                onClick={handleClear}
                className="text-xs font-bold underline hover:text-red-800 ml-4 cursor-pointer"
              >
                Clear Added Data
              </button>
            </div>
          )}

          {/* Invoice Header Form */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 bg-card border rounded-lg shadow-sm">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Supplier / Vendor</label>
              <VendorCombobox
                vendors={vendors}
                selectedVendorId={vendorId}
                onSelectVendor={(newVendorId) => {
                  setInvoiceDetails(newVendorId, invoiceNumber, invoiceDate)
                  checkDuplicate(invoiceNumber, newVendorId)
                }}
                disabled={isLoadingVendors}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Invoice Number</label>
              <input
                type="text"
                className={`w-full px-3 py-2 border rounded-md outline-none focus:ring-2 bg-background uppercase ${duplicateWarning ? 'border-red-500 focus:ring-red-400 bg-red-50/20' : 'focus:ring-primary'
                  }`}
                value={invoiceNumber}
                onChange={(e) => {
                  const val = e.target.value
                  setInvoiceDetails(vendorId!, val, invoiceDate)
                  checkDuplicate(val, vendorId)
                }}
                onBlur={() => checkDuplicate(invoiceNumber, vendorId)}
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

          {/* Manual Product Search Bar */}
          <div className="shrink-0">
            <PurchaseProductSearch />
          </div>

          {/* Interactive Line Items Grid with Split-Pane Document Preview */}
          {showInvoicePreview && invoicePreview ? (
            <div className="flex-1 min-h-0 flex gap-4 overflow-hidden">
              <div className="w-[45%] min-w-[340px] max-w-2xl h-full flex flex-col shrink-0">
                <InvoiceDocumentViewer
                  preview={invoicePreview}
                  onClose={() => setShowInvoicePreview(false)}
                />
              </div>
              <div className="flex-1 min-w-0 h-full flex flex-col bg-card border rounded-lg shadow-sm overflow-hidden">
                <PurchaseGrid />
              </div>
            </div>
          ) : (
            <div className="flex-1 bg-card border rounded-lg shadow-sm overflow-hidden flex flex-col min-h-0">
              <PurchaseGrid />
            </div>
          )}

          {/* Bottom Totals Bar */}
          <div className="flex items-center justify-between p-4 bg-muted/40 border rounded-lg">
            <div className="flex gap-6 text-sm">
              <div>
                <span className="text-muted-foreground">Items: </span>
                <span className="font-semibold">{items.length}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Taxable Value: </span>
                <span className="font-semibold">{formatPaise(totals.subtotalPaise)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">GST: </span>
                <span className="font-semibold">{formatPaise(totals.taxPaise)}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-base font-medium text-muted-foreground">Grand Total:</span>
              <span className="text-2xl font-bold text-primary">{formatPaise(totals.grandTotalPaise)}</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
