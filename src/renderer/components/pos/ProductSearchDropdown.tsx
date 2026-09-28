import React, { useState, useEffect, useRef } from 'react'
import { Search, Loader2, Sparkles, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { useProducts } from '../../hooks/useProducts'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'

interface ProductSearchDropdownProps {
  onSelectProduct: (product: any) => void
}

function ProductSearchRow({
  product,
  isSelected,
  onSelectProduct,
  onClose
}: {
  product: any
  isSelected: boolean
  onSelectProduct: (product: any) => void
  onClose: () => void
}) {
  const [substitutes, setSubstitutes] = useState<any[] | null>(null)
  const [loadingSubs, setLoadingSubs] = useState(false)
  const [showSubs, setShowSubs] = useState(false)
  const isOutOfStock = (product.total_stock_units || 0) === 0

  const handleFetchSubstitutes = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (showSubs) {
      setShowSubs(false)
      return
    }
    if (substitutes !== null) {
      setShowSubs(true)
      return
    }

    setLoadingSubs(true)
    try {
      const results = await window.api.invoke(IPC_CHANNELS.PRODUCTS_GET_SUBSTITUTES, product.id)
      setSubstitutes(results || [])
      setShowSubs(true)
    } catch (err) {
      console.error('Failed to fetch substitutes:', err)
      setSubstitutes([])
    } finally {
      setLoadingSubs(false)
    }
  }

  return (
    <li className="border-b last:border-0 border-slate-100">
      <div
        className={`w-full text-left px-4 py-3 outline-none transition-colors cursor-pointer ${
          isSelected ? 'bg-blue-50/80 text-blue-950 font-medium' : 'hover:bg-slate-50'
        }`}
        onClick={() => {
          onSelectProduct(product)
          onClose()
        }}
      >
        <div className="flex justify-between items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-base text-slate-900">{product.brand_name}</span>
              <span className="text-xs text-slate-500 font-normal">({product.pack_size} per pack)</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 truncate max-w-md">
              {product.composition?.salt_name || product.generic_name || 'No composition listed'}
            </p>
          </div>

          <div className="text-right shrink-0">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold tabular-nums font-mono ${
                !isOutOfStock
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}
            >
              {product.total_stock_units} in stock
            </span>
            {product.schedule_flag && product.schedule_flag !== 'NONE' && (
              <span className="block mt-1 text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-300 px-1.5 py-0.2 rounded uppercase inline-block">
                {product.schedule_flag}
              </span>
            )}
          </div>
        </div>

        {/* Stockout Substitute Discovery Bar */}
        {isOutOfStock && (
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-amber-700 flex items-center gap-1 font-medium">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              Medicine is out of stock
            </span>
            <button
              type="button"
              onClick={handleFetchSubstitutes}
              className="text-xs px-2.5 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-medium transition flex items-center gap-1 cursor-pointer"
            >
              {loadingSubs ? (
                <Loader2 className="w-3 h-3 animate-spin text-emerald-700" />
              ) : (
                <Sparkles className="w-3 h-3 text-emerald-600" />
              )}
              <span>Find in-stock salt substitutes</span>
              {showSubs ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
        )}

        {/* In-Stock Substitutes Drawer */}
        {showSubs && substitutes && (
          <div className="mt-2.5 p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-lg">
            <div className="text-xs font-semibold text-emerald-900 flex items-center gap-1.5 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
              <span>Available Generic & Salt Substitutes ({substitutes.length}):</span>
            </div>

            {substitutes.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No alternative brands with this salt currently in stock.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {substitutes.map((sub) => (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelectProduct(sub)
                      onClose()
                    }}
                    className="p-2 text-left bg-white hover:bg-emerald-100/60 border border-emerald-300 rounded-md transition shadow-2xs group cursor-pointer"
                  >
                    <div className="font-semibold text-xs text-slate-900 group-hover:text-emerald-950">
                      {sub.brand_name}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Pack: {sub.pack_size} | <span className="text-emerald-700 font-semibold font-mono tabular-nums">{sub.total_stock_units} in stock</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </li>
  )
}

export function ProductSearchDropdown({ onSelectProduct }: ProductSearchDropdownProps) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState<number>(-1)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
      if (query.trim()) {
        setIsOpen(true)
        setSelectedIndex(-1)
      }
    }, 200)
    return () => clearTimeout(timer)
  }, [query])

  const { data, isLoading } = useProducts({ query: debouncedQuery, pageSize: 10 })

  // Reset selectedIndex when data changes
  useEffect(() => {
    setSelectedIndex(-1)
  }, [data])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || !data?.data || data.data.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev < data.data.length - 1 ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : data.data.length - 1))
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && selectedIndex < data.data.length) {
        e.preventDefault()
        onSelectProduct(data.data[selectedIndex])
        setQuery('')
        setIsOpen(false)
        setSelectedIndex(-1)
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="flex items-center gap-2 px-3 py-2.5 bg-card border border-slate-300 rounded-lg shadow-2xs focus-within:ring-2 focus-within:ring-primary focus-within:border-primary transition-all">
        <Search className="w-5 h-5 text-slate-400 shrink-0" />
        <input
          id="pos-product-search-input"
          type="text"
          className="flex-1 bg-transparent outline-none text-base font-medium placeholder:text-slate-400 placeholder:font-normal"
          placeholder="Search by Brand, Generic, or Salt Composition... (Press F2 to focus)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (query.trim()) setIsOpen(true) }}
        />
        <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[11px] font-mono font-semibold text-slate-400 bg-slate-100 rounded border border-slate-200">
          F2
        </kbd>
        {isLoading && <Loader2 className="w-5 h-5 text-primary animate-spin" />}
      </div>

      {isOpen && data?.data && data.data.length > 0 && (
        <div className="absolute z-[100] w-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-[420px] overflow-y-auto divide-y divide-slate-100 animate-in fade-in slide-in-from-top-1">
          <ul className="py-1">
            {data.data.map((product, idx) => (
              <ProductSearchRow
                key={product.id}
                product={product}
                isSelected={idx === selectedIndex}
                onSelectProduct={onSelectProduct}
                onClose={() => {
                  setQuery('')
                  setIsOpen(false)
                  setSelectedIndex(-1)
                }}
              />
            ))}
          </ul>
        </div>
      )}

      {isOpen && !isLoading && query.trim() && data?.data.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-card border rounded-lg shadow-lg p-5 text-center text-slate-500 animate-in fade-in">
          <p className="font-medium text-sm">No products found matching "{query}"</p>
          <p className="text-xs text-slate-400 mt-1">Try searching by generic salt composition or brand alias.</p>
        </div>
      )}
    </div>
  )
}

