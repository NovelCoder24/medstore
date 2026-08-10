import { create } from 'zustand'
import { calculateItemGst, aggregateGst, GstBreakdown } from '../../shared/utils/gst'
import type { Paise } from '../../shared/utils/paise'

export interface CartLineItem {
  id: string // unique id for UI rendering
  productId: number
  brandName: string
  packSize: number
  batchId: number
  batchNumber: string
  expiryDate: string
  
  availableQuantity: number // max stock available in this batch
  scheduleFlag: 'H' | 'H1' | 'X' | 'NONE' // New field for compliance
  
  mrpPaise: Paise
  purchaseRatePaise: Paise // cost per unit for margin calculation
  salePricePaise: Paise // base price before discount/tax
  discountPaise: Paise // per unit discount
  quantityUnits: number // atomic units
  
  gstRatePct: number
  isInterState: boolean
  
  // Computed fields (updated automatically)
  gstBreakdown: GstBreakdown
}

export interface PatientDetails {
  name: string
  phone: string
  address: string
  doctorName: string
  doctorRegNo: string
}

interface CartState {
  items: CartLineItem[]
  patient: PatientDetails
  
  // Actions
  addItem: (item: Omit<CartLineItem, 'id' | 'gstBreakdown'>) => void
  updateQuantity: (id: string, quantityUnits: number) => void
  updateTotal: (id: string, totalPaise: number) => void
  changeBatch: (id: string, batch: { batchId: number; batchNumber: string; expiryDate: string; availableQuantity: number; mrpPaise: number; purchaseRatePaise: number }) => void
  removeItem: (id: string) => void
  updatePatient: (patient: Partial<PatientDetails>) => void
  clearCart: () => void
  
  // Computed State
  getTotals: () => {
    subtotalPaise: number
    totalDiscountPaise: number
    totalTaxBreakdown: GstBreakdown
    grandTotalPaise: number
  }
}

const emptyPatient: PatientDetails = { name: '', phone: '', address: '', doctorName: '', doctorRegNo: '' }

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  patient: emptyPatient,

  addItem: (item) => {
    const gstBreakdown = calculateItemGst(
      item.salePricePaise,
      item.discountPaise,
      item.quantityUnits,
      item.gstRatePct,
      item.isInterState
    )

    set((state) => {
      // Check if exact product+batch already in cart
      const existingIdx = state.items.findIndex(
        i => i.productId === item.productId && i.batchId === item.batchId
      )

      if (existingIdx >= 0) {
        // Increment quantity
        const updatedItems = [...state.items]
        const currentItem = updatedItems[existingIdx]
        const newQty = Math.min(currentItem.quantityUnits + item.quantityUnits, currentItem.availableQuantity)
        
        updatedItems[existingIdx] = {
          ...currentItem,
          quantityUnits: newQty,
          gstBreakdown: calculateItemGst(
            currentItem.salePricePaise,
            currentItem.discountPaise,
            newQty,
            currentItem.gstRatePct,
            currentItem.isInterState
          )
        }
        return { items: updatedItems }
      }

      // Add new
      return {
        items: [
          ...state.items,
          {
            ...item,
            id: crypto.randomUUID(),
            gstBreakdown
          }
        ]
      }
    })
  },

  updateQuantity: (id, quantityUnits) => {
    set((state) => ({
      items: state.items.map(item => {
        if (item.id === id) {
          const safeQty = Math.min(Math.max(1, quantityUnits), item.availableQuantity)
          return {
            ...item,
            quantityUnits: safeQty,
            gstBreakdown: calculateItemGst(
              item.salePricePaise,
              item.discountPaise,
              safeQty,
              item.gstRatePct,
              item.isInterState
            )
          }
        }
        return item
      })
    }))
  },

  updateDiscount: (id, discountPaise) => {
    set((state) => ({
      items: state.items.map(item => {
        if (item.id === id) {
          return {
            ...item,
            discountPaise,
            gstBreakdown: calculateItemGst(
              item.salePricePaise,
              discountPaise,
              item.quantityUnits,
              item.gstRatePct,
              item.isInterState
            )
          }
        }
        return item
      })
    }))
  },

  updateTotal: (id, totalPaise) => {
    set((state) => ({
      items: state.items.map(item => {
        if (item.id === id) {
          const totalBasePaise = item.salePricePaise * item.quantityUnits
          const totalDiscountPaise = Math.max(0, totalBasePaise - totalPaise)
          const newDiscountPaise = item.quantityUnits > 0
            ? Math.min(item.salePricePaise, Math.round(totalDiscountPaise / item.quantityUnits))
            : 0

          return {
            ...item,
            discountPaise: newDiscountPaise,
            gstBreakdown: calculateItemGst(
              item.salePricePaise,
              newDiscountPaise,
              item.quantityUnits,
              item.gstRatePct,
              item.isInterState
            )
          }
        }
        return item
      })
    }))
  },

  changeBatch: (id, batch) => {
    set((state) => ({
      items: state.items.map(item => {
        if (item.id === id) {
          const unitMrp = Math.round(batch.mrpPaise / item.packSize)
          const unitPurchaseRate = Math.round(batch.purchaseRatePaise / item.packSize)
          const newQty = Math.min(item.quantityUnits, batch.availableQuantity)

          const updated = {
            ...item,
            batchId: batch.batchId,
            batchNumber: batch.batchNumber,
            expiryDate: batch.expiryDate,
            availableQuantity: batch.availableQuantity,
            mrpPaise: unitMrp as any,
            purchaseRatePaise: unitPurchaseRate as any,
            salePricePaise: unitMrp as any,
            quantityUnits: newQty,
          }

          return {
            ...updated,
            gstBreakdown: calculateItemGst(
              updated.salePricePaise,
              updated.discountPaise,
              newQty,
              updated.gstRatePct,
              updated.isInterState
            )
          }
        }
        return item
      })
    }))
  },

  removeItem: (id) => {
    set((state) => ({
      items: state.items.filter(item => item.id !== id)
    }))
  },

  updatePatient: (patientUpdate) => {
    set((state) => ({
      patient: { ...state.patient, ...patientUpdate }
    }))
  },

  clearCart: () => {
    set({ items: [], patient: emptyPatient })
  },

  getTotals: () => {
    const { items } = get()
    
    // Aggregate GST across all items
    const totalTaxBreakdown = aggregateGst(items.map(i => i.gstBreakdown))
    
    let subtotalPaise = 0
    let totalDiscountPaise = 0
    
    items.forEach(item => {
      subtotalPaise += item.salePricePaise * item.quantityUnits
      totalDiscountPaise += item.discountPaise * item.quantityUnits
    })

    return {
      subtotalPaise,
      totalDiscountPaise,
      totalTaxBreakdown,
      grandTotalPaise: totalTaxBreakdown.lineTotalPaise // already includes tax and subtracts discount internally
    }
  }
}))
