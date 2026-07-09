import { useQuery } from '@tanstack/react-query'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import type { ExpiryAlert, DashboardMetrics, LowStockAlert } from '../../main/services/analytics.service'

export function useExpiryAlerts() {
  return useQuery({
    queryKey: ['analytics', 'expiry-alerts'],
    queryFn: async () => {
      return await window.api.invoke(IPC_CHANNELS.EXPIRY_DASHBOARD) as ExpiryAlert[]
    },
    // Alert data changes slowly, fetch every 5 mins is fine
    staleTime: 5 * 60 * 1000
  })
}

export function useDashboardMetrics() {
  return useQuery({
    queryKey: ['analytics', 'dashboard-metrics'],
    queryFn: async () => {
      return await window.api.invoke(IPC_CHANNELS.REPORTS_DAILY_SUMMARY) as DashboardMetrics
    },
    // Metrics should update relatively often
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000 // auto refresh every minute
  })
}

export function useLowStockAlerts() {
  return useQuery({
    queryKey: ['analytics', 'low-stock-alerts'],
    queryFn: async () => {
      return await window.api.invoke(IPC_CHANNELS.REPORTS_LOW_STOCK) as LowStockAlert[]
    },
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000
  })
}
