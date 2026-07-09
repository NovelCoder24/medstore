import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { IPC_CHANNELS } from '../../shared/ipc-channels'

export interface User {
  id: number
  display_name: string
  role: 'OWNER' | 'CASHIER'
  is_active: number
  created_at: string
}

export function useStaff() {
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery<User[]>({
    queryKey: ['staff'],
    queryFn: async () => {
      const result = await window.api.invoke(IPC_CHANNELS.USERS_LIST)
      return result
    }
  })

  const deactivateMutation = useMutation({
    mutationFn: async (id: number) => {
      await window.api.invoke(IPC_CHANNELS.USERS_DEACTIVATE, id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
    }
  })

  return {
    staff: data || [],
    isLoading,
    error,
    deactivateStaff: deactivateMutation.mutate,
    isDeactivating: deactivateMutation.isPending
  }
}
