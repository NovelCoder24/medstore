import { useQuery } from '@tanstack/react-query'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import type { PurchaseInvoiceListItem, PurchaseInvoiceDetails } from '../../main/services/purchase.service'

export interface PurchaseInvoiceFilters {
  vendorId?: number
  source?: 'MANUAL' | 'OCR'
  startDate?: string
  endDate?: string
  search?: string
}

export function usePurchaseInvoices(filters?: PurchaseInvoiceFilters) {
  return useQuery({
    queryKey: ['purchaseInvoices', filters],
    queryFn: async () => {
      return (await window.api.invoke(IPC_CHANNELS.PURCHASES_LIST, filters)) as PurchaseInvoiceListItem[]
    },
    staleTime: 0,
    refetchOnMount: 'always'
  })
}

export function usePurchaseInvoiceDetails(invoiceId: number | null) {
  return useQuery({
    queryKey: ['purchaseInvoiceDetails', invoiceId],
    queryFn: async () => {
      if (!invoiceId) return null
      return (await window.api.invoke(IPC_CHANNELS.PURCHASES_GET, invoiceId)) as PurchaseInvoiceDetails
    },
    enabled: !!invoiceId
  })
}
