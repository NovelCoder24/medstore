import React, { useState, useEffect, useRef } from 'react'
import { Search, Loader2, Plus, Package, Barcode } from 'lucide-react'
import { useProducts } from '../../hooks/useProducts'
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner'
import { usePurchaseStore } from '../../store/purchase.store'
import { formatPaise } from '../../../shared/utils/paise'

interface PurchaseProductSearchProps {
  onProductAdded?: (product: any) => void
}

export function PurchaseProductSearch({ onProductAdded }: PurchaseProductSearchProps) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState<number>(-1)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const addItem = usePurchaseStore((s) => s.addItem)

  // Hardware barcode scanner support
  useBarcodeScanner((barcode) => {
    setQuery(barcode)
    setDebouncedQuery(barcode)
    setIsOpen(true)
  })

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
      if (query.trim()) {
        setIsOpen(true)
        setSelectedIndex(-1)
      } else {
        setIsOpen(false)
      }
    }, 180)
    return () => clearTimeout(timer)
  }, [query])

  const { data, isLoading } = useProducts({ query: debouncedQuery, pageSize: 8 })

  // Auto-close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelectProduct = (product: any) => {
    const packSize = product.pack_size || 1
    const purchaseRate = product.purchase_rate_paise || 0

    addItem({
      id: crypto.randomUUID(),
      productId: product.id,
      brandName: product.brand_name,
      packSize,
      gstRatePct: product.gst_rate_pct ?? 12,
      hsnCode: product.hsn_code || '3004',
      batchNumber: '',
      expiryMonth: '',
      expiryYear: '',
      quantityPacks: 1,
      quantityLoose: 0,
      quantityUnits: packSize,
      mrpPaise: product.mrp_paise || 0,
      purchaseRatePaise: purchaseRate,
      netRatePaise: purchaseRate,
      discountPct: 0,
      totalPaise: purchaseRate
    })

    if (onProductAdded) {
      onProductAdded(product)
    }

    setQuery('')
    setDebouncedQuery('')
    setIsOpen(false)
    setSelectedIndex(-1)
    inputRef.current?.focus()
  }

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const results = data?.data || []
    if (!isOpen || results.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (selectedIndex >= 0 && selectedIndex < results.length) {
        handleSelectProduct(results[selectedIndex])
      } else if (results.length > 0) {
        handleSelectProduct(results[0])
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="flex items-center gap-2 px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl shadow-xs focus-within:ring-1 focus-within:ring-slate-400 focus-within:border-slate-400 transition">
        <Search className="w-4 h-4 text-slate-400 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          className="flex-1 bg-transparent outline-none text-sm placeholder:text-slate-400 text-slate-900"
          placeholder="Search product by Brand Name, Salt/Composition, or Scan Barcode to inward stock..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (query.trim()) setIsOpen(true)
          }}
        />
        {isLoading && <Loader2 className="w-4 h-4 text-slate-500 animate-spin shrink-0" />}
        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 shrink-0 select-none">
          <Barcode className="w-3 h-3 text-slate-500" />
          <span>Scanner Ready</span>
        </div>
      </div>

      {/* Autocomplete Dropdown */}
      {isOpen && data?.data && data.data.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-72 overflow-y-auto divide-y divide-slate-100 animate-in fade-in slide-in-from-top-1">
          {data.data.map((product: any, idx: number) => {
            const isSelected = selectedIndex === idx
            return (
              <button
                key={product.id}
                type="button"
                onClick={() => handleSelectProduct(product)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`w-full px-4 py-2.5 text-left flex items-center justify-between transition-colors cursor-pointer ${
                  isSelected ? 'bg-slate-100 text-slate-900' : 'hover:bg-slate-50 text-slate-800'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    isSelected ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    <Package className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm truncate">{product.brand_name}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                        Pack of {product.pack_size || 1}
                      </span>
                      {product.hsn_code && (
                        <span className="text-[10px] text-slate-400">HSN: {product.hsn_code}</span>
                      )}
                    </div>
                    {product.generic_name && (
                      <p className="text-xs text-slate-500 truncate">{product.generic_name}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 ml-3 text-right">
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">
                      MRP: {formatPaise(product.mrp_paise || 0)}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      GST {product.gst_rate_pct ?? 12}%
                    </span>
                  </div>
                  <div className={`p-1.5 rounded-lg transition ${
                    isSelected ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    <Plus className="w-3.5 h-3.5" />
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {isOpen && query.trim() && (!data?.data || data.data.length === 0) && !isLoading && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-white border border-slate-200 rounded-xl shadow-lg p-4 text-center text-slate-500 text-xs animate-in fade-in">
          No matching products found for <span className="font-semibold text-slate-700">"{query}"</span>.
        </div>
      )}
    </div>
  )
}
