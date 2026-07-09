import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import type { Vendor } from '../../main/services/vendor.service'

export function useVendors() {
  return useQuery({
    queryKey: ['vendors'],
    queryFn: async () => {
      return await window.api.invoke(IPC_CHANNELS.VENDORS_LIST) as Vendor[]
    }
  })
}

export function useVendor(id: number) {
  return useQuery({
    queryKey: ['vendor', id],
    queryFn: async () => {
      return await window.api.invoke(IPC_CHANNELS.VENDORS_GET, id) as Vendor
    },
    enabled: !!id
  })
}

export function useCreateVendor() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: any) => {
      return await window.api.invoke(IPC_CHANNELS.VENDORS_CREATE, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] })
    }
  })
}

export function useUpdateVendor() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: number, data: any }) => {
      return await window.api.invoke(IPC_CHANNELS.VENDORS_UPDATE, { id, data })
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] })
      queryClient.invalidateQueries({ queryKey: ['vendor', variables.id] })
    }
  })
}
