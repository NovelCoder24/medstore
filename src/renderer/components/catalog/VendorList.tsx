import React, { useState } from 'react'
import { useVendors, useVendorLedger, useVendorPayments, useCreateVendor, useUpdateVendor } from '../../hooks/useVendors'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../store/auth.store'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import { formatPaise } from '../../../shared/utils/paise'
import { Vendor } from '../../../main/services/vendor.service'
import { 
  Plus, Building2, Loader2, Search, CreditCard, History, Edit3, 
  Phone, Mail, MapPin, CheckCircle2, X, Wallet, 
  Landmark, RotateCcw
} from 'lucide-react'

// ── 1. Instalment Payment Modal Component ──
interface PaymentModalProps {
  vendor: Vendor | null
  onClose: () => void
}

function InstalmentPaymentModal({ vendor, onClose }: PaymentModalProps) {
  const queryClient = useQueryClient()
  const { user } = useAuthStore()

  const [amountRupees, setAmountRupees] = useState('')
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE'>('UPI')
  const [referenceNo, setReferenceNo] = useState('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)

  if (!vendor) return null

  const outstandingRupees = (vendor.current_balance_paise || 0) / 100

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsedAmount = parseFloat(amountRupees)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid payment amount greater than zero.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await window.api.invoke(IPC_CHANNELS.VENDORS_RECORD_PAYMENT, {
        vendorId: vendor.id,
        amountPaise: Math.round(parsedAmount * 100),
        paymentMode,
        referenceNo: referenceNo.trim() || undefined,
        notes: notes.trim() || undefined,
        userId: user?.id
      })

      // Invalidate queries so lists and balances update live
      queryClient.invalidateQueries({ queryKey: ['vendors'] })
      queryClient.invalidateQueries({ queryKey: ['vendorLedger', vendor.id] })
      queryClient.invalidateQueries({ queryKey: ['vendorPayments', vendor.id] })

      setIsSuccess(true)
      setTimeout(() => {
        setIsSuccess(false)
        onClose()
      }, 1000)
    } catch (err: any) {
      setError(err.message || 'Failed to record instalment payment.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-lg bg-background border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-foreground">Pay Supplier Instalment</h3>
              <p className="text-xs text-muted-foreground font-medium">{vendor.name}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Outstanding Balance Banner */}
          <div className="flex items-center justify-between p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl">
            <div>
              <div className="text-xs font-semibold text-rose-700 dark:text-rose-300 uppercase tracking-wide">
                Current Outstanding Balance
              </div>
              <div className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 mt-0.5">
                {formatPaise(vendor.current_balance_paise || 0)}
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-600 dark:text-rose-400">
              <Wallet className="w-6 h-6" />
            </div>
          </div>

          {error && (
            <div className="p-3.5 text-xs font-medium text-red-600 bg-red-500/10 rounded-lg border border-red-500/20">
              {error}
            </div>
          )}

          {isSuccess && (
            <div className="p-3.5 text-xs font-semibold text-emerald-600 bg-emerald-500/10 rounded-lg border border-emerald-500/20 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Instalment payment recorded successfully!
            </div>
          )}

          {/* Amount Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Instalment Amount (₹) *</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground font-extrabold text-base">₹</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amountRupees}
                onChange={(e) => setAmountRupees(e.target.value)}
                placeholder="0.00"
                className="w-full pl-9 pr-4 py-2.5 text-lg font-extrabold border border-input rounded-xl outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-background text-foreground shadow-sm transition-all"
              />
            </div>
            {outstandingRupees > 0 && (
              <div className="flex justify-end gap-2 mt-1.5">
                <button
                  type="button"
                  onClick={() => setAmountRupees((outstandingRupees / 2).toFixed(2))}
                  className="px-2.5 py-1 text-[11px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-md transition-colors"
                >
                  Pay 50% (₹{(outstandingRupees / 2).toFixed(2)})
                </button>
                <button
                  type="button"
                  onClick={() => setAmountRupees(outstandingRupees.toFixed(2))}
                  className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 rounded-md transition-colors"
                >
                  Pay Full (₹{outstandingRupees.toFixed(2)})
                </button>
              </div>
            )}
          </div>

          {/* Payment Mode Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Payment Mode</label>
            <div className="grid grid-cols-4 gap-2">
              {(['UPI', 'CASH', 'BANK_TRANSFER', 'CHEQUE'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPaymentMode(mode)}
                  className={`py-2.5 px-2 text-xs font-bold rounded-xl border transition-all text-center ${
                    paymentMode === mode
                      ? 'bg-primary text-primary-foreground border-primary shadow-md ring-2 ring-primary/30'
                      : 'bg-muted hover:bg-muted/80 text-foreground font-semibold border-border'
                  }`}
                >
                  {mode.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Reference / UTR Number */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Reference / UTR / Cheque No. <span className="text-muted-foreground font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              placeholder="e.g. UTR1029384756 or Cheque #00123"
              className="w-full px-3.5 py-2.5 text-xs border border-input rounded-xl outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-background text-foreground font-mono shadow-sm transition-all"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Notes / Remarks <span className="text-muted-foreground font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Instalment 1 of 3 for July purchase"
              className="w-full px-3.5 py-2.5 text-xs border border-input rounded-xl outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-background text-foreground shadow-sm transition-all"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground rounded-xl border border-border transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !amountRupees}
              className="flex items-center gap-2 px-6 py-2.5 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl shadow-md transition-all disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Record Instalment Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── 2. Vendor Ledger & Payments History Modal ──
interface LedgerModalProps {
  vendor: Vendor | null
  onClose: () => void
}

function VendorLedgerModal({ vendor, onClose }: LedgerModalProps) {
  const [activeTab, setActiveTab] = useState<'PAYMENTS' | 'LEDGER'>('PAYMENTS')

  const { data: payments, isLoading: isLoadingPayments } = useVendorPayments(vendor?.id || 0)
  const { data: ledger, isLoading: isLoadingLedger } = useVendorLedger(vendor?.id || 0)

  if (!vendor) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-3xl max-h-[85vh] bg-background border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Landmark className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-foreground">{vendor.name}</h3>
              <p className="text-xs text-muted-foreground font-medium">
                GSTIN: {vendor.gstin || 'N/A'} • Phone: {vendor.contact_phone || 'N/A'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Outstanding Balance</div>
              <div className="text-base font-extrabold text-rose-600 dark:text-rose-400">
                {formatPaise(vendor.current_balance_paise || 0)}
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

        {/* Tab Switcher */}
        <div className="flex border-b border-border px-6 bg-muted/20">
          <button
            onClick={() => setActiveTab('PAYMENTS')}
            className={`py-3.5 px-4 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'PAYMENTS'
                ? 'border-primary text-primary font-extrabold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Instalment Payments ({payments?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('LEDGER')}
            className={`py-3.5 px-4 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'LEDGER'
                ? 'border-primary text-primary font-extrabold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Account Ledger History ({ledger?.length || 0})
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-auto p-6">
          {activeTab === 'PAYMENTS' && (
            <div>
              {isLoadingPayments ? (
                <div className="flex items-center justify-center p-12 text-muted-foreground">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : payments?.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground border border-dashed rounded-xl bg-background">
                  No instalment payments recorded for this supplier yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {payments?.map((payment) => (
                    <div key={payment.id} className="p-4 bg-background border border-border rounded-xl flex items-center justify-between shadow-sm">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                            {payment.payment_mode}
                          </span>
                          <span className="text-xs font-medium text-muted-foreground">
                            {new Date(payment.created_at).toLocaleString()}
                          </span>
                        </div>
                        {payment.reference_no && (
                          <p className="text-xs font-mono text-foreground font-semibold">
                            Ref / UTR: {payment.reference_no}
                          </p>
                        )}
                        {payment.notes && (
                          <p className="text-xs text-muted-foreground italic">"{payment.notes}"</p>
                        )}
                        {payment.recorded_by_name && (
                          <p className="text-[10px] font-medium text-muted-foreground">
                            Recorded by: {payment.recorded_by_name}
                          </p>
                        )}
                      </div>

                      <div className="text-right">
                        <div className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                          -{formatPaise(payment.amount_paise)}
                        </div>
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Instalment Paid</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'LEDGER' && (
            <div>
              {isLoadingLedger ? (
                <div className="flex items-center justify-center p-12 text-muted-foreground">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : ledger?.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground border border-dashed rounded-xl bg-background">
                  No ledger transactions found.
                </div>
              ) : (
                <div className="border border-border rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/60 border-b border-border font-bold text-foreground">
                      <tr>
                        <th className="px-4 py-3 font-bold">Date & Time</th>
                        <th className="px-4 py-3 font-bold">Transaction Type</th>
                        <th className="px-4 py-3 font-bold">Reference No.</th>
                        <th className="px-4 py-3 font-bold text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border bg-background">
                      {ledger?.map((entry) => {
                        const isAddition = entry.amount_paise > 0
                        return (
                          <tr key={entry.id} className="hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-3 font-medium text-muted-foreground">
                              {new Date(entry.created_at).toLocaleString()}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`font-bold px-2.5 py-0.5 rounded-md text-[10px] border ${
                                entry.transaction_type === 'PURCHASE_INVOICE' 
                                  ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                                  : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                              }`}>
                                {entry.transaction_type.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-mono font-semibold text-foreground">
                              {entry.reference_id || '-'}
                            </td>
                            <td className={`px-4 py-3 text-right font-extrabold ${
                              isAddition ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                            }`}>
                              {isAddition ? '+' : ''}{formatPaise(entry.amount_paise)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── 3. Add / Edit Vendor Modal ──
interface VendorFormModalProps {
  vendor: Vendor | null
  isOpen: boolean
  onClose: () => void
}

function VendorFormModal({ vendor, isOpen, onClose }: VendorFormModalProps) {
  const createVendorMutation = useCreateVendor()
  const updateVendorMutation = useUpdateVendor()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [gstin, setGstin] = useState('')
  const [error, setError] = useState<string | null>(null)

  React.useEffect(() => {
    if (vendor) {
      setName(vendor.name || '')
      setPhone(vendor.contact_phone || '')
      setEmail(vendor.contact_email || '')
      setAddress(vendor.address || '')
      setGstin(vendor.gstin || '')
    } else {
      setName('')
      setPhone('')
      setEmail('')
      setAddress('')
      setGstin('')
    }
  }, [vendor, isOpen])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setError(null)

    const payload = {
      name: name.trim(),
      contact_phone: phone.trim() || null,
      contact_email: email.trim() || null,
      address: address.trim() || null,
      gstin: gstin.trim() ? gstin.trim().toUpperCase() : null
    }

    try {
      if (vendor) {
        await updateVendorMutation.mutateAsync({ id: vendor.id, data: payload })
      } else {
        await createVendorMutation.mutateAsync(payload)
      }
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to save vendor details.')
    }
  }

  const isSaving = createVendorMutation.isPending || updateVendorMutation.isPending

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-lg bg-background border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Building2 className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-lg text-foreground">
              {vendor ? 'Edit Supplier Details' : 'Add New Supplier / Vendor'}
            </h3>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3.5 text-xs font-medium text-red-600 bg-red-500/10 rounded-lg border border-red-500/20">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Supplier / Vendor Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Unicare Medical Agencies"
              className="w-full px-3.5 py-2.5 text-sm border border-input rounded-xl outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-background text-foreground font-bold shadow-sm transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Contact Phone</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 9826123456"
                className="w-full px-3.5 py-2.5 text-xs border border-input rounded-xl outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-background text-foreground shadow-sm transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. sales@unicare.com"
                className="w-full px-3.5 py-2.5 text-xs border border-input rounded-xl outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-background text-foreground shadow-sm transition-all"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">GSTIN Number</label>
            <input
              type="text"
              value={gstin}
              onChange={(e) => setGstin(e.target.value)}
              placeholder="e.g. 22AAAAA0000A1Z5"
              className="w-full px-3.5 py-2.5 text-xs border border-input rounded-xl outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-background text-foreground font-mono uppercase shadow-sm transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Physical Address</label>
            <textarea
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. Plot 14, Transport Nagar, Bhilai, Chhattisgarh"
              className="w-full px-3.5 py-2.5 text-xs border border-input rounded-xl outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-background text-foreground resize-none shadow-sm transition-all"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground rounded-xl border border-border transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !name.trim()}
              className="flex items-center gap-2 px-6 py-2.5 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl shadow-md transition-all disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {vendor ? 'Update Details' : 'Create Supplier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main Suppliers Dashboard Component ──
export function VendorList() {
  const queryClient = useQueryClient()
  const { data: vendors, isLoading, error } = useVendors()

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedVendorForPayment, setSelectedVendorForPayment] = useState<Vendor | null>(null)
  const [selectedVendorForLedger, setSelectedVendorForLedger] = useState<Vendor | null>(null)
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)

  // Filter vendors by search
  const filteredVendors = (vendors || []).filter((v) => {
    const q = searchQuery.toLowerCase()
    return (
      v.name.toLowerCase().includes(q) ||
      (v.contact_phone && v.contact_phone.includes(q)) ||
      (v.gstin && v.gstin.toLowerCase().includes(q)) ||
      (v.address && v.address.toLowerCase().includes(q))
    )
  })

  // Calculate Summary Stats
  const totalVendors = vendors?.length || 0
  const totalOutstandingPaise = (vendors || []).reduce((sum, v) => sum + Math.max(0, v.current_balance_paise || 0), 0)
  const activePayableVendorsCount = (vendors || []).filter((v) => (v.current_balance_paise || 0) > 0).length

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-foreground">Suppliers & Instalments</h2>
          <p className="text-xs font-medium text-muted-foreground mt-0.5">
            Manage vendor info, track running accounts, and record partial instalment payments with payment modes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['vendors'] })
            }}
            className="p-2 border border-border rounded-xl hover:bg-muted text-muted-foreground transition-colors"
            title="Refresh Vendors List"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button 
            onClick={() => {
              setEditingVendor(null)
              setIsFormOpen(true)
            }}
            className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-primary-foreground bg-primary rounded-xl hover:bg-primary/90 transition-all shadow-md hover:shadow-lg"
          >
            <Plus className="w-4 h-4" />
            Add Supplier
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-background border border-border rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-primary/10 text-primary border border-primary/20">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total Suppliers</p>
            <h3 className="text-2xl font-extrabold text-foreground">{totalVendors}</h3>
          </div>
        </div>

        <div className="p-4 bg-background border border-border rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total Outstanding Due</p>
            <h3 className="text-2xl font-extrabold text-rose-600 dark:text-rose-400">{formatPaise(totalOutstandingPaise)}</h3>
          </div>
        </div>

        <div className="p-4 bg-background border border-border rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Due Suppliers Count</p>
            <h3 className="text-2xl font-extrabold text-foreground">{activePayableVendorsCount}</h3>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search suppliers by Name, Phone, Email, GSTIN, or Address..."
          className="w-full pl-9 pr-4 py-2.5 text-xs font-medium border border-input rounded-xl outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-background text-foreground transition-all placeholder:text-muted-foreground/60 shadow-sm"
        />
      </div>

      {/* Vendor Cards Grid — items-start removes artificial vertical stretching */}
      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="p-4 text-xs font-medium text-red-500 bg-red-500/10 rounded-xl border border-red-500/20">
          Failed to load supplier records.
        </div>
      ) : filteredVendors.length === 0 ? (
        <div className="p-12 text-center text-muted-foreground border border-dashed border-border rounded-2xl bg-background">
          No supplier records match your search query.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 items-start overflow-auto flex-1 pb-4">
          {filteredVendors.map((vendor) => {
            const duePaise = vendor.current_balance_paise || 0
            const hasDue = duePaise > 0

            return (
              <div 
                key={vendor.id} 
                className="flex flex-col p-4 bg-background border border-border rounded-2xl shadow-sm hover:shadow-md transition-all group"
              >
                <div className="space-y-2.5">
                  {/* Top Vendor Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 group-hover:bg-primary group-hover:text-primary-foreground transition-colors shrink-0">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-base text-foreground line-clamp-1">{vendor.name}</h3>
                        <p className="text-[11px] font-mono text-muted-foreground font-semibold mt-0.5">
                          GSTIN: {vendor.gstin || 'N/A'}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setEditingVendor(vendor)
                        setIsFormOpen(true)
                      }}
                      className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors shrink-0"
                      title="Edit Supplier Details"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Compact Contact Info Box */}
                  <div className="space-y-1 text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-xl border border-border/50 min-h-[72px] flex flex-col justify-center">
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 shrink-0 text-primary/70" />
                      <span className="truncate font-medium">{vendor.contact_phone || '—'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 shrink-0 text-primary/70" />
                      <span className="truncate font-medium">{vendor.contact_email || '—'}</span>
                    </div>
                    {vendor.address && (
                      <div className="flex items-start gap-2 pt-1 border-t border-border/50 mt-0.5">
                        <MapPin className="w-3.5 h-3.5 shrink-0 text-primary/70 mt-0.5" />
                        <span className="line-clamp-1 font-medium">{vendor.address}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Balance & Action Buttons */}
                <div className="pt-3 mt-3 border-t border-border space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Outstanding Due:</span>
                    <span className={`text-base font-extrabold ${hasDue ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {formatPaise(duePaise)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setSelectedVendorForPayment(vendor)}
                      className="flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-sm"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      Pay Instalment
                    </button>

                    <button
                      onClick={() => setSelectedVendorForLedger(vendor)}
                      className="flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold text-foreground bg-muted hover:bg-muted/80 border border-border rounded-xl transition-colors"
                    >
                      <History className="w-3.5 h-3.5" />
                      History & Ledger
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modals & Drawers */}
      {selectedVendorForPayment && (
        <InstalmentPaymentModal
          vendor={selectedVendorForPayment}
          onClose={() => setSelectedVendorForPayment(null)}
        />
      )}

      {selectedVendorForLedger && (
        <VendorLedgerModal
          vendor={selectedVendorForLedger}
          onClose={() => setSelectedVendorForLedger(null)}
        />
      )}

      <VendorFormModal
        vendor={editingVendor}
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false)
          setEditingVendor(null)
        }}
      />
    </div>
  )
}
