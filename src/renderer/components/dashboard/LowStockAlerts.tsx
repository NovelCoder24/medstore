import React from 'react'
import { useLowStockAlerts } from '../../hooks/useAnalytics'
import { AlertCircle, Loader2, CheckCircle2 } from 'lucide-react'

export function LowStockAlerts() {
  const { data: alerts, isLoading, error } = useLowStockAlerts()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground border rounded-lg bg-card shadow-sm h-full">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  if (error) {
    return <div className="p-4 text-red-500 bg-red-50 rounded-lg">Failed to load low stock alerts</div>
  }

  if (!alerts || alerts.length === 0) {
    return (
      <div className="p-8 text-center bg-card border rounded-lg shadow-sm h-full flex flex-col justify-center">
        <div className="mx-auto w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-3">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-medium">All Clear!</h3>
        <p className="text-muted-foreground text-sm">No items are currently low on stock.</p>
      </div>
    )
  }

  return (
    <div className="bg-card border rounded-lg shadow-sm h-full flex flex-col">
      <div className="p-4 border-b flex items-center gap-2 bg-red-50/50">
        <AlertCircle className="w-5 h-5 text-red-500" />
        <h3 className="font-semibold text-lg text-red-900">Action Required: Low Stock / Reorder</h3>
      </div>
      <div className="p-0 overflow-auto flex-1">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/30 text-muted-foreground sticky top-0 backdrop-blur-sm bg-white/90">
            <tr>
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium text-center">Rack</th>
              <th className="px-4 py-3 font-medium text-right">Qty Left</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {alerts.map(item => (
              <tr key={item.productId} className="hover:bg-muted/10">
                <td className="px-4 py-3 font-medium">{item.brandName}</td>
                <td className="px-4 py-3 text-center">{item.shelfRack || '-'}</td>
                <td className="px-4 py-3 text-right">
                  <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                    {item.totalQuantity} units
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
