import React from 'react'
import { useDashboardMetrics } from '../../hooks/useAnalytics'
import { formatPaise } from '../../../shared/utils/paise'
import { TrendingUp, Receipt, PackageX, IndianRupee, Loader2, PiggyBank, AlertTriangle } from 'lucide-react'

export function ProfitMetrics() {
  const { data: metrics, isLoading } = useDashboardMetrics()

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="p-5 bg-card border rounded-xl shadow-sm flex items-center justify-center h-[130px]">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ))}
      </div>
    )
  }

  if (!metrics) return null

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
      {/* Card 1: Today's Sales */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex flex-col gap-3 relative overflow-hidden transition-all hover:shadow-md">
        <div className="flex justify-between items-start">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Today's Sales</span>
          <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600">
            <IndianRupee className="w-4 h-4" />
          </div>
        </div>
        <div>
          <span className="text-3xl font-extrabold text-foreground block tracking-tight">
            {formatPaise(metrics.todaySalesPaise)}
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs font-semibold text-emerald-600 mt-auto pt-1">
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Real-time store revenue</span>
        </div>
      </div>

      {/* Card 2: Today's Net Profit */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex flex-col gap-3 relative overflow-hidden transition-all hover:shadow-md">
        <div className="flex justify-between items-start">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Today's Net Profit</span>
          <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600">
            <PiggyBank className="w-4 h-4" />
          </div>
        </div>
        <div>
          <span className="text-3xl font-extrabold text-foreground block tracking-tight">
            {formatPaise(metrics.todayProfitPaise)}
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs font-semibold text-emerald-600 mt-auto pt-1">
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Net profit margin</span>
        </div>
      </div>

      {/* Card 3: Total Bills Today */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex flex-col gap-3 relative overflow-hidden transition-all hover:shadow-md">
        <div className="flex justify-between items-start">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Bills Today</span>
          <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-600">
            <Receipt className="w-4 h-4" />
          </div>
        </div>
        <div>
          <span className="text-3xl font-extrabold text-foreground block tracking-tight">
            {metrics.todayBillsCount}
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground mt-auto pt-1">
          <span>Transactions completed</span>
        </div>
      </div>

      {/* Card 4: Low Stock Items */}
      <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-5 shadow-sm flex flex-col gap-3 relative overflow-hidden transition-all hover:shadow-md">
        <div className="flex justify-between items-start">
          <span className="text-xs font-bold text-red-600 uppercase tracking-wider">Low Stock Items</span>
          <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center text-red-600">
            <PackageX className="w-4 h-4" />
          </div>
        </div>
        <div>
          <span className="text-3xl font-extrabold text-foreground block tracking-tight">
            {metrics.lowStockItemsCount}
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs font-bold text-red-600 mt-auto pt-1">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Requires attention</span>
        </div>
      </div>
    </div>
  )
}
