import { create } from 'zustand'

export interface PurchaseLineItem {
  id: string // UI local ID
  productId: number
  brandName: string
  packSize: number
  gstRatePct: number
  
  batchNumber: string
  expiryMonth: string
  expiryYear: string
  
  quantityPacks: number
  quantityUnits: number // Computed: packs * packSize + loose
  quantityLoose: number
  
  mrpPaise: number
  purchaseRatePaise: number // per pack
  discountPct: number
  
  // Computed fields (for UI)
  totalPaise: number 
}

interface PurchaseState {
  vendorId: number | null
  invoiceNumber: string
  invoiceDate: string // YYYY-MM-DD
  items: PurchaseLineItem[]
  
  // Actions
  setInvoiceDetails: (vendorId: number, invoiceNumber: string, invoiceDate: string) => void
  addItem: (product: any) => void
  updateItem: (id: string, updates: Partial<PurchaseLineItem>) => void
  removeItem: (id: string) => void
  clearPurchase: () => void
  
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

  setInvoiceDetails: (vendorId, invoiceNumber, invoiceDate) => {
    set({ vendorId, invoiceNumber, invoiceDate })
  },

  addItem: (product) => {
    const newItem: PurchaseLineItem = {
      id: crypto.randomUUID(),
      productId: product.id,
      brandName: product.brand_name,
      packSize: product.pack_size,
      gstRatePct: product.gst_rate_pct,
      
      batchNumber: '',
      expiryMonth: '',
      expiryYear: '',
      
      quantityPacks: 0,
      quantityLoose: 0,
      quantityUnits: 0,
      
      mrpPaise: 0,
      purchaseRatePaise: 0,
      discountPct: 0,
      
      totalPaise: 0
    }
    set(state => ({ items: [...state.items, newItem] }))
  },

  updateItem: (id, updates) => {
    set(state => ({
      items: state.items.map(item => {
        if (item.id !== id) return item
        
        const updated = { ...item, ...updates }
        
        // Recalculate quantity units
        updated.quantityUnits = (updated.quantityPacks * updated.packSize) + updated.quantityLoose
        
        // Recalculate total (assuming purchase rate is per pack)
        // Basic calculation for now: (QtyPacks * PR) - discount
        const baseAmount = updated.quantityPacks * updated.purchaseRatePaise
        const discountAmount = Math.round(baseAmount * (updated.discountPct / 100))
        updated.totalPaise = baseAmount - discountAmount
        
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
      items: []
    })
  },

  getTotals: () => {
    const { items } = get()
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
      grandTotalPaise
    }
  }
}))
