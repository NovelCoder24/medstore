import React from 'react'
import { useDashboardMetrics } from '../../hooks/useAnalytics'
import { formatPaise } from '../../../shared/utils/paise'
import { TrendingUp, Receipt, PackageX, IndianRupee, Loader2 } from 'lucide-react'

export function ProfitMetrics() {
  const { data: metrics, isLoading } = useDashboardMetrics()

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="p-6 bg-card border rounded-xl shadow-sm flex items-center justify-center h-[120px]">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ))}
      </div>
    )
  }

  if (!metrics) return null

  const cards = [
    {
      title: "Today's Sales",
      value: formatPaise(metrics.todaySalesPaise),
      icon: <IndianRupee className="w-5 h-5 text-blue-500" />,
      bg: "bg-blue-50",
      text: "text-blue-600"
    },
    {
      title: "Today's Net Profit",
      value: formatPaise(metrics.todayProfitPaise),
      icon: <TrendingUp className="w-5 h-5 text-green-500" />,
      bg: "bg-green-50",
      text: "text-green-600"
    },
    {
      title: "Total Bills Today",
      value: metrics.todayBillsCount.toString(),
      icon: <Receipt className="w-5 h-5 text-purple-500" />,
      bg: "bg-purple-50",
      text: "text-purple-600"
    },
    {
      title: "Low Stock Items",
      value: metrics.lowStockItemsCount.toString(),
      icon: <PackageX className="w-5 h-5 text-orange-500" />,
      bg: "bg-orange-50",
      text: "text-orange-600"
    }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((card, idx) => (
        <div key={idx} className="p-6 bg-card border rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${card.bg}`}>
              {card.icon}
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
              <h3 className={`text-2xl font-bold ${card.text}`}>{card.value}</h3>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
