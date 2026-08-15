import React, { useState } from 'react'
import { useCustomers, useAcceptPayment, useCreateCustomer, useCustomerLedger } from '../../hooks/useCustomers'
import { formatPaise } from '../../../shared/utils/paise'
import { Plus, IndianRupee, Search, Loader2, User, Phone, FileText, CheckCircle2, History, X } from 'lucide-react'

export function CustomerList() {
  const { data: customers, isLoading } = useCustomers()
  const { mutateAsync: acceptPayment, isPending: isPaying } = useAcceptPayment()
  const { mutateAsync: createCustomer, isPending: isCreating } = useCreateCustomer()
  
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newCustomer, setNewCustomer] = useState({ name: '', mobile: '' })
  
  const [paymentModal, setPaymentModal] = useState<{ id: number, name: string, balance: number } | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [ledgerCustomerId, setLedgerCustomerId] = useState<number | null>(null)

  const filteredCustomers = customers?.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.mobile.includes(search)
  )

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCustomer.name.trim() || !newCustomer.mobile.trim()) return
    try {
      await createCustomer({ name: newCustomer.name.trim(), mobile: newCustomer.mobile.trim() })
      setShowAdd(false)
      setNewCustomer({ name: '', mobile: '' })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add customer')
    }
  }

  const handleAcceptPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!paymentModal || !paymentAmount) return
    const amountPaise = parseFloat(paymentAmount) * 100
    if (amountPaise <= 0) return
    
    try {
      await acceptPayment({ 
        customerId: paymentModal.id, 
        amountPaise 
      })
      setPaymentModal(null)
      setPaymentAmount('')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to accept payment')
    }
  }

  if (isLoading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="text-xs font-medium">Loading patient directory...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Patient Directory & Credit Accounts</h2>
          <p className="text-xs text-slate-500 mt-0.5">Manage patient histories, credit balances, and payment receipts</p>
        </div>
        <button 
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition active:scale-95"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          Add New Patient
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search patient by name or phone number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition font-medium"
          />
        </div>
        <div className="text-xs font-medium text-slate-500 px-2">
          {filteredCustomers?.length || 0} Registered Patients
        </div>
      </div>

      {/* Patients Grid */}
      {filteredCustomers?.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center text-slate-400">
          <User className="w-10 h-10 mx-auto text-slate-300 mb-2" />
          <p className="font-semibold text-sm text-slate-700">No patient records found</p>
          <p className="text-xs text-slate-400 mt-1">Try a different search term or add a new patient profile.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCustomers?.map((customer) => {
            const hasDue = customer.current_balance_paise > 0
            return (
              <div 
                key={customer.id}
                className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between hover:shadow-md transition group"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-base text-slate-900 group-hover:text-blue-600 transition tracking-tight">
                        {customer.name}
                      </h3>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-mono">{customer.mobile}</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      Khata Account
                    </span>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-500">Credit Balance:</span>
                    <strong className={`font-bold text-sm ${hasDue ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {hasDue ? formatPaise(customer.current_balance_paise) : '₹0.00 (Cleared)'}
                    </strong>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="mt-5 flex gap-2 pt-2 border-t border-slate-100/60">
                  <button
                    onClick={() => setLedgerCustomerId(customer.id)}
                    className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-1"
                  >
                    <History className="w-3.5 h-3.5" />
                    Ledger
                  </button>
                  <button
                    onClick={() => setPaymentModal({ id: customer.id, name: customer.name, balance: customer.current_balance_paise })}
                    disabled={!hasDue}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 ${
                      hasDue 
                        ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs' 
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-60'
                    }`}
                  >
                    <IndianRupee className="w-3.5 h-3.5" />
                    Pay Bill
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Customer Ledger Drawer / Modal */}
      {ledgerCustomerId && (
        <CustomerLedgerModal 
          customerId={ledgerCustomerId} 
          onClose={() => setLedgerCustomerId(null)} 
        />
      )}

      {/* Add Customer Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4 animate-in zoom-in-95">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-900">Add New Patient Profile</h3>
              <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddCustomer} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Patient Full Name</label>
                <input 
                  required 
                  autoFocus 
                  type="text" 
                  placeholder="e.g. Rahul Sharma"
                  value={newCustomer.name} 
                  onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} 
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium" 
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Mobile Phone Number</label>
                <input 
                  required 
                  type="text" 
                  placeholder="e.g. 9826123456"
                  value={newCustomer.mobile} 
                  onChange={e => setNewCustomer({...newCustomer, mobile: e.target.value})} 
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono" 
                />
              </div>
              <div className="flex gap-2 pt-3 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setShowAdd(false)} 
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isCreating} 
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs transition"
                >
                  {isCreating ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {paymentModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm p-6 space-y-4 animate-in zoom-in-95">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-base text-slate-900">Receive Credit Payment</h3>
                <p className="text-xs text-slate-500 mt-0.5">{paymentModal.name}</p>
              </div>
              <button onClick={() => setPaymentModal(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl flex justify-between items-center text-xs">
              <span className="font-medium">Total Outstanding Due:</span>
              <span className="font-bold text-sm">{formatPaise(paymentModal.balance)}</span>
            </div>

            <form onSubmit={handleAcceptPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Amount Received (₹)</label>
                <input 
                  required 
                  autoFocus 
                  type="number" 
                  step="0.01" 
                  min="0.01" 
                  max={paymentModal.balance / 100} 
                  value={paymentAmount} 
                  onChange={e => setPaymentAmount(e.target.value)} 
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-base font-bold text-slate-900" 
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setPaymentModal(null)} 
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isPaying} 
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-1"
                >
                  {isPaying ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function CustomerLedgerModal({ customerId, onClose }: { customerId: number; onClose: () => void }) {
  const { data: ledger, isLoading } = useCustomerLedger(customerId)

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl p-6 space-y-4 animate-in zoom-in-95 max-h-[85vh] flex flex-col">
        <div className="flex justify-between items-center pb-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-base text-slate-900">Patient Ledger & Transaction History</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-1">
          {isLoading ? (
            <div className="p-8 text-center text-slate-400"><Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600" /></div>
          ) : !ledger || ledger.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">No ledger records found for this patient.</div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase text-[10px]">
                  <th className="py-2.5 px-2">Date</th>
                  <th className="py-2.5 px-2">Type / Note</th>
                  <th className="py-2.5 px-2 text-right">Debit (Sale)</th>
                  <th className="py-2.5 px-2 text-right">Credit (Paid)</th>
                  <th className="py-2.5 px-2 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {ledger.map((entry: any, index: number) => (
                  <tr key={index} className="hover:bg-slate-50">
                    <td className="py-2.5 px-2 text-slate-600 font-mono">{entry.created_at?.split('T')[0] || '-'}</td>
                    <td className="py-2.5 px-2 text-slate-800 font-medium">{entry.description || entry.type || 'Transaction'}</td>
                    <td className="py-2.5 px-2 text-right text-slate-900 font-semibold">{entry.debit_paise ? formatPaise(entry.debit_paise) : '-'}</td>
                    <td className="py-2.5 px-2 text-right text-emerald-600 font-semibold">{entry.credit_paise ? formatPaise(entry.credit_paise) : '-'}</td>
                    <td className="py-2.5 px-2 text-right font-bold text-slate-900">{formatPaise(entry.balance_paise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="pt-3 border-t border-slate-100 flex justify-end shrink-0">
          <button onClick={onClose} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

