import React from 'react'
import { usePurchaseStore } from '../../store/purchase.store'
import { ProductSearchDropdown } from '../pos/ProductSearchDropdown'
import { Trash2 } from 'lucide-react'
import { formatPaise } from '../../../shared/utils/paise'

export function PurchaseGrid() {
  const { items, addItem, updateItem, removeItem } = usePurchaseStore()

  const handleProductSelect = (product: any) => {
    // Add product to the grid
    addItem(product)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b bg-muted/30">
        <div className="w-full max-w-md">
          <ProductSearchDropdown onSelectProduct={handleProductSelect} />
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
            <p>No products added yet.</p>
            <p className="text-sm mt-1">Search or scan above to add items to this purchase invoice.</p>
          </div>
        ) : (
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur border-b z-10">
              <tr>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Batch No.</th>
                <th className="px-4 py-3 font-medium text-center">Exp MM/YYYY</th>
                <th className="px-4 py-3 font-medium text-center">Qty (Packs)</th>
                <th className="px-4 py-3 font-medium text-center">Free/Loose</th>
                <th className="px-4 py-3 font-medium text-center">Total Units</th>
                <th className="px-4 py-3 font-medium text-right">MRP (₹)</th>
                <th className="px-4 py-3 font-medium text-right">Rate (₹)</th>
                <th className="px-4 py-3 font-medium text-right">Disc %</th>
                <th className="px-4 py-3 font-medium text-right">N.Rate (₹)</th>
                <th className="px-4 py-3 font-medium text-right">GST %</th>
                <th className="px-4 py-3 font-medium text-right">Total (₹)</th>
                <th className="px-4 py-3 font-medium text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((item, index) => (
                <tr
                  key={item.id}
                  className={
                    item.needsProductLink
                      ? 'bg-red-50 border-l-4 border-l-red-400 hover:bg-red-100/70'
                      : 'hover:bg-muted/20'
                  }
                >
                  <td className="px-4 py-2">
                    {item.needsProductLink ? (
                      <div className="space-y-1">
                        <div className="font-medium text-red-700 truncate max-w-[200px]" title={item.ocrProductNameRaw}>
                          {index + 1}. {item.ocrProductNameRaw || '(unrecognized product)'}
                        </div>
                        <div className="text-xs font-medium text-red-600">
                          ⚠ New: Will auto-create on save
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="font-medium truncate max-w-[200px]" title={item.brandName}>
                          {index + 1}. {item.brandName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Pack: {item.packSize}
                        </div>
                      </>
                    )}
                  </td>

                  {/* Batch */}
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      className="w-32 px-2 py-1 text-sm border rounded outline-none focus:border-primary uppercase"
                      value={item.batchNumber}
                      onChange={(e) => updateItem(item.id, { batchNumber: e.target.value.toUpperCase() })}
                      placeholder="BATCH123"
                    />
                  </td>

                  {/* Expiry */}
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-center gap-1">
                      <input
                        type="text"
                        maxLength={2}
                        className="w-10 px-2 py-1 text-sm text-center border rounded outline-none focus:border-primary"
                        value={item.expiryMonth}
                        onChange={(e) => updateItem(item.id, { expiryMonth: e.target.value.replace(/\D/g, '') })}
                        placeholder="MM"
                      />
                      <span className="text-muted-foreground">/</span>
                      <input
                        type="text"
                        maxLength={4}
                        className="w-16 px-2 py-1 text-sm text-center border rounded outline-none focus:border-primary"
                        value={item.expiryYear}
                        onChange={(e) => updateItem(item.id, { expiryYear: e.target.value.replace(/\D/g, '') })}
                        placeholder="YYYY"
                      />
                    </div>
                  </td>

                  {/* Qty Packs */}
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      min="0"
                      className="w-20 px-2 py-1 text-sm text-center border rounded outline-none focus:border-primary mx-auto block"
                      value={item.quantityPacks ?? ''}
                      onChange={(e) => {
                        const packs = parseInt(e.target.value) || 0
                        const newUnits = (packs * item.packSize) + (item.quantityLoose || 0)
                        
                        // Calculate with GST
                        const taxableValue = (packs * (item.purchaseRatePaise || 0)) * (1 - (item.discountPct || 0) / 100)
                        const gstAmount = taxableValue * ((item.gstRatePct || 0) / 100)
                        const newTotal = taxableValue + gstAmount
                        
                        updateItem(item.id, { 
                          quantityPacks: packs,
                          quantityUnits: newUnits,
                          totalPaise: Math.round(newTotal)
                        })
                      }}
                    />
                  </td>

                  {/* Qty Loose (Free/Bonus) */}
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      min="0"
                      className="w-20 px-2 py-1 text-sm text-center border rounded outline-none focus:border-primary mx-auto block"
                      value={item.quantityLoose ?? ''}
                      onChange={(e) => {
                        const free = parseInt(e.target.value) || 0
                        const newUnits = ((item.quantityPacks || 0) * item.packSize) + free
                        
                        updateItem(item.id, { 
                          quantityLoose: free,
                          quantityUnits: newUnits 
                        })
                      }}
                    />
                  </td>

                  {/* Total Units (computed: packs × pack_size + loose) */}
                  <td className="px-4 py-2 text-center">
                    <div className="font-semibold text-primary">{item.quantityUnits || 0}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {item.quantityPacks > 0 ? `${item.quantityPacks}×${item.packSize}` : ''}
                      {item.quantityPacks > 0 && item.quantityLoose > 0 ? '+' : ''}
                      {item.quantityLoose > 0 ? `${item.quantityLoose}` : ''}
                    </div>
                  </td>

                  {/* MRP */}
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="w-24 px-2 py-1 text-sm text-right border rounded outline-none focus:border-primary ml-auto block"
                      value={item.mrpPaise ? item.mrpPaise / 100 : ''}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0
                        updateItem(item.id, { mrpPaise: Math.round(val * 100) })
                      }}
                    />
                  </td>

                  {/* Purchase Rate */}
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="w-24 px-2 py-1 text-sm text-right border rounded outline-none focus:border-primary ml-auto block"
                      value={item.purchaseRatePaise !== undefined ? item.purchaseRatePaise / 100 : ''}
                      onChange={(e) => {
                        const ratePaise = Math.round((parseFloat(e.target.value) || 0) * 100)
                        
                        // Calculate with GST
                        const taxableValue = ((item.quantityPacks || 0) * ratePaise) * (1 - (item.discountPct || 0) / 100)
                        const gstAmount = taxableValue * ((item.gstRatePct || 0) / 100)
                        const newTotal = taxableValue + gstAmount
                        const newNetRate = ratePaise * (1 - (item.discountPct || 0) / 100)
                        
                        updateItem(item.id, { 
                          purchaseRatePaise: ratePaise,
                          netRatePaise: Math.round(newNetRate),
                          totalPaise: Math.round(newTotal)
                        })
                      }}
                    />
                  </td>

                  {/* Disc % */}
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      className="w-16 px-2 py-1 text-sm text-right border rounded outline-none focus:border-primary ml-auto block"
                      value={item.discountPct ?? ''}
                      onChange={(e) => {
                        const disc = parseFloat(e.target.value) || 0
                        
                        // Calculate with GST
                        const taxableValue = ((item.quantityPacks || 0) * (item.purchaseRatePaise || 0)) * (1 - disc / 100)
                        const gstAmount = taxableValue * ((item.gstRatePct || 0) / 100)
                        const newTotal = taxableValue + gstAmount
                        const newNetRate = (item.purchaseRatePaise || 0) * (1 - disc / 100)
                        
                        updateItem(item.id, { 
                          discountPct: disc,
                          netRatePaise: Math.round(newNetRate),
                          totalPaise: Math.round(newTotal)
                        })
                      }}
                    />
                  </td>

                  {/* N.Rate */}
                  <td className="px-4 py-2 text-right">
                    <input
                      type="number"
                      step="0.01"
                      className="w-20 px-2 py-1 text-sm text-right border rounded outline-none focus:border-primary ml-auto block"
                      value={item.netRatePaise !== undefined ? item.netRatePaise / 100 : ''}
                      onChange={(e) => {
                         const val = parseFloat(e.target.value) || 0;
                         updateItem(item.id, { netRatePaise: Math.round(val * 100) });
                      }}
                    />
                  </td>

                  {/* GST % */}
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      className="w-16 px-2 py-1 text-sm text-right border rounded outline-none focus:border-primary ml-auto block"
                      value={item.gstRatePct ?? ''}
                      onChange={(e) => {
                        const gst = parseFloat(e.target.value) || 0
                        
                        // Calculate with GST
                        const taxableValue = ((item.quantityPacks || 0) * (item.purchaseRatePaise || 0)) * (1 - (item.discountPct || 0) / 100)
                        const gstAmount = taxableValue * (gst / 100)
                        const newTotal = taxableValue + gstAmount

                        updateItem(item.id, { 
                          gstRatePct: gst,
                          totalPaise: Math.round(newTotal)
                        })
                      }}
                    />
                  </td>

                  {/* Total */}
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      step="0.01"
                      className="w-24 px-2 py-1 text-sm text-right border rounded outline-none focus:border-primary ml-auto block font-bold text-primary"
                      value={item.totalPaise !== undefined ? item.totalPaise / 100 : ''}
                      onChange={(e) => {
                         const val = parseFloat(e.target.value) || 0;
                         updateItem(item.id, { totalPaise: Math.round(val * 100) });
                      }}
                    />
                  </td>

                  {/* Action */}
                  <td className="px-4 py-2 text-center">
                    <button
                      onClick={() => removeItem(item.id)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4 mx-auto" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
