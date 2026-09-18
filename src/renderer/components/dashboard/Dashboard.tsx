import React from 'react'
import { useAuthStore } from '../../store/auth.store'
import { ProfitMetrics } from './ProfitMetrics'
import { ExpiryAlerts } from './ExpiryAlerts'
import { LowStockAlerts } from './LowStockAlerts'

interface DashboardProps {
  onNavigate?: (tab: string) => void
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const { user } = useAuthStore()

  return (
    <div className="flex flex-col gap-6 max-w-[1440px] mx-auto w-full pb-6">
      {/* 4 Summary Cards with Privacy Mode & Shortcuts */}
      <ProfitMetrics onNavigate={onNavigate} />

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
