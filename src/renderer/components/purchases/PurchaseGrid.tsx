import React, { useState } from 'react'
import { usePurchaseStore, PurchaseLineItem } from '../../store/purchase.store'
import { Trash2, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, Sparkles, RefreshCw, Plus } from 'lucide-react'
import { formatPaise } from '../../../shared/utils/paise'
import { confirmModal } from '../../store/confirm.store'
import { toast } from '../../store/toast.store'

export function PurchaseGrid() {
  const { items, updateItem, removeItem, clearPurchase } = usePurchaseStore()
  const [showAutoVerified, setShowAutoVerified] = useState(false)
  const [showFlagged, setShowFlagged] = useState(true)

  const handleSelectSuggestedMatch = (itemId: string, match: { id: number; brandName: string; packSize: number }) => {
    updateItem(itemId, {
      productId: match.id,
      brandName: match.brandName,
      packSize: match.packSize,
      needsProductLink: false,
      isFlagged: false,
      flagReasons: []
    })
  }

  const handleFixMath = (itemId: string) => {
    const item = items.find(i => i.id === itemId)
    if (!item) return
    const base = (item.quantityPacks || 0) * (item.purchaseRatePaise || 0)
    const taxable = base * (1 - (item.discountPct || 0) / 100)
    const gst = taxable * ((item.gstRatePct || 0) / 100)
    const calculatedTotal = Math.round(taxable + gst)
    updateItem(itemId, {
      totalPaise: calculatedTotal as any,
      flagReasons: (item.flagReasons || []).filter(r => !r.includes('Rate × Qty') && !r.includes('Math') && !r.includes('differs'))
    })
  }

  // Split items into high confidence (clearly legible in image) and low confidence (flagged / unclear)
  const autoVerifiedItems = items.filter(
    i => !i.isFlagged && (i.confidence === undefined || i.confidence >= 0.8)
  )
  const flaggedItems = items.filter(
    i => i.isFlagged || (i.confidence !== undefined && i.confidence < 0.8)
  )
  const hasOcrGrouping = items.some(
    i => i.confidence !== undefined || i.isFlagged !== undefined
  )

  const renderTableHeader = () => (
    <thead className="sticky top-0 bg-muted/80 backdrop-blur border-b z-10 text-xs">
      <tr>
        <th className="px-4 py-3 font-semibold text-left">Product</th>
        <th className="px-3 py-3 font-semibold text-left">Batch No.</th>
        <th className="px-3 py-3 font-semibold text-center">Exp MM/YYYY</th>
        <th className="px-3 py-3 font-semibold text-center">Qty (Packs)</th>
        <th className="px-3 py-3 font-semibold text-center">Free/Loose</th>
        <th className="px-3 py-3 font-semibold text-center">Total Units</th>
        <th className="px-3 py-3 font-semibold text-right">MRP (₹)</th>
        <th className="px-3 py-3 font-semibold text-right">Rate (₹)</th>
        <th className="px-3 py-3 font-semibold text-right">Disc %</th>
        <th className="px-3 py-3 font-semibold text-right">N.Rate (₹)</th>
        <th className="px-3 py-3 font-semibold text-right">GST %</th>
        <th className="px-3 py-3 font-semibold text-right">Total (₹)</th>
        <th className="px-3 py-3 font-semibold text-center"></th>
      </tr>
    </thead>
  )

  const handleCellKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, rowIdx: number, colIdx: number) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      let nextRow = rowIdx
      let nextCol = colIdx + 1
      if (nextCol > 9) {
        nextRow = rowIdx + 1
        nextCol = 0
      }
      const nextInput = document.querySelector<HTMLInputElement>(`input[data-row="${nextRow}"][data-col="${nextCol}"]`)
      if (nextInput) {
        nextInput.focus()
        nextInput.select()
      } else {
        const searchInput = document.getElementById('purchase-product-search-input') as HTMLInputElement | null
        if (searchInput) {
          searchInput.focus()
        }
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const nextInput = document.querySelector<HTMLInputElement>(`input[data-row="${rowIdx + 1}"][data-col="${colIdx}"]`)
      if (nextInput) {
        nextInput.focus()
        nextInput.select()
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const prevInput = document.querySelector<HTMLInputElement>(`input[data-row="${rowIdx - 1}"][data-col="${colIdx}"]`)
      if (prevInput) {
        prevInput.focus()
        prevInput.select()
      }
    }
  }

  const renderItemRow = (item: PurchaseLineItem, index: number, isFlaggedRow: boolean) => (
    <tr
      key={item.id}
      className={`border-b border-border/60 transition-colors ${
        isFlaggedRow
          ? 'bg-amber-50/50 hover:bg-amber-50/80'
          : item.needsProductLink
            ? 'bg-rose-50/40 hover:bg-rose-50/70'
            : 'hover:bg-muted/30'
      }`}
    >
      <td className="px-4 py-2 min-w-[220px]">
        {item.needsProductLink ? (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                New Drug
              </span>
              <span className="font-semibold text-rose-900 truncate max-w-[200px]" title={item.ocrProductNameRaw || item.brandName}>
                {index + 1}. {item.ocrProductNameRaw || item.brandName || '(unrecognized product)'}
              </span>
            </div>
            <div className="text-[11px] text-rose-600 font-medium">
              Auto-creates in inventory upon save
            </div>
          </div>
        ) : (
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              {isFlaggedRow && (
                <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                  Review Match
                </span>
              )}
              <span className="font-semibold text-foreground truncate max-w-[220px]" title={item.brandName}>
                {index + 1}. {item.brandName}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              Pack: {item.packSize}
            </div>
          </div>
        )}

        {/* Suggested catalog match quick action */}
        {isFlaggedRow && item.suggestedMatches && item.suggestedMatches.length > 0 && (
          <button
            type="button"
            onClick={() => handleSelectSuggestedMatch(item.id, item.suggestedMatches![0])}
            className="inline-flex items-center gap-1 px-2 py-0.5 mt-1 text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition-colors cursor-pointer"
            title="Click to link this line to catalog product"
          >
            <Sparkles className="w-3 h-3 text-blue-600" />
            <span>Link: {item.suggestedMatches[0].brandName} (Pack of {item.suggestedMatches[0].packSize})</span>
          </button>
        )}

        {/* Flag reasons summary */}
        {isFlaggedRow && item.flagReasons && item.flagReasons.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {item.flagReasons.map((reason, rIdx) => (
              <span
                key={rIdx}
                className="text-[10px] font-medium text-amber-800 bg-amber-100/70 px-1.5 py-0.5 rounded border border-amber-300/60"
              >
                {reason}
              </span>
            ))}
          </div>
        )}
      </td>

      {/* Batch (col 0) */}
      <td className="px-3 py-2">
        <input
          type="text"
          data-row={index}
          data-col={0}
          onKeyDown={(e) => handleCellKeyDown(e, index, 0)}
          className="w-28 px-2 py-1 text-sm border rounded outline-none focus:ring-1 focus:ring-primary focus:border-primary uppercase font-mono"
          value={item.batchNumber}
          onChange={(e) => updateItem(item.id, { batchNumber: e.target.value.toUpperCase() })}
          placeholder="BATCH123"
        />
      </td>

      {/* Expiry MM (col 1) & YYYY (col 2) */}
      <td className="px-3 py-2">
        <div className="flex items-center justify-center gap-1">
          <input
            type="text"
            data-row={index}
            data-col={1}
            onKeyDown={(e) => handleCellKeyDown(e, index, 1)}
            maxLength={2}
            className="w-10 px-1.5 py-1 text-sm text-center border rounded outline-none focus:ring-1 focus:ring-primary focus:border-primary font-mono"
            value={item.expiryMonth}
            onChange={(e) => updateItem(item.id, { expiryMonth: e.target.value.replace(/\D/g, '') })}
            placeholder="MM"
          />
          <span className="text-muted-foreground font-bold">/</span>
          <input
            type="text"
            data-row={index}
            data-col={2}
            onKeyDown={(e) => handleCellKeyDown(e, index, 2)}
            maxLength={4}
            className="w-14 px-1.5 py-1 text-sm text-center border rounded outline-none focus:ring-1 focus:ring-primary focus:border-primary font-mono"
            value={item.expiryYear}
            onChange={(e) => updateItem(item.id, { expiryYear: e.target.value.replace(/\D/g, '') })}
            placeholder="YYYY"
          />
        </div>
      </td>

      {/* Qty Packs (col 3) */}
      <td className="px-3 py-2">
        <input
          type="number"
          min="0"
          data-row={index}
          data-col={3}
          onKeyDown={(e) => handleCellKeyDown(e, index, 3)}
          className="w-16 px-2 py-1 text-sm text-center border rounded outline-none focus:ring-1 focus:ring-primary focus:border-primary mx-auto block font-semibold"
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

      {/* Qty Loose / Free (col 4) */}
      <td className="px-3 py-2">
        <input
          type="number"
          min="0"
          data-row={index}
          data-col={4}
          onKeyDown={(e) => handleCellKeyDown(e, index, 4)}
          className="w-16 px-2 py-1 text-sm text-center border rounded outline-none focus:ring-1 focus:ring-primary focus:border-primary mx-auto block"
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
      <td className="px-3 py-2 text-center">
        <div className="font-bold text-primary">{item.quantityUnits || 0}</div>
        <div className="text-[10px] text-muted-foreground font-mono">
          {item.quantityPacks > 0 ? `${item.quantityPacks}×${item.packSize}` : ''}
          {item.quantityPacks > 0 && item.quantityLoose > 0 ? '+' : ''}
          {item.quantityLoose > 0 ? `${item.quantityLoose}` : ''}
        </div>
      </td>

      {/* MRP (col 5) */}
      <td className="px-3 py-2">
        <input
          type="number"
          min="0"
          step="0.01"
          data-row={index}
          data-col={5}
          onKeyDown={(e) => handleCellKeyDown(e, index, 5)}
          className="w-20 px-2 py-1 text-sm text-right border rounded outline-none focus:ring-1 focus:ring-primary focus:border-primary ml-auto block"
          value={item.mrpPaise ? item.mrpPaise / 100 : ''}
          onChange={(e) => {
            const val = parseFloat(e.target.value) || 0
            updateItem(item.id, { mrpPaise: Math.round(val * 100) })
          }}
        />
      </td>

      {/* Purchase Rate (col 6) */}
      <td className="px-3 py-2">
        <input
          type="number"
          min="0"
          step="0.01"
          data-row={index}
          data-col={6}
          onKeyDown={(e) => handleCellKeyDown(e, index, 6)}
          className="w-20 px-2 py-1 text-sm text-right border rounded outline-none focus:ring-1 focus:ring-primary focus:border-primary ml-auto block"
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

      {/* Disc % (col 7) */}
      <td className="px-3 py-2">
        <input
          type="number"
          step="0.1"
          min="0"
          data-row={index}
          data-col={7}
          onKeyDown={(e) => handleCellKeyDown(e, index, 7)}
          className="w-14 px-1.5 py-1 text-sm text-right border rounded outline-none focus:ring-1 focus:ring-primary focus:border-primary ml-auto block"
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

      {/* N.Rate (col 8) */}
      <td className="px-3 py-2 text-right">
        <input
          type="number"
          step="0.01"
          data-row={index}
          data-col={8}
          onKeyDown={(e) => handleCellKeyDown(e, index, 8)}
          className="w-20 px-2 py-1 text-sm text-right border rounded outline-none focus:ring-1 focus:ring-primary focus:border-primary ml-auto block"
          value={item.netRatePaise !== undefined ? item.netRatePaise / 100 : ''}
          onChange={(e) => {
            const val = parseFloat(e.target.value) || 0;
            updateItem(item.id, { netRatePaise: Math.round(val * 100) });
          }}
        />
      </td>

      {/* GST % (col 9) */}
      <td className="px-3 py-2">
        <input
          type="number"
          step="0.1"
          min="0"
          data-row={index}
          data-col={9}
          onKeyDown={(e) => handleCellKeyDown(e, index, 9)}
          className="w-14 px-1.5 py-1 text-sm text-right border rounded outline-none focus:ring-1 focus:ring-primary focus:border-primary ml-auto block"
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
      <td className="px-3 py-2">
        <div className="space-y-0.5">
          <input
            type="number"
            step="0.01"
            className="w-20 px-2 py-1 text-sm text-right border rounded outline-none focus:ring-1 focus:ring-primary focus:border-primary ml-auto block font-bold text-primary"
            value={item.totalPaise !== undefined ? item.totalPaise / 100 : ''}
            onChange={(e) => {
              const val = parseFloat(e.target.value) || 0;
              updateItem(item.id, { totalPaise: Math.round(val * 100) });
            }}
          />
          {isFlaggedRow && (item.flagReasons || []).some(r => r.includes('Rate × Qty') || r.includes('differs')) && (
            <button
              type="button"
              onClick={() => handleFixMath(item.id)}
              className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 px-1 py-0.5 rounded border border-amber-300 ml-auto block cursor-pointer transition-colors"
              title="Fix to calculated Rate × Qty + GST"
            >
              <RefreshCw className="w-2.5 h-2.5" />
              <span>Fix Math</span>
            </button>
          )}
        </div>
      </td>

      {/* Action */}
      <td className="px-3 py-2 text-center">
        <button
          onClick={() => removeItem(item.id)}
          className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors cursor-pointer"
          title="Remove item"
        >
          <Trash2 className="w-4 h-4 mx-auto" />
        </button>
      </td>
    </tr>
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Actions Bar */}
      {items.length > 0 && (
        <div className="px-4 py-2 border-b bg-muted/20 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground font-semibold">
              {items.length} {items.length === 1 ? 'item' : 'items'} in this invoice
            </span>
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/60 px-2 py-0.5 rounded border border-border/60">
              <span>Navigate:</span>
              <kbd className="px-1 py-0.2 bg-background rounded border text-[10px] font-mono">Tab</kbd> / <kbd className="px-1 py-0.2 bg-background rounded border text-[10px] font-mono">Enter</kbd>
              <span>cells ·</span>
              <kbd className="px-1 py-0.2 bg-background rounded border text-[10px] font-mono">↑</kbd> <kbd className="px-1 py-0.2 bg-background rounded border text-[10px] font-mono">↓</kbd>
              <span>rows</span>
            </span>
          </div>
          <button
            type="button"
            onClick={async () => {
              const confirmed = await confirmModal({
                title: 'Clear Line Items',
                message: `Are you sure you want to clear all ${items.length} items from the purchase table?`,
                confirmLabel: 'Clear All Items',
                variant: 'danger'
              })
              if (confirmed) {
                clearPurchase()
                toast.info('All purchase items cleared')
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded transition-colors cursor-pointer"
            title="Clear all line items"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear Items
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 p-12 text-center select-none">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center mb-4 shadow-xs">
              <Plus className="w-7 h-7" />
            </div>
            <h3 className="font-bold text-base text-slate-900">No purchase line items yet</h3>
            <p className="text-xs text-slate-500 max-w-md mt-1 mb-5 leading-relaxed">
              Use the product search bar above to search by brand name, generic composition, or scan a barcode to add medicines to this inward invoice.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] font-semibold text-slate-500">
              <span className="px-2.5 py-1 bg-slate-100 rounded-lg border border-slate-200/80">📦 Instant Product Catalog Search</span>
              <span className="px-2.5 py-1 bg-slate-100 rounded-lg border border-slate-200/80">⚡ Barcode Scanner Supported</span>
              <span className="px-2.5 py-1 bg-slate-100 rounded-lg border border-slate-200/80">🧾 Auto-computes GST &amp; Margins</span>
            </div>
          </div>
        ) : hasOcrGrouping ? (
          <div className="p-4 space-y-4">
            {/* Card 1: High Confidence Items */}
            <div className="bg-white border border-emerald-200/90 rounded-2xl shadow-xs transition-all duration-200 overflow-hidden hover:border-emerald-300">
              <button
                type="button"
                id="btnHighConfidence"
                aria-expanded={showAutoVerified}
                onClick={() => setShowAutoVerified(!showAutoVerified)}
                className="w-full px-5 py-4 bg-emerald-50/60 hover:bg-emerald-50 flex items-center justify-between transition-colors text-left cursor-pointer group select-none"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  {/* Icon Badge */}
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0 text-emerald-600 group-hover:scale-105 transition-transform">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-circle-check" aria-hidden="true">
                      <circle cx="12" cy="12" r="10"></circle>
                      <path d="m9 12 2 2 4-4"></path>
                    </svg>
                  </div>

                  {/* Titles & Explanations */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2.5 truncate">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-900 group-hover:text-emerald-950 transition-colors">
                        High Confidence Items
                      </span>
                      <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800">
                        {autoVerifiedItems.length}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 truncate">
                      <span className="hidden sm:inline text-slate-300 mx-1">•</span>
                      Auto-verified product match, rate &amp; batch info
                    </span>
                  </div>
                </div>

                {/* Toggle Indicator Button */}
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 shrink-0 ml-3 bg-white px-2.5 py-1.5 rounded-lg border border-emerald-200/80 group-hover:border-emerald-300 shadow-xs">
                  <span id="labelHighConfidence">{showAutoVerified ? 'Collapse' : 'Show All'}</span>
                  <svg
                    id="chevronHighConfidence"
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`chevron-icon transition-transform duration-200 ${showAutoVerified ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                  >
                    <path d="m6 9 6 6 6-6"></path>
                  </svg>
                </div>
              </button>

              {/* Expandable Content Panel */}
              {showAutoVerified && (
                <div className="overflow-x-auto bg-card border-t border-emerald-100">
                  {autoVerifiedItems.length === 0 ? (
                    <div className="p-4 text-xs text-muted-foreground text-center italic">
                      No high-confidence items in this invoice.
                    </div>
                  ) : (
                    <table className="w-full text-sm text-left whitespace-nowrap">
                      {renderTableHeader()}
                      <tbody className="divide-y">
                        {autoVerifiedItems.map((item, idx) => renderItemRow(item, idx, false))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>

            {/* Card 2: Low Confidence / Needs Review */}
            <div className="bg-white border border-amber-200/80 rounded-2xl shadow-xs transition-all duration-200 overflow-hidden hover:border-amber-300">
              <button
                type="button"
                id="btnLowConfidence"
                aria-expanded={showFlagged}
                onClick={() => setShowFlagged(!showFlagged)}
                className="w-full px-5 py-4 bg-amber-50/50 hover:bg-amber-50/80 flex items-center justify-between transition-colors text-left cursor-pointer group select-none"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  {/* Icon Badge */}
                  <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 text-amber-600 group-hover:scale-105 transition-transform">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-triangle-alert" aria-hidden="true">
                      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"></path>
                      <path d="M12 9v4"></path>
                      <path d="M12 17h.01"></path>
                    </svg>
                  </div>

                  {/* Title & Subtitle */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2.5 truncate">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-900 group-hover:text-amber-950 transition-colors">
                        Needs Review
                      </span>
                      <span className={`inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold rounded-full ${
                        flaggedItems.length > 0
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {flaggedItems.length}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 truncate">
                      <span className="hidden sm:inline text-slate-300 mx-1">•</span>
                      Please verify highlighted fields, batch, rate, or product link
                    </span>
                  </div>
                </div>

                {/* Toggle Indicator Button */}
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 shrink-0 ml-3 bg-white px-2.5 py-1.5 rounded-lg border border-amber-200/80 group-hover:border-amber-300 shadow-xs">
                  <span id="labelLowConfidence">{showFlagged ? 'Collapse' : 'Expand'}</span>
                  <svg
                    id="chevronLowConfidence"
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`chevron-icon transition-transform duration-200 ${showFlagged ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                  >
                    <path d="m6 9 6 6 6-6"></path>
                  </svg>
                </div>
              </button>

              {/* Expandable Content Panel */}
              {showFlagged && (
                <div className="overflow-x-auto bg-card border-t border-amber-100">
                  {flaggedItems.length === 0 ? (
                    <div className="p-4 text-xs text-emerald-600 text-center font-medium">
                      ✅ All items auto-verified! No items require review.
                    </div>
                  ) : (
                    <table className="w-full text-sm text-left whitespace-nowrap">
                      {renderTableHeader()}
                      <tbody className="divide-y">
                        {flaggedItems.map((item, idx) => renderItemRow(item, idx, true))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <table className="w-full text-sm text-left whitespace-nowrap">
            {renderTableHeader()}
            <tbody className="divide-y">
              {items.map((item, index) => renderItemRow(item, index, !!item.isFlagged))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
