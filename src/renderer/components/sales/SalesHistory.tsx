import React, { useState } from 'react'
import { useSalesHistory, useProcessReturn } from '../../hooks/useSales'
import { useAuthStore } from '../../store/auth.store'
import { formatPaise } from '../../../shared/utils/paise'
import { Search, Loader2, RotateCcw, AlertTriangle, Printer } from 'lucide-react'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'

export function SalesHistory() {
  const { data: sales, isLoading } = useSalesHistory()
  const { mutateAsync: processReturn, isPending: isReturning } = useProcessReturn()
  const { user } = useAuthStore()
  
  const [search, setSearch] = useState('')
  const [returnModal, setReturnModal] = useState<any>(null)
  const [returnItems, setReturnItems] = useState<Record<number, number>>({}) // saleItemId -> qty
  const [returnReason, setReturnReason] = useState('')

  const filteredSales = sales?.filter(s => 
    s.bill_number.toLowerCase().includes(search.toLowerCase()) || 
    (s.customer_name && s.customer_name.toLowerCase().includes(search.toLowerCase()))
  )

  const handleReturnInitiate = (sale: any) => {
    setReturnModal(sale)
    setReturnItems({})
    setReturnReason('')
  }

  const handleReprint = async (saleId: number) => {
    try {
      const { sale, items } = await window.api.invoke(IPC_CHANNELS.SALES_GET, saleId)
      await window.api.invoke(IPC_CHANNELS.PRINT_RECEIPT, sale, items)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to reprint receipt')
    }
  }

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!returnModal || !user) return

    const itemsToReturn = Object.entries(returnItems)
      .filter(([_, qty]) => qty > 0)
      .map(([id, qty]) => ({ saleItemId: parseInt(id), quantity: qty }))

    if (itemsToReturn.length === 0) return

    try {
      await processReturn({
        saleId: returnModal.id,
        userId: user.id,
        reason: returnReason || null,
        items: itemsToReturn
      })
      setReturnModal(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Return failed')
    }
  }

  const getTotalRefundAmount = () => {
    if (!returnModal) return 0
    let total = 0
    for (const [idStr, qty] of Object.entries(returnItems)) {
      if (qty <= 0) continue
      const item = returnModal.items.find((i: any) => i.saleItemId === parseInt(idStr))
      if (item) {
        const unitPrice = Math.floor(item.total_paise / item.quantity)
        total += unitPrice * qty
      }
    }
    return total
  }

  if (isLoading) return <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>

  return (
    <div className="flex flex-col h-full bg-background rounded-lg border shadow-sm overflow-hidden">
      <div className="p-4 border-b bg-card">
        <h2 className="text-xl font-bold tracking-tight">Sales History</h2>
        <p className="text-sm text-muted-foreground">View past bills and initiate returns</p>
      </div>

      <div className="p-4 border-b bg-card/50">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by Bill No or Customer..."
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
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Bill No</th>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Mode</th>
              <th className="px-4 py-3 font-medium text-right">Total</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredSales?.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-8 text-muted-foreground">No sales found.</td>
              </tr>
            )}
            {filteredSales?.map(sale => {
              const hasReturnable = sale.items.some((i: any) => i.returnableQty > 0)
              
              return (
                <tr key={sale.id} className="hover:bg-muted/10">
                  <td className="px-4 py-3">{new Date(sale.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 font-medium">{sale.bill_number}</td>
                  <td className="px-4 py-3">{sale.customer_name || 'Walk-in'}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 bg-muted rounded-full text-xs font-semibold">{sale.payment_mode}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{formatPaise(sale.total_paise)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleReprint(sale.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md font-medium text-xs transition-colors"
                      >
                        <Printer className="w-3.5 h-3.5" /> Reprint
                      </button>
                      <button
                        onClick={() => handleReturnInitiate(sale)}
                        disabled={!hasReturnable}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-700 hover:bg-orange-100 rounded-md font-medium text-xs transition-colors disabled:opacity-50"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Return
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Return Modal */}
      {returnModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-xl shadow-lg w-full max-w-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b">
              <h3 className="text-lg font-bold">Initiate Return: {returnModal.bill_number}</h3>
              <p className="text-sm text-muted-foreground">Original Payment: {returnModal.payment_mode}</p>
              {returnModal.payment_mode === 'CREDIT' && (
                <div className="mt-2 p-2 bg-yellow-50 text-yellow-800 text-sm rounded border border-yellow-200 flex gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Refund for CREDIT bills will automatically adjust the customer's Khata balance. Do not give cash.</span>
                </div>
              )}
            </div>
            
            <div className="p-6 flex-1 overflow-auto">
              <table className="w-full text-sm text-left mb-4">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="px-3 py-2 font-medium">Item</th>
                    <th className="px-3 py-2 font-medium text-center">Batch</th>
                    <th className="px-3 py-2 font-medium text-right">Sold</th>
                    <th className="px-3 py-2 font-medium text-right">Avail to Return</th>
                    <th className="px-3 py-2 font-medium text-right w-32">Return Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {returnModal.items.map((item: any) => (
                    <tr key={item.saleItemId}>
                      <td className="px-3 py-2">{item.brand_name}</td>
                      <td className="px-3 py-2 text-center text-xs">{item.batch_number}</td>
                      <td className="px-3 py-2 text-right">{item.quantity}</td>
                      <td className="px-3 py-2 text-right font-medium text-primary">{item.returnableQty}</td>
                      <td className="px-3 py-2 text-right">
                        <input 
                          type="number" 
                          min="0" 
                          max={item.returnableQty}
                          disabled={item.returnableQty === 0}
                          value={returnItems[item.saleItemId] || ''}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0
                            setReturnItems(prev => ({
                              ...prev,
                              [item.saleItemId]: Math.min(val, item.returnableQty)
                            }))
                          }}
                          className="w-20 px-2 py-1 border rounded text-right outline-none focus:border-primary disabled:opacity-50" 
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Reason for Return (Optional)</label>
                <input 
                  type="text" 
                  value={returnReason} 
                  onChange={e => setReturnReason(e.target.value)} 
                  className="w-full px-3 py-2 border rounded-md outline-none focus:ring-2 focus:ring-primary" 
                />
              </div>
            </div>

            <div className="p-6 border-t bg-muted/20 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Refund Value:</p>
                <p className="text-xl font-bold text-red-600">{formatPaise(getTotalRefundAmount())}</p>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setReturnModal(null)} className="px-4 py-2 bg-muted hover:bg-muted-foreground/20 rounded-md font-medium">Cancel</button>
                <button 
                  onClick={handleReturnSubmit} 
                  disabled={isReturning || getTotalRefundAmount() === 0} 
                  className="px-6 py-2 bg-orange-600 text-white hover:bg-orange-700 rounded-md font-medium disabled:opacity-50 flex flex-center gap-2"
                >
                  {isReturning && <Loader2 className="w-4 h-4 animate-spin" />}
                  Confirm Return
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
