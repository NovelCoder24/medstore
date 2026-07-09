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
}

interface PurchaseState {
  vendorId: number | null
  invoiceNumber: string
  invoiceDate: string // YYYY-MM-DD
  items: PurchaseLineItem[]
  manualGrandTotalPaise: number | null

  // Actions
  setInvoiceDetails: (vendorId: number, invoiceNumber: string, invoiceDate: string) => void
  addItem: (product: any) => void
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

  setManualGrandTotal: (paise) => set({ manualGrandTotalPaise: paise }),

  setInvoiceDetails: (vendorId, invoiceNumber, invoiceDate) => {
    set({ vendorId, invoiceNumber, invoiceDate })
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
      ocrProductNameRaw: product.ocrProductNameRaw
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
      manualGrandTotalPaise: null
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
