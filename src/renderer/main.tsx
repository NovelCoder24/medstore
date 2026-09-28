import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/query-client'
import { App } from './App'
import { ErrorBoundary } from './components/layout/ErrorBoundary'
import './styles/globals.css'

// Global window-level crash protection: prevents unhandled script exceptions or unhandled
// promise rejections from causing an unrecoverable blank screen
window.addEventListener('error', (event) => {
  console.error('[Global Window Error Intercepted]:', event.error || event.message)
  // Prevent browser default error popup or crash
  event.preventDefault()
})

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Global Unhandled Rejection Intercepted]:', event.reason)
  event.preventDefault()
})

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary
      fallbackTitle="MedStore System Recovery"
      fallbackMessage="An unexpected error was caught at the application level. Your local database and records remain completely safe."
    >
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
)
