import { create } from 'zustand'
import type { Paise } from '../../shared/utils/paise'

export interface PurchaseLineItem {
  id: string // UI local ID
  productId: number
  brandName: string
  packSize: number
  gstRatePct: number
  hsnCode: string

  batchNumber: string
  expiryMonth: string
  expiryYear: string

  quantityPacks: number
  quantityUnits: number // Computed: packs * packSize + loose
  quantityLoose: number

  mrpPaise: Paise
  purchaseRatePaise: Paise // per pack
  netRatePaise: Paise // per pack (after discounts, etc)
  discountPct: number

  // Computed fields (for UI)
  totalPaise: Paise
  needsProductLink?: boolean
  ocrProductNameRaw?: string
  confidence?: number
  isFlagged?: boolean
  flagReasons?: string[]
  suggestedMatches?: Array<{ id: number; brandName: string; packSize: number }>
}

interface PurchaseState {
  vendorId: number | null
  invoiceNumber: string
  invoiceDate: string // YYYY-MM-DD
  items: PurchaseLineItem[]
  manualGrandTotalPaise: number | null
  entrySource: 'MANUAL' | 'OCR'
  activeQueueItemId: number | null
  invoicePreview: { dataUrl: string; mimeType: string; fileName: string } | null
  showInvoicePreview: boolean

  // Actions
  setInvoiceDetails: (vendorId: number, invoiceNumber: string, invoiceDate: string, entrySource?: 'MANUAL' | 'OCR') => void
  setActiveQueueItemId: (id: number | null) => void
  setInvoicePreview: (preview: { dataUrl: string; mimeType: string; fileName: string } | null) => void
  setShowInvoicePreview: (show: boolean) => void
  toggleInvoicePreview: () => void
  addItem: (product: any) => void
  setAllItems: (items: PurchaseLineItem[]) => void
  updateItem: (id: string, updates: Partial<PurchaseLineItem>) => void
  removeItem: (id: string) => void
  clearPurchase: () => void
  setManualGrandTotal: (paise: number | null) => void

  // Computed
  getTotals: () => {
    subtotalPaise: number
    taxPaise: number
    grandTotalPaise: number
  }
}

export const usePurchaseStore = create<PurchaseState>((set, get) => ({
  vendorId: null,
  invoiceNumber: '',
  invoiceDate: new Date().toISOString().split('T')[0],
  items: [],
  manualGrandTotalPaise: null,
  entrySource: 'MANUAL',
  activeQueueItemId: null,
  invoicePreview: null,
  showInvoicePreview: false,

  setActiveQueueItemId: (id) => set({ activeQueueItemId: id }),
  setInvoicePreview: (preview) => set({ invoicePreview: preview, showInvoicePreview: !!preview }),
  setShowInvoicePreview: (show) => set({ showInvoicePreview: show }),
  toggleInvoicePreview: () => set((state) => ({ showInvoicePreview: !state.showInvoicePreview })),
  setAllItems: (items) => set({ items }),

  setManualGrandTotal: (paise) => set({ manualGrandTotalPaise: paise }),

  setInvoiceDetails: (vendorId, invoiceNumber, invoiceDate, entrySource) => {
    set({ vendorId, invoiceNumber, invoiceDate, entrySource: entrySource || 'MANUAL' })
  },

  addItem: (product) => {
    const newItem: PurchaseLineItem = {
      id: product.id || crypto.randomUUID(),
      productId: product.productId !== undefined ? product.productId : product.id,
      brandName: product.brandName || product.brand_name || '(unknown)',
      packSize: product.packSize || product.pack_size || 1,
      gstRatePct: product.gstRatePct !== undefined ? product.gstRatePct : (product.gst_rate_pct || 0),
      hsnCode: product.hsnCode || product.hsn_code || '',

      batchNumber: product.batchNumber || '',
      expiryMonth: product.expiryMonth || '',
      expiryYear: product.expiryYear || '',

      quantityPacks: product.quantityPacks || 0,
      quantityLoose: product.quantityLoose || 0,
      quantityUnits: product.quantityUnits || 0,

      mrpPaise: product.mrpPaise || 0,
      purchaseRatePaise: product.purchaseRatePaise || 0,
      netRatePaise: product.netRatePaise || 0,
      discountPct: product.discountPct || 0,

      totalPaise: product.totalPaise || 0,
      needsProductLink: product.needsProductLink,
      ocrProductNameRaw: product.ocrProductNameRaw,
      confidence: product.confidence,
      isFlagged: product.isFlagged,
      flagReasons: product.flagReasons,
      suggestedMatches: product.suggestedMatches
    }
    set(state => ({ items: [...state.items, newItem] }))
  },

  updateItem: (id, updates) => {
    set(state => ({
      items: state.items.map(item => {
        if (item.id !== id) return item

        const updated = { ...item, ...updates }

        // Recalculate quantity units
        updated.quantityUnits = (updated.quantityPacks * updated.packSize) + (updated.quantityLoose || 0)

        // Recalculate total ONLY IF it wasn't explicitly provided in this update
        if (updates.totalPaise === undefined) {
          const baseAmount = updated.quantityPacks * updated.purchaseRatePaise
          const taxableValue = baseAmount * (1 - (updated.discountPct || 0) / 100)
          const gstAmount = taxableValue * ((updated.gstRatePct || 0) / 100)
          updated.totalPaise = Math.round(taxableValue + gstAmount)
        }

        return updated
      })
    }))
  },

  removeItem: (id) => {
    set(state => ({ items: state.items.filter(i => i.id !== id) }))
  },

  clearPurchase: () => {
    set({
      vendorId: null,
      invoiceNumber: '',
      invoiceDate: new Date().toISOString().split('T')[0],
      items: [],
      manualGrandTotalPaise: null,
      entrySource: 'MANUAL',
      activeQueueItemId: null,
      invoicePreview: null,
      showInvoicePreview: false
    })
  },

  getTotals: () => {
    const { items, manualGrandTotalPaise } = get()
    let grandTotalPaise = 0

    items.forEach(item => {
      grandTotalPaise += item.totalPaise
    })

    // In India, purchase invoices usually have PR exclusive of GST or inclusive, 
    // for this basic version, we assume totalPaise is the final amount paid per item 
    // including taxes (often entered directly from the bill's grand total column).

    return {
      subtotalPaise: grandTotalPaise, // Simplify for UI
      taxPaise: 0,
      grandTotalPaise: manualGrandTotalPaise !== null ? manualGrandTotalPaise : grandTotalPaise
    }
  }
}))
