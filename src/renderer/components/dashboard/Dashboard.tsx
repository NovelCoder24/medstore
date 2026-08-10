import React from 'react'
import { useAuthStore } from '../../store/auth.store'
import { ProfitMetrics } from './ProfitMetrics'
import { ExpiryAlerts } from './ExpiryAlerts'
import { LowStockAlerts } from './LowStockAlerts'
import { Bell } from 'lucide-react'

export function Dashboard() {
  const { user } = useAuthStore()

  return (
    <div className="flex flex-col gap-6 max-w-[1440px] mx-auto w-full pb-6">

      {/* 4 Summary Cards */}
      <ProfitMetrics />

      {/* Main Grid Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Expiry Alerts */}
        <div className="lg:col-span-5 h-full">
          <ExpiryAlerts />
        </div>

        {/* Right Column: Low Stock / Reorder */}
        <div className="lg:col-span-7 h-full">
          <LowStockAlerts />
        </div>
      </div>
    </div>
  )
}
