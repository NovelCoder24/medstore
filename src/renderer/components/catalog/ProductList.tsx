import React, { useState, useRef, useEffect } from 'react'
import { useProducts, useProductBatches } from '../../hooks/useProducts'
import { useVendors } from '../../hooks/useVendors'
import { useAuthStore } from '../../store/auth.store'
import { useQueryClient } from '@tanstack/react-query'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import {
  Search, Plus, Loader2, Upload, ChevronRight, ChevronDown,
  MoreHorizontal, AlertCircle, Pencil, ShieldBan, Trash2,
  RotateCcw, PackageMinus, X, Check, AlertTriangle
} from 'lucide-react'
import { formatPaise } from '../../../shared/utils/paise'
import { formatStock } from '../../../shared/utils/pack-size'
import { ImportCsvModal } from '../import/ImportCsvModal'
import { ProductFormModal } from './ProductFormModal'
import type { Product } from '../../../main/services/product.service'

// ── Status badge styles ──
const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  ACTIVE:      { bg: 'bg-emerald-100 dark:bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-400', label: 'Active' },
  QUARANTINED: { bg: 'bg-amber-100 dark:bg-amber-500/15',    text: 'text-amber-700 dark:text-amber-400',    label: 'Quarantined' },
  EXPIRED:     { bg: 'bg-red-100 dark:bg-red-500/15',        text: 'text-red-700 dark:text-red-400',        label: 'Expired' },
  RETURNED:    { bg: 'bg-blue-100 dark:bg-blue-500/15',      text: 'text-blue-700 dark:text-blue-400',      label: 'Returned' },
  DISPOSED:    { bg: 'bg-gray-100 dark:bg-gray-500/15',      text: 'text-gray-500 dark:text-gray-400',      label: 'Disposed' },
}

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.ACTIVE
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-full ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  )
}

// ── Inline edit modal for batch fields ──
function BatchEditModal({ batch, packSize, onClose, onSave }: {
  batch: any
  packSize: number
  onClose: () => void
  onSave: (data: { batch_number?: string; expiry_date?: string; vendor_id?: number | null; mrp_paise?: number; purchase_rate_paise?: number; quantity?: number; gst_rate_pct?: number }, reason: string) => void
}) {
  const { data: vendors } = useVendors()
  const [batchNumber, setBatchNumber] = useState(batch.batch_number || '')
  
  // Format expiry date for month input YYYY-MM
  const initialExpiryMonth = batch.expiry_date ? String(batch.expiry_date).slice(0, 7) : ''
  const [expiryDate, setExpiryDate] = useState(initialExpiryMonth)
  
  const [vendorId, setVendorId] = useState(batch.vendor_id ? String(batch.vendor_id) : '')
  const [mrp, setMrp] = useState((batch.mrp_paise / 100).toFixed(2))
  const [ptr, setPtr] = useState((batch.purchase_rate_paise / 100).toFixed(2))
  const [qty, setQty] = useState(String(batch.quantity))
  const [gst, setGst] = useState(String(batch.gst_rate_pct ?? 12))
  const [reason, setReason] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason.trim()) {
      alert('Please provide a reason for this change (required for audit trail).')
      return
    }

    let fullExpiryDate = batch.expiry_date
    if (expiryDate) {
      const parts = expiryDate.split('-').map(Number)
      if (parts.length === 2 && parts[0] && parts[1]) {
        const lastDay = new Date(parts[0], parts[1], 0).getDate()
        fullExpiryDate = `${parts[0]}-${String(parts[1]).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
      }
    }

    onSave({
      batch_number: batchNumber.trim().toUpperCase(),
      expiry_date: fullExpiryDate,
      vendor_id: vendorId ? parseInt(vendorId, 10) : null,
      mrp_paise: Math.round(parseFloat(mrp) * 100),
      purchase_rate_paise: Math.round(parseFloat(ptr) * 100),
      quantity: parseInt(qty, 10),
      gst_rate_pct: parseInt(gst, 10),
    }, reason)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-background rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-base">Edit Batch: {batch.batch_number}</h3>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Batch Number</label>
              <input type="text" value={batchNumber} onChange={e => setBatchNumber(e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-md bg-background uppercase focus:ring-2 focus:ring-primary/50 focus:outline-none" required />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Expiry Date</label>
              <input type="month" value={expiryDate} onChange={e => setExpiryDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:ring-2 focus:ring-primary/50 focus:outline-none" required />
            </div>
            <div className="space-y-1 col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Vendor / Supplier</label>
              <select value={vendorId} onChange={e => setVendorId(e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:ring-2 focus:ring-primary/50 focus:outline-none">
                <option value="">(None / Direct Entry)</option>
                {vendors?.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">MRP (₹)</label>
              <input type="number" step="0.01" value={mrp} onChange={e => setMrp(e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:ring-2 focus:ring-primary/50 focus:outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">P.Rate (₹)</label>
              <input type="number" step="0.01" value={ptr} onChange={e => setPtr(e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:ring-2 focus:ring-primary/50 focus:outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Stock (Units)</label>
              <input type="number" value={qty} onChange={e => setQty(e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:ring-2 focus:ring-primary/50 focus:outline-none" />
              <p className="text-[10px] text-muted-foreground">{formatStock(parseInt(qty, 10) || 0, packSize)}</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">GST %</label>
              <select value={gst} onChange={e => setGst(e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:ring-2 focus:ring-primary/50 focus:outline-none">
                <option value="0">0%</option>
                <option value="5">5%</option>
                <option value="12">12%</option>
                <option value="18">18%</option>
                <option value="28">28%</option>
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Reason for change <span className="text-red-500">*</span></label>
            <input type="text" value={reason} onChange={e => setReason(e.target.value)}
              placeholder="e.g. Batch typo corrected, physical stock count update..."
              className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:ring-2 focus:ring-primary/50 focus:outline-none" required />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted rounded-md transition-colors">
              Cancel
            </button>
            <button type="submit"
              className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded-md transition-colors flex items-center gap-1.5">
              <Check className="w-4 h-4" /> Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Quick Actions dropdown for a single batch ──
function BatchActions({ batch, packSize, onRefresh }: { batch: any; packSize: number; onRefresh: () => void }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const user = useAuthStore(s => s.user)
  const queryClient = useQueryClient()

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen])

  const changeStatus = async (newStatus: string) => {
    const reason = prompt(`Reason for changing status to "${newStatus}"?`)
    if (!reason) return
    try {
      await window.api.invoke(IPC_CHANNELS.BATCHES_UPDATE_STATUS, {
        batchId: batch.id,
        newStatus,
        actorUserId: user!.id,
        reason
      })
      queryClient.invalidateQueries({ queryKey: ['productBatches'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      onRefresh()
    } catch (err: any) {
      alert(`Failed: ${err.message}`)
    }
    setIsOpen(false)
  }

  const handleSaveBatchEdit = async (data: any, reason: string) => {
    try {
      await window.api.invoke(IPC_CHANNELS.BATCHES_UPDATE, {
        batchId: batch.id,
        data,
        actorUserId: user!.id,
        reason
      })
      queryClient.invalidateQueries({ queryKey: ['productBatches'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      onRefresh()
      setIsEditing(false)
    } catch (err: any) {
      alert(`Failed: ${err.message}`)
    }
  }

  const isActive = batch.status === 'ACTIVE'
  const isQuarantined = batch.status === 'QUARANTINED'

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen) }}
          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
          title="Batch actions"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>

        {isOpen && (
          <div className="absolute right-0 top-full mt-1 z-30 w-52 bg-background border rounded-lg shadow-lg py-1 text-sm animate-in fade-in slide-in-from-top-1">
            <button onClick={() => { setIsEditing(true); setIsOpen(false) }}
              className="flex items-center gap-2 w-full px-3 py-2 hover:bg-muted transition-colors text-left">
              <Pencil className="w-3.5 h-3.5" /> Edit Details
            </button>

            {isActive && (
              <button onClick={() => changeStatus('RETURNED')}
                className="flex items-center gap-2 w-full px-3 py-2 hover:bg-muted transition-colors text-left text-blue-600">
                <PackageMinus className="w-3.5 h-3.5" /> Supplier Return
              </button>
            )}

            <div className="border-t my-1" />
            
            <button 
              onClick={async () => {
                if (window.confirm('Are you sure you want to delete this batch? This action cannot be undone.')) {
                  try {
                    await window.api.invoke(IPC_CHANNELS.BATCHES_DELETE, batch.id)
                    queryClient.invalidateQueries({ queryKey: ['productBatches'] })
                    queryClient.invalidateQueries({ queryKey: ['products'] })
                    onRefresh()
                  } catch (err: any) {
                    alert(`Failed to delete: ${err.message}`)
                  }
                }
              }}
              className="flex items-center gap-2 w-full px-3 py-2 hover:bg-muted transition-colors text-left text-red-600"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>
        )}
      </div>

      {isEditing && (
        <BatchEditModal
          batch={batch}
          packSize={packSize}
          onClose={() => setIsEditing(false)}
          onSave={handleSaveBatchEdit}
        />
      )}
    </>
  )
}

// ── Product row with accordion batches ──
function ProductRow({ product, onEditProduct }: { product: Product; onEditProduct: (product: Product) => void }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const { data: batches, isLoading: isLoadingBatches, refetch } = useProductBatches(isExpanded ? product.id : 0)

  const isOutOfStock = (product.total_stock_units || 0) === 0
  const hasNearExpiry = product.has_near_expiry

  // Format MRP Range
  let mrpDisplay = '-'
  if (product.mrp_min !== undefined && product.mrp_max !== undefined) {
    if (product.mrp_min === product.mrp_max) {
      mrpDisplay = formatPaise(product.mrp_min)
    } else {
      mrpDisplay = `${formatPaise(product.mrp_min)} - ${formatPaise(product.mrp_max)}`
    }
  }

  return (
    <>
      <tr 
        className={`hover:bg-muted/30 transition-colors cursor-pointer ${isOutOfStock ? 'bg-red-500/5' : ''}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <td className="px-4 py-3 font-medium">
          <div className="flex items-center gap-2">
            {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
            <div>
              <span>
                {product.brand_name} {product.pack_size > 1 ? `(${product.pack_size}'s)` : ''}
              </span>
              {product.generic_name && (
                <p className="text-xs text-muted-foreground truncate max-w-xs">{product.generic_name}</p>
              )}
            </div>
          </div>
        </td>
        <td className="px-4 py-3 text-muted-foreground">
          {product.category}
        </td>
        <td className="px-4 py-3">
          {product.shelf_rack || '-'}
        </td>
        <td className="px-4 py-3">
          {mrpDisplay}
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-3">
            <div className="flex flex-col items-end gap-0.5">
              <div className="flex items-center gap-2">
                {hasNearExpiry && (
                  <span className="flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium text-red-700 bg-red-100 rounded-full" title="Expiring within 30 days">
                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                    Near Expiry
                  </span>
                )}
                <span className={isOutOfStock ? 'text-red-500 font-semibold' : 'font-medium'}>
                  {formatStock(product.total_stock_units || 0, product.pack_size)}
                </span>
              </div>
              {!isOutOfStock && product.pack_size > 1 && (
                <span className="text-[10px] text-muted-foreground">
                  ({product.total_stock_units} units)
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onEditProduct(product)
              }}
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
              title="Edit Product Details (Name, Salt Composition, Schedule, Rack)"
            >
              <Pencil className="w-4 h-4" />
            </button>
          </div>
        </td>
      </tr>

      {/* Expanded Batches Sub-table */}
      {isExpanded && (
        <tr className="bg-muted/10 border-b">
          <td colSpan={5} className="px-8 py-3">
            {isLoadingBatches ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading batches...
              </div>
            ) : batches && batches.length > 0 ? (
              <div className="rounded-md border bg-card">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/50 text-xs text-muted-foreground uppercase">
                    <tr>
                      <th className="px-4 py-2 font-medium">Batch No</th>
                      <th className="px-4 py-2 font-medium">Expiry</th>
                      <th className="px-4 py-2 font-medium">Vendor</th>
                      <th className="px-4 py-2 font-medium text-right">MRP</th>
                      <th className="px-4 py-2 font-medium text-right">P.Rate</th>
                      <th className="px-4 py-2 font-medium text-right">Stock</th>
                      <th className="px-4 py-2 font-medium text-right text-muted-foreground font-normal">GST</th>
                      <th className="px-4 py-2 font-medium w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {batches.map((batch: any) => {
                      const isInactive = batch.status !== 'ACTIVE'
                      
                      const getExpiryInfo = (sortDateStr: string, isActive: boolean) => {
                        if (!sortDateStr) return { class: 'text-muted-foreground' };
                        if (!isActive) return { class: 'text-muted-foreground' };
                        const daysLeft = Math.ceil((new Date(sortDateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                        
                        if (daysLeft <= 0) return { class: 'text-red-700 font-bold bg-red-100 px-1.5 py-0.5 rounded', icon: true };
                        if (daysLeft <= 30) return { class: 'text-red-600 font-bold', icon: true };
                        if (daysLeft <= 90) return { class: 'text-orange-500 font-semibold', icon: true };
                        if (daysLeft <= 180) return { class: 'text-amber-500 font-medium', icon: false };
                        return { class: 'text-emerald-600', icon: false };
                      }
                      
                      const expiryInfo = getExpiryInfo(batch.expiry_sort_date, !isInactive)

                      return (
                        <tr key={batch.id} className={`hover:bg-muted/30 ${isInactive ? 'opacity-60' : ''}`}>
                          <td className="px-4 py-2 font-medium">↳ {batch.batch_number}</td>
                          <td className="px-4 py-2">
                            <span className={`flex items-center gap-1.5 ${expiryInfo.class}`}>
                              {batch.expiry_date_str || '-'}
                              {expiryInfo.icon && <AlertCircle className="w-3.5 h-3.5" />}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-muted-foreground text-xs">{batch.vendor_name || '-'}</td>
                          <td className="px-4 py-2 text-right">{formatPaise(batch.mrp_paise)}</td>
                          <td className="px-4 py-2 text-right text-muted-foreground">{formatPaise(batch.purchase_rate_paise)}</td>
                          <td className="px-4 py-2 text-right">
                            <div>{formatStock(batch.quantity, product.pack_size)}</div>
                            {product.pack_size > 1 && batch.quantity > 0 && (
                              <div className="text-[10px] text-muted-foreground">({batch.quantity} units)</div>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right text-muted-foreground/50 text-xs">{batch.gst_rate_pct}%</td>
                          <td className="px-4 py-2 text-right">
                            <BatchActions batch={batch} packSize={product.pack_size} onRefresh={refetch} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground py-2 italic flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                No stock batches found for this product.
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

export function ProductList() {
  const queryClient = useQueryClient()
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [isProductFormOpen, setIsProductFormOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  
  const [filters, setFilters] = useState({
    hideOutOfStock: false,
    onlyOutOfStock: false,
    genericOnly: false,
    ethicalOnly: false,
    expiringSoon: false
  })
  
  // Invalidate cache whenever Inventory tab is mounted to get latest stock levels
  React.useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['products'] })
    queryClient.invalidateQueries({ queryKey: ['productBatches'] })
  }, [queryClient])

  // Debounce search query
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(timer)
  }, [query])

  const { data, isLoading, error, refetch } = useProducts({ 
    query: debouncedQuery, 
    page: 1,
    ...filters 
  })

  const handleManualRefresh = async () => {
    setIsRefreshing(true)
    await queryClient.invalidateQueries({ queryKey: ['products'] })
    await queryClient.invalidateQueries({ queryKey: ['productBatches'] })
    await refetch()
    setTimeout(() => setIsRefreshing(false), 500)
  }

  const toggleFilter = (key: keyof typeof filters) => {
    setFilters(prev => {
      const next = { ...prev, [key]: !prev[key] }
      if (key === 'genericOnly' && next.genericOnly) {
        next.ethicalOnly = false
      }
      if (key === 'ethicalOnly' && next.ethicalOnly) {
        next.genericOnly = false
      }
      if (key === 'hideOutOfStock' && next.hideOutOfStock) {
        next.onlyOutOfStock = false
      }
      if (key === 'onlyOutOfStock' && next.onlyOutOfStock) {
        next.hideOutOfStock = false
      }
      return next
    })
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Inventory</h2>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleManualRefresh}
            disabled={isRefreshing || isLoading}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground bg-muted rounded-md hover:bg-muted/80 transition-colors disabled:opacity-50"
            title="Refresh inventory stock counts"
          >
            <RotateCcw className={`w-4 h-4 ${isRefreshing || isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button 
            onClick={() => setIsImportOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground bg-muted rounded-md hover:bg-muted/80 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Import CSV
          </button>
          <button 
            onClick={() => setIsProductFormOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-md hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Product
          </button>
        </div>
      </div>

      <ImportCsvModal isOpen={isImportOpen} onOpenChange={setIsImportOpen} />
      <ProductFormModal 
        isOpen={isProductFormOpen || !!editingProduct} 
        product={editingProduct || undefined}
        onClose={() => {
          setIsProductFormOpen(false)
          setEditingProduct(null)
        }} 
      />

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 px-3 py-2 bg-card border rounded-md shadow-sm">
          <Search className="w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by brand name, generic name, or barcode..."
            className="flex-1 bg-transparent outline-none"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {isLoading && <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />}
        </div>
        
        {/* Quick Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip 
            label="Hide Out of Stock" 
            active={filters.hideOutOfStock} 
            onClick={() => toggleFilter('hideOutOfStock')} 
          />
          <FilterChip 
            label="Only Out of Stock" 
            active={filters.onlyOutOfStock} 
            onClick={() => toggleFilter('onlyOutOfStock')} 
          />
          <FilterChip 
            label="Generic Only" 
            active={filters.genericOnly} 
            onClick={() => toggleFilter('genericOnly')} 
          />
          <FilterChip 
            label="Ethical Only" 
            active={filters.ethicalOnly} 
            onClick={() => toggleFilter('ethicalOnly')} 
          />
          <FilterChip 
            label="Expiring < 90 Days" 
            active={filters.expiringSoon} 
            onClick={() => toggleFilter('expiringSoon')} 
          />
        </div>
      </div>

      {error ? (
        <div className="p-4 text-red-500 bg-red-500/10 rounded-md">Failed to load products</div>
      ) : (
        <div className="flex-1 overflow-auto border rounded-md bg-card">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="sticky top-0 bg-muted/95 backdrop-blur border-b z-10">
              <tr>
                <th className="px-4 py-3 font-medium">Brand Name</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Rack</th>
                <th className="px-4 py-3 font-medium">MRP</th>
                <th className="px-4 py-3 font-medium text-right">Total Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data?.data.map((product) => (
                <ProductRow key={product.id} product={product} onEditProduct={setEditingProduct} />
              ))}
              {data?.data.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No products found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Showing {data?.data.length || 0} of {data?.total || 0} items</span>
      </div>
    </div>
  )
}

function FilterChip({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
        active 
          ? 'bg-primary text-primary-foreground border-primary' 
          : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
      }`}
    >
      {label}
    </button>
  )
}
