import React, { useState } from 'react'
import { useCustomers, useAcceptPayment, useCreateCustomer } from '../../hooks/useCustomers'
import { formatPaise } from '../../../shared/utils/paise'
import { Plus, IndianRupee, Search, Loader2 } from 'lucide-react'

export function CustomerList() {
  const { data: customers, isLoading } = useCustomers()
  const { mutateAsync: acceptPayment, isPending: isPaying } = useAcceptPayment()
  const { mutateAsync: createCustomer, isPending: isCreating } = useCreateCustomer()
  
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newCustomer, setNewCustomer] = useState({ name: '', mobile: '' })
  
  const [paymentModal, setPaymentModal] = useState<{ id: number, name: string, balance: number } | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')

  const filteredCustomers = customers?.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.mobile.includes(search)
  )

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCustomer.name || !newCustomer.mobile) return
    try {
      await createCustomer(newCustomer)
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

  if (isLoading) return <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>

  return (
    <div className="flex flex-col h-full bg-background rounded-lg border shadow-sm overflow-hidden">
      <div className="p-4 border-b flex items-center justify-between bg-card">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Customers (Khata)</h2>
          <p className="text-sm text-muted-foreground">Manage running balances and payments</p>
        </div>
        <button 
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 font-medium"
        >
          <Plus className="w-4 h-4" /> Add Customer
        </button>
      </div>

      <div className="p-4 border-b bg-card/50">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name or mobile..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border rounded-md outline-none focus:ring-2 focus:ring-primary bg-background"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/30 text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Customer Name</th>
              <th className="px-4 py-3 font-medium">Mobile</th>
              <th className="px-4 py-3 font-medium text-right">Outstanding Balance</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredCustomers?.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center py-8 text-muted-foreground">No customers found.</td>
              </tr>
            )}
            {filteredCustomers?.map(customer => (
              <tr key={customer.id} className="hover:bg-muted/10">
                <td className="px-4 py-3 font-medium">{customer.name}</td>
                <td className="px-4 py-3">{customer.mobile}</td>
                <td className="px-4 py-3 text-right">
                  <span className={`font-semibold ${customer.current_balance_paise > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatPaise(customer.current_balance_paise)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => setPaymentModal({ id: customer.id, name: customer.name, balance: customer.current_balance_paise })}
                    disabled={customer.current_balance_paise <= 0}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 hover:bg-green-200 rounded-md font-medium text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <IndianRupee className="w-3.5 h-3.5" /> Receive Payment
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Customer Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-xl shadow-lg w-full max-w-md p-6">
            <h3 className="text-lg font-bold mb-4">Add New Customer</h3>
            <form onSubmit={handleAddCustomer} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Name</label>
                <input required autoFocus type="text" value={newCustomer.name} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} className="w-full px-3 py-2 border rounded-md outline-none focus:ring-2 focus:ring-primary mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Mobile</label>
                <input required type="text" value={newCustomer.mobile} onChange={e => setNewCustomer({...newCustomer, mobile: e.target.value})} className="w-full px-3 py-2 border rounded-md outline-none focus:ring-2 focus:ring-primary mt-1" />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAdd(false)} className="flex-1 px-4 py-2 bg-muted hover:bg-muted-foreground/20 rounded-md font-medium">Cancel</button>
                <button type="submit" disabled={isCreating} className="flex-1 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md font-medium">
                  {isCreating ? 'Saving...' : 'Save Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {paymentModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-xl shadow-lg w-full max-w-sm p-6">
            <h3 className="text-lg font-bold mb-1">Receive Payment</h3>
            <p className="text-sm text-muted-foreground mb-4">From {paymentModal.name}</p>
            
            <div className="bg-red-50 text-red-700 p-3 rounded-md mb-4 flex justify-between items-center">
              <span className="text-sm font-medium">Outstanding:</span>
              <span className="font-bold">{formatPaise(paymentModal.balance)}</span>
            </div>

            <form onSubmit={handleAcceptPayment} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Amount Received (₹)</label>
                <input required autoFocus type="number" step="0.01" min="0.01" max={paymentModal.balance / 100} value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} className="w-full px-3 py-2 border rounded-md outline-none focus:ring-2 focus:ring-primary mt-1 text-lg font-semibold" />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setPaymentModal(null)} className="flex-1 px-4 py-2 bg-muted hover:bg-muted-foreground/20 rounded-md font-medium">Cancel</button>
                <button type="submit" disabled={isPaying} className="flex-1 px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-md font-medium">
                  {isPaying ? 'Processing...' : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
