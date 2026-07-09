import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import type { Customer, CustomerLedgerEntry } from '../../main/services/customer.service'

export function useCustomers() {
  return useQuery({
    queryKey: ['customers'],
    queryFn: async () => window.api.invoke(IPC_CHANNELS.CUSTOMERS_LIST) as Promise<Customer[]>
  })
}

export function useCustomer(id: number) {
  return useQuery({
    queryKey: ['customers', id],
    queryFn: async () => window.api.invoke(IPC_CHANNELS.CUSTOMERS_GET, id) as Promise<Customer>,
    enabled: !!id
  })
}

export function useCustomerSearch(searchQuery: string) {
  return useQuery({
    queryKey: ['customers', 'search', searchQuery],
    queryFn: async () => window.api.invoke(IPC_CHANNELS.CUSTOMERS_SEARCH, searchQuery) as Promise<Customer[]>,
    enabled: searchQuery.length > 1
  })
}

export function useCustomerLedger(id: number) {
  return useQuery({
    queryKey: ['customers', id, 'ledger'],
    queryFn: async () => window.api.invoke(IPC_CHANNELS.CUSTOMERS_LEDGER, id) as Promise<CustomerLedgerEntry[]>,
    enabled: !!id
  })
}

export function useCreateCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: { name: string, mobile: string, address?: string, max_credit_limit_paise?: number }) => 
      window.api.invoke(IPC_CHANNELS.CUSTOMERS_CREATE, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    }
  })
}

export function useAcceptPayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: { customerId: number, amountPaise: number, referenceId?: string }) => 
      window.api.invoke(IPC_CHANNELS.CUSTOMERS_ACCEPT_PAYMENT, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['customers', variables.customerId] })
    }
  })
}
