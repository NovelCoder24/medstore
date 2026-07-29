import React, { useState, useEffect, useRef } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { useProducts } from '../../hooks/useProducts'
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner'

interface ProductSearchDropdownProps {
  onSelectProduct: (product: any) => void
}

export function ProductSearchDropdown({ onSelectProduct }: ProductSearchDropdownProps) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState<number>(-1)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Hardware barcode scanner listener
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
      }
    }, 200)
    return () => clearTimeout(timer)
  }, [query])

  const { data, isLoading } = useProducts({ query: debouncedQuery, pageSize: 10 })

  // Reset selectedIndex when data changes
  useEffect(() => {
    setSelectedIndex(-1)
  }, [data])

  // If a barcode scan matches exactly ONE product, we auto-select it.
  useEffect(() => {
    if (data?.data.length === 1 && debouncedQuery === data.data[0].barcode) {
      onSelectProduct(data.data[0])
      setQuery('')
      setDebouncedQuery('')
      setIsOpen(false)
    }
  }, [data, debouncedQuery, onSelectProduct])

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
      <div className="flex items-center gap-2 px-3 py-3 bg-card border rounded-md shadow-sm focus-within:ring-2 focus-within:ring-primary">
        <Search className="w-5 h-5 text-muted-foreground" />
        <input
          type="text"
          className="flex-1 bg-transparent outline-none text-lg"
          placeholder="Scan Barcode or Search by Brand, Generic, or Salt..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (query.trim()) setIsOpen(true) }}
        />
        {isLoading && <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />}
      </div>

      {isOpen && data?.data && data.data.length > 0 && (
        <div className="absolute z-[100] w-full mt-1 bg-white border rounded-md shadow-xl max-h-96 overflow-y-auto">
          <ul className="py-1">
            {data.data.map((product, idx) => (
              <li key={product.id}>
                <button
                  className={`w-full text-left px-4 py-3 outline-none transition-colors border-b last:border-0 ${
                    idx === selectedIndex ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted focus:bg-muted'
                  }`}
                  onClick={() => {
                    onSelectProduct(product)
                    setQuery('')
                    setIsOpen(false)
                  }}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-semibold text-base">{product.brand_name}</span>
                      <span className="ml-2 text-sm text-muted-foreground">({product.pack_size} pack)</span>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-md">
                        {product.composition?.salt_name || product.generic_name}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`text-sm font-medium ${product.total_stock_units > 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {product.total_stock_units} in stock
                      </span>
                      {product.schedule_flag && product.schedule_flag !== 'NONE' && (
                        <span className="block mt-1 text-[10px] font-bold text-red-600 border border-red-600 px-1 rounded-sm uppercase inline-block">
                          {product.schedule_flag}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {isOpen && !isLoading && query.trim() && data?.data.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-card border rounded-md shadow-lg p-4 text-center text-muted-foreground">
          No products found matching "{query}"
        </div>
      )}
    </div>
  )
}
