import React from 'react'
import { useExpiryAlerts } from '../../hooks/useAnalytics'
import { CalendarX, Loader2, CheckCircle2 } from 'lucide-react'

export function ExpiryAlerts() {
  const { data: alerts, isLoading, error } = useExpiryAlerts()

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-xl shadow-sm flex flex-col h-full overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between">
          <h3 className="font-semibold text-base flex items-center gap-2 text-foreground">
            <CalendarX className="w-5 h-5 text-red-500" />
            Expiry Alerts
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
        Failed to load expiry alerts.
      </div>
    )
  }

  if (!alerts || alerts.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl shadow-sm flex flex-col h-full overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/30">
          <h3 className="font-semibold text-base flex items-center gap-2 text-foreground">
            <CalendarX className="w-5 h-5 text-red-500" />
            Expiry Alerts
          </h3>
        </div>
        <div className="p-8 text-center flex-1 flex flex-col items-center justify-center">
          <div className="w-12 h-12 bg-emerald-500/10 text-emerald-600 rounded-full flex items-center justify-center mb-3">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h4 className="font-bold text-sm text-foreground">All Clear!</h4>
          <p className="text-muted-foreground text-xs mt-1">No medicine batches expiring in the next 6 months.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-xl shadow-sm flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between">
        <h3 className="font-semibold text-base flex items-center gap-2 text-foreground">
          <CalendarX className="w-5 h-5 text-red-500" />
          Expiry Alerts
        </h3>
        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-600 border border-red-500/20">
          {alerts.length} Items
        </span>
      </div>

      {/* Alert Items List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[500px]">
        {alerts.map((item) => {
          const isCritical = item.daysUntilExpiry <= 30
          const isWarning = item.daysUntilExpiry > 30 && item.daysUntilExpiry <= 90

          const severityClass = isCritical
            ? 'border-red-500/30 bg-red-500/5'
            : isWarning
              ? 'border-amber-500/30 bg-amber-500/5'
              : 'border-blue-500/30 bg-blue-500/5'

          const badgeClass = isCritical
            ? 'bg-red-500/15 text-red-700 dark:text-red-300'
            : isWarning
              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
              : 'bg-blue-500/15 text-blue-700 dark:text-blue-300'

          const badgeText = isCritical ? 'CRITICAL' : isWarning ? 'WARNING' : 'NOTICE'

          const formattedExpDate = item.expiryDate
            ? `${item.expiryDate.slice(5, 7)}/${item.expiryDate.slice(0, 4)}`
            : 'N/A'

          return (
            <div
              key={item.batchId}
              className={`p-3 border rounded-lg transition-all flex flex-col gap-1.5 ${severityClass}`}
            >
              <div className="flex justify-between items-start gap-2">
                <h4 className="font-bold text-xs text-foreground tracking-tight line-clamp-1">
                  {item.brandName}
                </h4>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${badgeClass}`}>
                  {badgeText}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-x-2 text-xs text-muted-foreground mt-0.5">
                <div>
                  <span className="font-medium text-muted-foreground/70">Batch:</span>{' '}
                  <span className="font-mono font-semibold text-foreground">{item.batchNumber}</span>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground/70">Qty:</span>{' '}
                  <span className="font-bold text-foreground">{item.quantity} units</span>
                </div>
                <div className="col-span-2 mt-1">
                  <span className="font-medium text-muted-foreground/70">Exp:</span>{' '}
                  <span className={`font-bold ${isCritical ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-blue-600'}`}>
                    {formattedExpDate} ({item.daysUntilExpiry <= 0 ? 'EXPIRED' : `${item.daysUntilExpiry} days left`})
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
