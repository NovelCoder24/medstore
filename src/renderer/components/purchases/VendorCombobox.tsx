import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Search, ChevronDown, Check, Building2, Clock, X, Phone } from 'lucide-react'
import type { Vendor } from '../../../main/services/vendor.service'

interface VendorComboboxProps {
  vendors: Vendor[] | undefined
  selectedVendorId: number | null
  onSelectVendor: (vendorId: number) => void
  disabled?: boolean
}

export function VendorCombobox({
  vendors = [],
  selectedVendorId,
  onSelectVendor,
  disabled = false
}: VendorComboboxProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const selectedVendor = useMemo(() => {
    return vendors.find((v) => v.id === selectedVendorId) || null
  }, [vendors, selectedVendorId])

  // Filter vendors based on search query
  const filteredVendors = useMemo(() => {
    if (!search.trim()) return vendors
    const q = search.trim().toLowerCase()
    return vendors.filter((v) => {
      const nameMatch = v.name?.toLowerCase().includes(q)
      const gstinMatch = v.gstin?.toLowerCase().includes(q)
      const phoneMatch = v.contact_phone?.toLowerCase().includes(q)
      return nameMatch || gstinMatch || phoneMatch
    })
  }, [vendors, search])

  // Split into Recently Used vs All Vendors when not searching
  const { recentVendors, otherVendors } = useMemo(() => {
    if (search.trim()) {
      return { recentVendors: [], otherVendors: filteredVendors }
    }

    const recent = vendors
      .filter((v) => (v.purchase_count && v.purchase_count > 0) || v.last_purchased_at)
      .sort((a, b) => {
        if (a.last_purchased_at && b.last_purchased_at) {
          return b.last_purchased_at.localeCompare(a.last_purchased_at)
        }
        return (b.purchase_count || 0) - (a.purchase_count || 0)
      })
      .slice(0, 5)

    const recentIds = new Set(recent.map((r) => r.id))
    const others = vendors.filter((v) => !recentIds.has(v.id))

    return { recentVendors: recent, otherVendors: others }
  }, [vendors, filteredVendors, search])

  // Flat list for keyboard navigation
  const flatDisplayList = useMemo(() => {
    if (search.trim()) return filteredVendors
    return [...recentVendors, ...otherVendors]
  }, [search, filteredVendors, recentVendors, otherVendors])

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 50)
      setHighlightedIndex(-1)
    } else {
      setSearch('')
    }
  }, [isOpen])

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (vendorId: number) => {
    onSelectVendor(vendorId)
    setIsOpen(false)
    setSearch('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault()
        setIsOpen(true)
      }
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex((prev) => (prev < flatDisplayList.length - 1 ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : flatDisplayList.length - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (highlightedIndex >= 0 && highlightedIndex < flatDisplayList.length) {
        handleSelect(flatDisplayList[highlightedIndex].id)
      } else if (flatDisplayList.length === 1) {
        handleSelect(flatDisplayList[0].id)
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  const renderVendorRow = (v: Vendor, isHighlighted: boolean) => {
    const isSelected = v.id === selectedVendorId
    return (
      <button
        key={v.id}
        type="button"
        onClick={() => handleSelect(v.id)}
        className={`w-full px-3.5 py-2.5 text-left flex items-center justify-between transition-colors cursor-pointer ${
          isHighlighted ? 'bg-slate-100 text-slate-900' : 'hover:bg-slate-50 text-slate-800'
        } ${isSelected ? 'font-semibold bg-slate-50' : ''}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
            isSelected ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'
          }`}>
            <Building2 className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-900 truncate">{v.name}</span>
              {v.purchase_count !== undefined && v.purchase_count > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                  {v.purchase_count} {v.purchase_count === 1 ? 'bill' : 'bills'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
              {v.gstin ? (
                <span className="font-mono text-[10px] bg-slate-100 px-1 py-0.2 rounded text-slate-600 border border-slate-200/60">
                  {v.gstin}
                </span>
              ) : (
                <span className="text-[10px] text-slate-400">No GSTIN</span>
              )}
              {v.contact_phone && (
                <span className="flex items-center gap-1 text-[10px] text-slate-400">
                  <Phone className="w-2.5 h-2.5" />
                  {v.contact_phone}
                </span>
              )}
            </div>
          </div>
        </div>

        {isSelected && (
          <Check className="w-4 h-4 text-slate-800 shrink-0 ml-2" />
        )}
      </button>
    )
  }

  return (
    <div ref={wrapperRef} className="relative w-full">
      {/* Combobox Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className={`w-full px-3 py-2 border rounded-md text-left flex items-center justify-between outline-none transition bg-background ${
          isOpen ? 'border-slate-400 ring-1 ring-slate-400' : 'hover:border-slate-300'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
          {selectedVendor ? (
            <div className="flex items-center gap-2 min-w-0 truncate">
              <span className="text-sm font-semibold text-slate-900 truncate">
                {selectedVendor.name}
              </span>
              {selectedVendor.gstin && (
                <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1 py-0.5 rounded border border-slate-200">
                  {selectedVendor.gstin}
                </span>
              )}
            </div>
          ) : (
            <span className="text-sm text-slate-400">Select a vendor / supplier...</span>
          )}
        </div>

        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-150 ${
          isOpen ? 'rotate-180' : ''
        }`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-1">
          {/* Search Header */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/70">
            <div className="flex items-center gap-2 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus-within:ring-1 focus-within:ring-slate-400 focus-within:border-slate-400">
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                className="flex-1 bg-transparent outline-none text-xs text-slate-900 placeholder:text-slate-400"
                placeholder="Search vendor name, GSTIN, or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Vendors List */}
          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
            {search.trim() ? (
              filteredVendors.length > 0 ? (
                filteredVendors.map((v, idx) => renderVendorRow(v, highlightedIndex === idx))
              ) : (
                <div className="p-4 text-center text-xs text-slate-500">
                  No suppliers found matching "{search}".
                </div>
              )
            ) : (
              <>
                {recentVendors.length > 0 && (
                  <div>
                    <div className="px-3.5 py-1.5 bg-slate-50/90 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 select-none">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span>Recently Used Vendors</span>
                    </div>
                    {recentVendors.map((v, idx) => renderVendorRow(v, highlightedIndex === idx))}
                  </div>
                )}

                {otherVendors.length > 0 && (
                  <div>
                    <div className="px-3.5 py-1.5 bg-slate-50/90 text-[10px] font-bold text-slate-400 uppercase tracking-wider select-none">
                      All Registered Vendors ({vendors.length})
                    </div>
                    {otherVendors.map((v, idx) =>
                      renderVendorRow(v, highlightedIndex === recentVendors.length + idx)
                    )}
                  </div>
                )}

                {vendors.length === 0 && (
                  <div className="p-4 text-center text-xs text-slate-500">
                    No suppliers registered yet.
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
