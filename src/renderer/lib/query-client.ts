import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      console.warn('[Query Error Handled Gracefully]', query.queryKey, error)
    }
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      console.warn('[Mutation Error Handled Gracefully]', error)
    }
  }),
  defaultOptions: {
    queries: {
      // In this offline-first local app, data won't change unless we change it.
      // 5 minute stale time is perfectly fine, since we invalidate queries on mutation.
      staleTime: 5 * 60 * 1000,
      retry: false, // local IPC shouldn't randomly fail
      refetchOnWindowFocus: false, // Disabled: avoid thundering herd of synchronous IPC->SQLite calls on focus
      throwOnError: false, // CRITICAL: Never throw query errors into React component render phase (prevents blank screen)
    },
    mutations: {
      throwOnError: false, // CRITICAL: Never crash React on unhandled mutation errors
    }
  },
})
