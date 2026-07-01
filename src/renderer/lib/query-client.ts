import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // In this offline-first local app, data won't change unless we change it.
      // 5 minute stale time is perfectly fine, since we invalidate queries on mutation.
      staleTime: 5 * 60 * 1000,
      retry: false, // local IPC shouldn't randomly fail
      refetchOnWindowFocus: true, // Keep it true in case multiple windows are open later
    },
  },
})
