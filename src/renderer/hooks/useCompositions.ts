import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import type { Composition } from '../../main/services/composition.service'

export function useCompositions() {
  return useQuery({
    queryKey: ['compositions'],
    queryFn: async () => {
      return await window.api.invoke(IPC_CHANNELS.COMPOSITIONS_LIST) as Composition[]
    }
  })
}

export function useCreateComposition() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: any) => {
      return await window.api.invoke(IPC_CHANNELS.COMPOSITIONS_CREATE, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compositions'] })
    }
  })
}

export function useUpdateComposition() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: number, data: any }) => {
      return await window.api.invoke(IPC_CHANNELS.COMPOSITIONS_UPDATE, { id, data })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compositions'] })
    }
  })
}
