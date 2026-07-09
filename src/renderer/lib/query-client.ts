import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // In this offline-first local app, data won't change unless we change it.
      // 5 minute stale time is perfectly fine, since we invalidate queries on mutation.
      staleTime: 5 * 60 * 1000,
      retry: false, // local IPC shouldn't randomly fail
      refetchOnWindowFocus: false, // Disabled: this is a single-user local app. Refetching on focus causes a thundering herd of synchronous IPC->SQLite calls that blocks the main thread (especially after laptop lid open/close).
    },
  },
})
