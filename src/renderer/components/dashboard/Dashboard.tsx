import React from 'react'
import { useAuthStore } from '../../store/auth.store'
import { ProfitMetrics } from './ProfitMetrics'
import { ExpiryAlerts } from './ExpiryAlerts'
import { LowStockAlerts } from './LowStockAlerts'
import { LayoutDashboard } from 'lucide-react'

export function Dashboard() {
  const { user } = useAuthStore()

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="flex items-center gap-2">
        <LayoutDashboard className="w-6 h-6 text-primary" />
        <h2 className="text-2xl font-bold tracking-tight">
          Welcome back, {user?.name || 'Pharmacist'}
        </h2>
      </div>

      {user?.role === 'OWNER' && (
        <ProfitMetrics />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
        <div className="flex flex-col h-full">
          <ExpiryAlerts />
        </div>
        
        {/* Low Stock Action List */}
        <div className="flex flex-col h-full min-h-[300px]">
          <LowStockAlerts />
        </div>
      </div>
    </div>
  )
}
