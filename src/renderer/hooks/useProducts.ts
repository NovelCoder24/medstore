import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import type { Product } from '../../main/services/product.service'

export function useProducts(searchParams: { query?: string, categoryId?: string, page?: number, pageSize?: number }) {
  return useQuery({
    queryKey: ['products', searchParams],
    queryFn: async () => {
      return await window.api.invoke(IPC_CHANNELS.PRODUCTS_SEARCH, searchParams)
    }
  })
}

export function useProduct(id: number) {
  return useQuery({
    queryKey: ['product', id],
    queryFn: async () => {
      return await window.api.invoke(IPC_CHANNELS.PRODUCTS_GET, id) as Product
    },
    enabled: !!id
  })
}

export function useCreateProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: any) => {
      return await window.api.invoke(IPC_CHANNELS.PRODUCTS_CREATE, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
    }
  })
}

export function useUpdateProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: number, data: any }) => {
      return await window.api.invoke(IPC_CHANNELS.PRODUCTS_UPDATE, { id, data })
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['product', variables.id] })
    }
  })
}
