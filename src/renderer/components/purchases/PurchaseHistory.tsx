import React, { useState } from 'react'
import { usePurchaseInvoices, usePurchaseInvoiceDetails } from '../../hooks/usePurchases'
import { useVendors } from '../../hooks/useVendors'
import { formatPaise } from '../../../shared/utils/paise'
import { 
  Search, Calendar, Filter, Sparkles, FileText, Building2, 
  CheckCircle2, X, Loader2, ArrowUpDown, ChevronRight, Eye, 
  Receipt, ShieldCheck, Tag, ShoppingBag
} from 'lucide-react'

function formatTimestamp(rawTimestamp: string | null | undefined): string {
  if (!rawTimestamp) return 'N/A'
  try {
    let formattedStr = rawTimestamp
    // If SQLite raw string without T/Z, e.g., "2026-08-07 15:30:00"
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(rawTimestamp)) {
      formattedStr = rawTimestamp.replace(' ', 'T') + 'Z'
    }
    const dateObj = new Date(formattedStr)
    if (isNaN(dateObj.getTime())) return rawTimestamp

    return dateObj.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  } catch (e) {
    return rawTimestamp
  }
}

// ── Invoice Details Modal ──
interface DetailModalProps {
  invoiceId: number | null
  onClose: () => void
}

function PurchaseInvoiceDetailModal({ invoiceId, onClose }: DetailModalProps) {
  const { data: invoice, isLoading } = usePurchaseInvoiceDetails(invoiceId)

  if (!invoiceId) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-4xl max-h-[90vh] bg-background border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-foreground">Invoice #{invoice?.invoice_number || 'Loading...'}</h3>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">
                Vendor: <span className="font-bold text-foreground">{invoice?.vendor_name}</span> (GSTIN: {invoice?.vendor_gstin || 'N/A'}) • Date: {invoice?.invoice_date}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Total Bill Amount</div>
              <div className="text-lg font-extrabold text-foreground">
                {formatPaise(invoice?.total_amount_paise || 0)}
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-auto p-6 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center p-12 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : !invoice ? (
            <div className="p-8 text-center text-muted-foreground">Invoice details not found.</div>
          ) : (
            <>
              {/* Summary Stats Strip */}
              <div className="grid grid-cols-3 gap-3 p-3.5 bg-muted/30 border border-border/60 rounded-xl text-xs">
                <div>
                  <span className="text-muted-foreground font-medium">Billed Items:</span>
                  <div className="font-bold text-foreground text-sm mt-0.5">{invoice.items.length} Products</div>
                </div>
                <div>
                  <span className="text-muted-foreground font-medium">Verified By:</span>
                  <div className="font-bold text-foreground text-sm mt-0.5">{invoice.verified_by_name || 'System Admin'}</div>
                </div>
                <div>
                  <span className="text-muted-foreground font-medium">Entry Timestamp:</span>
                  <div className="font-bold text-foreground text-xs mt-0.5">{formatTimestamp(invoice.created_at)}</div>
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-border rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/50 border-b border-border font-bold text-foreground">
                    <tr>
                      <th className="px-4 py-2.5">Product Name</th>
                      <th className="px-4 py-2.5">Batch No.</th>
                      <th className="px-4 py-2.5">Expiry</th>
                      <th className="px-4 py-2.5 text-center">Qty (Packs/Loose)</th>
                      <th className="px-4 py-2.5 text-right">MRP</th>
                      <th className="px-4 py-2.5 text-right">Purchase Rate</th>
                      <th className="px-4 py-2.5 text-right">GST %</th>
                      <th className="px-4 py-2.5 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-background">
                    {invoice.items.map((item) => (
                      <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-2.5 font-bold text-foreground">
                          {item.product_name}
                          {item.composition_name && (
                            <div className="text-[10px] text-muted-foreground font-normal">{item.composition_name}</div>
                          )}
                        </td>
                        <td className="px-4 py-2.5 font-mono font-bold text-foreground">{item.batch_number}</td>
                        <td className="px-4 py-2.5 font-medium text-muted-foreground">{item.expiry_date}</td>
                        <td className="px-4 py-2.5 text-center font-bold text-foreground">
                          {item.quantity_packs} Pks ({item.quantity_units} Units)
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium text-muted-foreground">{formatPaise(item.mrp_paise)}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-foreground">{formatPaise(item.purchase_rate_paise)}</td>
                        <td className="px-4 py-2.5 text-right font-medium text-muted-foreground">{item.gst_rate_pct}%</td>
                        <td className="px-4 py-2.5 text-right font-bold text-foreground">{formatPaise(item.total_paise)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Purchase History Tab Component ──
export function PurchaseHistory() {
  const { data: vendors } = useVendors()

  const [search, setSearch] = useState('')
  const [selectedVendor, setSelectedVendor] = useState<number | undefined>(undefined)
  const [dateRange, setDateRange] = useState<'ALL' | 'THIS_MONTH' | 'LAST_MONTH' | 'LAST_3_MONTHS'>('ALL')
  const [viewingInvoiceId, setViewingInvoiceId] = useState<number | null>(null)

  // Compute date filter strings
  const getFilterDates = () => {
    if (dateRange === 'ALL') return {}
    const now = new Date()
    let startDate = ''
    let endDate = ''

    if (dateRange === 'THIS_MONTH') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
    } else if (dateRange === 'LAST_MONTH') {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0]
      endDate = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]
    } else if (dateRange === 'LAST_3_MONTHS') {
      startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().split('T')[0]
      endDate = now.toISOString().split('T')[0]
    }

    return { startDate, endDate }
  }

  const { startDate, endDate } = getFilterDates()

  const { data: invoices, isLoading, error } = usePurchaseInvoices({
    vendorId: selectedVendor,
    startDate,
    endDate,
    search: search.trim() || undefined
  })

  // Calculate Metrics
  const totalCount = invoices?.length || 0
  const totalAmountPaise = (invoices || []).reduce((sum, inv) => sum + inv.total_amount_paise, 0)

  return (
    <div className="space-y-4">
      {/* Metrics Top Strip */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-background border border-border rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-primary/10 text-primary border border-primary/20">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total Invoices Found</p>
            <h3 className="text-2xl font-extrabold text-foreground">{totalCount} Bills</h3>
          </div>
        </div>

        <div className="p-4 bg-background border border-border rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total Inward Purchase Value</p>
            <h3 className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">{formatPaise(totalAmountPaise)}</h3>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Search */}
        <div className="relative md:col-span-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoice # or supplier..."
            className="w-full pl-9 pr-4 py-2 text-xs font-medium border border-input rounded-xl bg-background text-foreground focus:ring-2 focus:ring-primary outline-none shadow-sm"
          />
        </div>

        {/* Date Range Selector */}
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value as any)}
          className="px-3 py-2 text-xs font-semibold border border-input rounded-xl bg-background text-foreground focus:ring-2 focus:ring-primary outline-none shadow-sm cursor-pointer"
        >
          <option value="ALL">📅 All Time History</option>
          <option value="THIS_MONTH">📅 This Month</option>
          <option value="LAST_MONTH">📅 Last Month</option>
          <option value="LAST_3_MONTHS">📅 Last 3 Months</option>
        </select>

        {/* Supplier Selector */}
        <select
          value={selectedVendor || ''}
          onChange={(e) => setSelectedVendor(e.target.value ? Number(e.target.value) : undefined)}
          className="px-3 py-2 text-xs font-semibold border border-input rounded-xl bg-background text-foreground focus:ring-2 focus:ring-primary outline-none shadow-sm cursor-pointer"
        >
          <option value="">🏢 All Suppliers / Vendors</option>
          {vendors?.map((v) => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>
      </div>

      {/* Invoices List Table */}
      {isLoading ? (
        <div className="flex items-center justify-center p-12 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : error ? (
        <div className="p-4 text-xs font-medium text-red-500 bg-red-500/10 rounded-xl border border-red-500/20">
          Failed to load purchase invoice records.
        </div>
      ) : invoices?.length === 0 ? (
        <div className="p-12 text-center text-muted-foreground border border-dashed border-border rounded-2xl bg-background">
          No purchase invoices found matching your filters.
        </div>
      ) : (
        <div className="border border-border rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/60 border-b border-border font-bold text-foreground">
              <tr>
                <th className="px-4 py-3 font-bold">Invoice Date</th>
                <th className="px-4 py-3 font-bold">Invoice Number</th>
                <th className="px-4 py-3 font-bold">Supplier / Vendor</th>
                <th className="px-4 py-3 font-bold text-center">Items</th>
                <th className="px-4 py-3 font-bold text-right">Total Amount</th>
                <th className="px-4 py-3 font-bold text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-background">
              {invoices?.map((inv) => (
                <tr key={inv.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-semibold text-foreground">
                    {inv.invoice_date}
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-foreground">
                    #{inv.invoice_number}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-bold text-foreground text-xs">{inv.vendor_name}</div>
                    <div className="text-[10px] font-mono text-muted-foreground">GSTIN: {inv.vendor_gstin || 'N/A'}</div>
                  </td>
                  <td className="px-4 py-3 text-center font-bold text-foreground">
                    {inv.item_count} items
                  </td>
                  <td className="px-4 py-3 text-right font-extrabold text-foreground">
                    {formatPaise(inv.total_amount_paise)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => setViewingInvoiceId(inv.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-xl transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View Invoice
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Invoice Detail Modal */}
      {viewingInvoiceId && (
        <PurchaseInvoiceDetailModal
          invoiceId={viewingInvoiceId}
          onClose={() => setViewingInvoiceId(null)}
        />
      )}
    </div>
  )
}
