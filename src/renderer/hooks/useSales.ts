import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import type { SalePayload } from '../../main/services/sales.service' // just for types

export interface SalesHistoryFilters {
  startDate?: string
  endDate?: string
  start?: string
  end?: string
  search?: string
}

export function useSalesHistory(filters?: SalesHistoryFilters) {
  return useQuery({
    queryKey: ['sales', 'history', filters],
    queryFn: async () => window.api.invoke(IPC_CHANNELS.SALES_LIST, filters) as Promise<any[]>
  })
}

export function useProcessReturn() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: { saleId: number, userId: number, reason: string | null, items: { saleItemId: number, quantity: number }[] }) => 
      window.api.invoke(IPC_CHANNELS.SALES_RETURN, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] })
      queryClient.invalidateQueries({ queryKey: ['batches'] })
    }
  })
}
