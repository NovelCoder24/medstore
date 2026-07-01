import React from 'react'
import { useCartStore } from '../../store/cart.store'
import { Trash2, Plus, Minus } from 'lucide-react'
import { formatPaise } from '../../../main/utils/paise'
import { unitsToDisplay } from '../../../main/utils/pack-size'

export function CartTable() {
  const { items, updateQuantity, updateDiscount, removeItem } = useCartStore()

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 p-8 text-center border-2 border-dashed rounded-lg bg-card text-muted-foreground">
        <p>No items in cart</p>
        <p className="text-xs mt-2">Scan a barcode or search for a product to begin billing.</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto border rounded-lg bg-card shadow-sm">
      <table className="w-full text-sm text-left">
        <thead className="sticky top-0 bg-muted/50 border-b">
          <tr>
            <th className="px-4 py-3 font-medium">Product & Batch</th>
            <th className="px-4 py-3 font-medium text-center">Qty (Units)</th>
            <th className="px-4 py-3 font-medium text-right">MRP</th>
            <th className="px-4 py-3 font-medium text-right">Disc. (per unit)</th>
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
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Batch: {item.batchNumber} | Exp: {item.expiryDate}
                  </div>
                  <div className="text-xs text-primary mt-0.5 font-medium">
                    {packs > 0 ? `${packs} Pack${packs>1?'s':''} ` : ''}
                    {loose > 0 ? `${loose} Loose` : ''}
                  </div>
                </td>
                
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.id, Math.max(1, item.quantityUnits - 1))}
                      className="p-1 rounded-md bg-muted hover:bg-muted-foreground/20 transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-8 text-center font-medium text-base">
                      {item.quantityUnits}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.id, item.quantityUnits + 1)}
                      className="p-1 rounded-md bg-muted hover:bg-muted-foreground/20 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </td>
                
                <td className="px-4 py-3 text-right">
                  {formatPaise(item.mrpPaise)}
                </td>
                
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end">
                    <div className="relative w-24">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-full pl-7 pr-2 py-1 text-right border rounded-md outline-none focus:ring-1 focus:ring-primary"
                        value={item.discountPaise / 100}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0
                          updateDiscount(item.id, Math.round(val * 100))
                        }}
                      />
                    </div>
                  </div>
                </td>
                
                <td className="px-4 py-3 text-right font-bold text-lg">
                  {formatPaise(item.gstBreakdown.lineTotalPaise)}
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
