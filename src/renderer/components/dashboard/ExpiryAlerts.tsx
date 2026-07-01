import React from 'react'
import { useExpiryAlerts } from '../../hooks/useAnalytics'
import { AlertTriangle, Loader2, CheckCircle2 } from 'lucide-react'

export function ExpiryAlerts() {
  const { data: alerts, isLoading, error } = useExpiryAlerts()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground border rounded-lg bg-card shadow-sm">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  if (error) {
    return <div className="p-4 text-red-500 bg-red-50 rounded-lg">Failed to load expiry alerts</div>
  }

  if (!alerts || alerts.length === 0) {
    return (
      <div className="p-8 text-center bg-card border rounded-lg shadow-sm">
        <div className="mx-auto w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-3">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-medium">All Clear!</h3>
        <p className="text-muted-foreground text-sm">No batches are expiring in the next 6 months.</p>
      </div>
    )
  }

  // Group alerts by severity
  const redAlerts = alerts.filter(a => a.daysUntilExpiry <= 30) // Expiring this month
  const yellowAlerts = alerts.filter(a => a.daysUntilExpiry > 30 && a.daysUntilExpiry <= 90) // Next 3 months
  const upcomingAlerts = alerts.filter(a => a.daysUntilExpiry > 90) // 3-6 months

  const renderTable = (items: typeof alerts, type: 'red' | 'yellow' | 'upcoming') => {
    if (items.length === 0) return null

    const colors = {
      red: 'bg-red-50 border-red-200 text-red-700',
      yellow: 'bg-orange-50 border-orange-200 text-orange-800',
      upcoming: 'bg-blue-50 border-blue-200 text-blue-800'
    }

    const title = {
      red: 'Critical - Expiring in < 30 Days',
      yellow: 'Warning - Expiring in 1-3 Months',
      upcoming: 'Notice - Expiring in 3-6 Months'
    }

    return (
      <div className={`border rounded-lg mb-6 overflow-hidden ${colors[type]}`}>
        <div className="px-4 py-2 font-semibold border-b bg-white/50 backdrop-blur-sm">
          {title[type]} ({items.length})
        </div>
        <table className="w-full text-sm text-left bg-white">
          <thead className="bg-muted/30 text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Product</th>
              <th className="px-4 py-2 font-medium">Batch</th>
              <th className="px-4 py-2 font-medium text-center">Exp</th>
              <th className="px-4 py-2 font-medium text-right">Qty Left</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map(item => (
              <tr key={item.batchId} className="hover:bg-muted/10">
                <td className="px-4 py-2 font-medium">{item.brandName}</td>
                <td className="px-4 py-2">{item.batchNumber}</td>
                <td className="px-4 py-2 text-center font-medium">
                  {item.expiryMonth.toString().padStart(2, '0')}/{item.expiryYear}
                </td>
                <td className="px-4 py-2 text-right">{item.quantity} units</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="bg-card border rounded-lg shadow-sm">
      <div className="p-4 border-b flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-red-500" />
        <h3 className="font-semibold text-lg">Expiry Dashboard</h3>
      </div>
      <div className="p-4 overflow-auto max-h-[600px]">
        {renderTable(redAlerts, 'red')}
        {renderTable(yellowAlerts, 'yellow')}
        {renderTable(upcomingAlerts, 'upcoming')}
      </div>
    </div>
  )
}
