import React from 'react'
import { useAuthStore } from '../../store/auth.store'
import { ProfitMetrics } from './ProfitMetrics'
import { ExpiryAlerts } from './ExpiryAlerts'
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
        
        {/* Placeholder for future features (e.g., Sales Chart, Fast Moving Items) */}
        <div className="hidden lg:flex flex-col h-full">
          <div className="bg-card border rounded-lg shadow-sm p-8 flex flex-col items-center justify-center text-center text-muted-foreground h-[300px]">
            <h3 className="font-medium text-lg mb-2">More Analytics Coming Soon</h3>
            <p className="text-sm max-w-sm">We'll be adding top-selling products, sales trends, and vendor insights here in future updates.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
