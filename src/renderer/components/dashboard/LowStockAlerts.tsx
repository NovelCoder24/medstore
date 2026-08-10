import React from 'react'
import { useLowStockAlerts } from '../../hooks/useAnalytics'
import { ShoppingCart, Loader2, CheckCircle2 } from 'lucide-react'

export function LowStockAlerts() {
  const { data: alerts, isLoading, error } = useLowStockAlerts()

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-xl shadow-sm flex flex-col h-full overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between">
          <h3 className="font-semibold text-base flex items-center gap-2 text-foreground">
            <ShoppingCart className="w-5 h-5 text-primary" />
            Low Stock / Reorder
          </h3>
        </div>
        <div className="flex-1 flex items-center justify-center p-8 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-xs font-semibold text-red-500 bg-red-500/10 rounded-xl border border-red-500/20">
        Failed to load low stock alerts.
      </div>
    )
  }

  if (!alerts || alerts.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl shadow-sm flex flex-col h-full overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/30">
          <h3 className="font-semibold text-base flex items-center gap-2 text-foreground">
            <ShoppingCart className="w-5 h-5 text-primary" />
            Low Stock / Reorder
          </h3>
        </div>
        <div className="p-8 text-center flex-1 flex flex-col items-center justify-center">
          <div className="w-12 h-12 bg-emerald-500/10 text-emerald-600 rounded-full flex items-center justify-center mb-3">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h4 className="font-bold text-sm text-foreground">All Clear!</h4>
          <p className="text-muted-foreground text-xs mt-1">No products are currently low on stock.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-xl shadow-sm flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between">
        <h3 className="font-semibold text-base flex items-center gap-2 text-foreground">
          <ShoppingCart className="w-5 h-5 text-primary" />
          Low Stock / Reorder
        </h3>
        <span className="text-xs font-medium text-primary hover:underline cursor-pointer">
          {alerts.length} Items
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto flex-1 max-h-[500px]">
        <table className="w-full text-xs text-left border-collapse">
          <thead className="bg-muted/50 border-b border-border font-bold text-foreground sticky top-0 backdrop-blur-sm">
            <tr>
              <th className="p-3.5 font-bold">Product Name</th>
              <th className="p-3.5 font-bold text-center">Rack</th>
              <th className="p-3.5 font-bold text-right">Qty Left</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-background">
            {alerts.map((item) => {
              const isUrgent = item.totalQuantity <= 5
              return (
                <tr key={item.productId} className="hover:bg-muted/20 transition-colors">
                  <td className="p-3.5 font-bold text-foreground tracking-tight">
                    {item.brandName}
                  </td>
                  <td className="p-3.5 text-center font-mono font-medium text-muted-foreground">
                    {item.shelfRack || '-'}
                  </td>
                  <td className="p-3.5 text-right">
                    <span className={`inline-flex items-center gap-1.5 font-bold ${isUrgent ? 'text-red-600' : 'text-amber-600'}`}>
                      <span className={`w-2 h-2 rounded-full ${isUrgent ? 'bg-red-500 animate-pulse' : 'bg-amber-500'}`}></span>
                      {item.totalQuantity} units
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
