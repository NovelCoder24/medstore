import React, { useState, useCallback, useEffect } from 'react'
import { useCartStore, CartLineItem } from '../../store/cart.store'
import { useProductBatches } from '../../hooks/useProducts'
import { Trash2, Plus, Minus, AlertTriangle, Layers } from 'lucide-react'
import { formatPaise } from '../../../shared/utils/paise'
import { unitsToDisplay } from '../../../shared/utils/pack-size'

interface TotalInputCellProps {
  item: CartLineItem
  updateTotal: (id: string, totalPaise: number) => void
}

function BatchSelectorCell({ item }: { item: CartLineItem }) {
  const { changeBatch } = useCartStore()
  const { data: batches } = useProductBatches(item.productId)

  const activeBatches = (batches || []).filter((b: any) => b.status === 'ACTIVE' && b.quantity > 0)

  if (!activeBatches || activeBatches.length <= 1) {
    return (
      <div className="text-xs text-muted-foreground mt-0.5">
        Batch: <span className="font-medium text-foreground">{item.batchNumber}</span> | Exp: {item.expiryDate}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5 mt-1">
      <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
        <Layers className="w-3 h-3 text-primary" /> Batch:
      </span>
      <select
        value={item.batchId}
        onChange={(e) => {
          const selectedId = parseInt(e.target.value, 10)
          const targetBatch = activeBatches.find((b: any) => b.id === selectedId)
          if (targetBatch) {
            changeBatch(item.id, {
              batchId: targetBatch.id,
              batchNumber: targetBatch.batch_number,
              expiryDate: targetBatch.expiry_date,
              availableQuantity: targetBatch.quantity,
              mrpPaise: targetBatch.mrp_paise,
              purchaseRatePaise: targetBatch.purchase_rate_paise || 0
            })
          }
        }}
        className="text-xs font-semibold bg-primary/10 text-primary border border-primary/30 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-primary cursor-pointer"
      >
        {activeBatches.map((b: any) => (
          <option key={b.id} value={b.id}>
            {b.batch_number} (Exp: {b.expiry_date_str || b.expiry_date}) — {b.quantity} in stock
          </option>
        ))}
      </select>
    </div>
  )
}

interface TotalInputCellProps {
  item: CartLineItem
  updateTotal: (id: string, totalPaise: number) => void
}

function TotalInputCell({ item, updateTotal }: TotalInputCellProps) {
  const currentTotalStr = (item.gstBreakdown.lineTotalPaise / 100).toFixed(2)
  const [inputValue, setInputValue] = useState(currentTotalStr)
  const [isFocused, setIsFocused] = useState(false)

  useEffect(() => {
    if (!isFocused) {
      setInputValue(currentTotalStr)
    }
  }, [currentTotalStr, isFocused])

  return (
    <div className="flex justify-end">
      <div className="relative w-28">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">₹</span>
        <input
          type="number"
          min="0"
          step="0.01"
          className="w-full pl-6 pr-2 py-1 text-right border rounded-md outline-none focus:ring-1 focus:ring-primary font-bold text-base hide-arrows"
          value={isFocused ? inputValue : currentTotalStr}
          onFocus={() => {
            setIsFocused(true)
            setInputValue(currentTotalStr)
          }}
          onBlur={() => {
            setIsFocused(false)
            const parsed = parseFloat(inputValue)
            if (!isNaN(parsed) && parsed >= 0) {
              updateTotal(item.id, Math.round(parsed * 100))
            } else {
              setInputValue(currentTotalStr)
            }
          }}
          onChange={(e) => {
            const val = e.target.value
            setInputValue(val)
            const parsed = parseFloat(val)
            if (!isNaN(parsed) && parsed >= 0) {
              updateTotal(item.id, Math.round(parsed * 100))
            }
          }}
        />
      </div>
    </div>
  )
}

export function CartTable() {
  const { items, updateQuantity, updateDiscount, updateTotal, removeItem } = useCartStore()
  const [warning, setWarning] = useState<string | null>(null)

  const showWarning = useCallback((msg: string) => {
    setWarning(msg)
    setTimeout(() => setWarning(null), 3000)
  }, [])

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 p-8 text-center border-2 border-dashed rounded-lg bg-card text-muted-foreground">
        <p>No items in cart</p>
        <p className="text-xs mt-2">Scan a barcode or search for a product to begin billing.</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto border rounded-lg bg-card shadow-sm relative">
      {warning && (
        <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-amber-800 bg-amber-50 border-b border-amber-200 animate-in slide-in-from-top-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {warning}
        </div>
      )}
      <table className="w-full text-sm text-left">
        <thead className="sticky top-0 bg-muted/50 border-b">
          <tr>
            <th className="px-4 py-3 font-medium">Product & Batch</th>
            <th className="px-4 py-3 font-medium text-center">Qty (Units)</th>
            <th className="px-4 py-3 font-medium text-right">MRP</th>
            <th className="px-4 py-3 font-medium text-right">Disc. (%)</th>
            <th className="px-4 py-3 font-medium text-right">Total (Inc. Tax)</th>
            <th className="px-4 py-3 font-medium text-center">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((item) => {
            const { packs, loose } = unitsToDisplay(item.quantityUnits, item.packSize)
            
            return (
              <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-semibold text-base">{item.brandName}</div>
                  <BatchSelectorCell item={item} />
                  <div className="text-xs text-primary mt-0.5 font-medium">
                    {packs > 0 ? `${packs} Pack${packs>1?'s':''} ` : ''}
                    {loose > 0 ? `${loose} Loose` : ''}
                  </div>
                </td>
                
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={() => updateQuantity(item.id, Math.max(1, item.quantityUnits - 1))}
                      className="p-1 rounded-md bg-muted hover:bg-muted-foreground/20 transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <input
                      type="number"
                      min="1"
                      className="w-12 text-center py-1 border rounded-md outline-none focus:ring-1 focus:ring-primary font-medium text-base hide-arrows"
                      value={item.quantityUnits}
                      onChange={(e) => {
                        let val = parseInt(e.target.value)
                        
                        if (isNaN(val) || val < 1) {
                          val = 1
                        }
                        
                        if (val > item.availableQuantity) {
                          showWarning(`Batch limit reached for ${item.brandName}. Only ${item.availableQuantity} available.`)
                          val = item.availableQuantity
                        }
                        
                        updateQuantity(item.id, val)
                      }}
                    />
                    <button
                      onClick={() => {
                        if (item.quantityUnits >= item.availableQuantity) {
                          showWarning(`Batch limit reached for ${item.brandName}. Add the product again to select the next batch.`)
                        } else {
                          updateQuantity(item.id, item.quantityUnits + 1)
                        }
                      }}
                      className="p-1 rounded-md bg-muted hover:bg-muted-foreground/20 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </td>
                
                <td className="px-4 py-3 text-right">
                  {formatPaise(item.mrpPaise * item.packSize)}
                </td>
                
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end">
                    <div className="relative w-24">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        className="w-full pl-2 pr-7 py-1 text-right border rounded-md outline-none focus:ring-1 focus:ring-primary font-medium"
                        value={item.mrpPaise > 0 ? ((item.discountPaise / item.mrpPaise) * 100).toFixed(1).replace(/\.0$/, '') : 0}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0
                          const safeVal = Math.min(100, Math.max(0, val))
                          const newDiscountPaise = Math.round((safeVal / 100) * item.mrpPaise)
                          updateDiscount(item.id, newDiscountPaise)
                        }}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                    </div>
                  </div>
                </td>
                
                <td className="px-4 py-3 text-right font-bold text-lg">
                  <TotalInputCell item={item} updateTotal={updateTotal} />
                </td>
                
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => removeItem(item.id)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                    title="Remove item"
                  >
                    <Trash2 className="w-5 h-5 mx-auto" />
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
