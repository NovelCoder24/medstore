import React, { useState } from 'react'
import { useDashboardMetrics } from '../../hooks/useAnalytics'
import { formatPaise } from '../../../shared/utils/paise'
import { 
  TrendingUp, 
  Receipt, 
  PackageX, 
  IndianRupee, 
  Loader2, 
  PiggyBank, 
  AlertTriangle, 
  Eye, 
  EyeOff, 
  ArrowUpRight 
} from 'lucide-react'

interface ProfitMetricsProps {
  onNavigate?: (tab: string) => void
}

export function ProfitMetrics({ onNavigate }: ProfitMetricsProps) {
  const { data: metrics, isLoading } = useDashboardMetrics()
  const [isPrivacyMode, setIsPrivacyMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('medstore_counter_privacy') === 'true'
    } catch {
      return false
    }
  })

  const togglePrivacyMode = () => {
    setIsPrivacyMode(prev => {
      const next = !prev
      try {
        localStorage.setItem('medstore_counter_privacy', String(next))
      } catch {
        // ignore
      }
      return next
    })
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="p-5 bg-card border rounded-xl shadow-xs flex items-center justify-center h-[130px]">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ))}
      </div>
    )
  }

  if (!metrics) return null

  return (
    <div className="space-y-3">
      {/* Privacy Mode Control Bar */}
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold text-slate-700">Financial &amp; Stock Snapshot</h3>
        <button
          type="button"
          onClick={togglePrivacyMode}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition cursor-pointer ${
            isPrivacyMode 
              ? 'bg-slate-900 text-white border-slate-900 shadow-xs' 
              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
          }`}
          title={isPrivacyMode ? 'Disable Counter Privacy (Show numbers)' : 'Enable Counter Privacy (Mask numbers from customers)'}
        >
          {isPrivacyMode ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          <span>{isPrivacyMode ? 'Privacy Mode Active' : 'Counter Privacy Mode'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Today's Sales */}
        <div className="bg-card border border-border/80 rounded-xl p-5 shadow-xs flex flex-col justify-between transition hover:border-slate-300">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Today's Sales</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-foreground block tracking-tight">
              {isPrivacyMode ? '₹ ••••••' : formatPaise(metrics.todaySalesPaise)}
            </span>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs">
            <span className="text-emerald-600 font-medium flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Gross revenue</span>
            </span>
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('Sales History')}
                className="text-primary hover:underline font-semibold flex items-center gap-0.5 cursor-pointer"
              >
                <span>Sales</span>
                <ArrowUpRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Card 2: Today's Net Profit */}
        <div className="bg-card border border-border/80 rounded-xl p-5 shadow-xs flex flex-col justify-between transition hover:border-slate-300">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Today's Net Profit</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100">
              <PiggyBank className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-foreground block tracking-tight">
              {isPrivacyMode ? '₹ ••••••' : formatPaise(metrics.todayProfitPaise)}
            </span>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs">
            <span className="text-emerald-600 font-medium flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Net profit margin</span>
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">
              {isPrivacyMode ? 'MASKED' : 'LIVE'}
            </span>
          </div>
        </div>

        {/* Card 3: Total Bills Today */}
        <div className="bg-card border border-border/80 rounded-xl p-5 shadow-xs flex flex-col justify-between transition hover:border-slate-300">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Bills Today</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600 border border-purple-100">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-foreground block tracking-tight">
              {metrics.todayBillsCount}
            </span>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs">
            <span className="text-muted-foreground">Transactions completed</span>
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('Sales History')}
                className="text-primary hover:underline font-semibold flex items-center gap-0.5 cursor-pointer"
              >
                <span>Bills</span>
                <ArrowUpRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Card 4: Low Stock Items */}
        <div className="bg-rose-50/40 border border-rose-200/80 rounded-xl p-5 shadow-xs flex flex-col justify-between transition hover:border-rose-300">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-rose-700 uppercase tracking-wider">Low Stock Items</span>
            <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center text-rose-700 border border-rose-200">
              <PackageX className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-rose-900 block tracking-tight">
              {metrics.lowStockItemsCount}
            </span>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-rose-200/60 text-xs">
            <span className="text-rose-700 font-semibold flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Below reorder</span>
            </span>
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('Purchases')}
                className="text-rose-800 hover:text-rose-950 font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
                title="Open Purchases to inward fresh inventory"
              >
                <span>Reorder</span>
                <ArrowUpRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
