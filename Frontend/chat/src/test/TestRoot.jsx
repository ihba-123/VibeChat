/**
 * The real provider tree, wired for tests.
 *
 * Mirrors main.jsx exactly apart from using a fresh QueryClient with retries off
 * (so a deliberate failure does not stall a test) and no localStorage persistence.
 */

import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { BrowserRouter } from 'react-router-dom'

import App from '../App'
import AuthProvider from '../auth/AuthProvider'
import ToastProvider from '../components/Toaster'
import RealtimeProvider from '../realtime/RealtimeProvider'

export default function TestRoot() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
      mutations: { retry: false },
    },
  })

  // StrictMode on purpose, matching main.jsx. Its double-invoked effects are what
  // expose a bootstrap that cancels itself — without it, a provider can hang in
  // the real app while every test still passes.
  return (
    <StrictMode>
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <AuthProvider>
              <RealtimeProvider>
                <App />
              </RealtimeProvider>
            </AuthProvider>
          </ToastProvider>
        </QueryClientProvider>
      </BrowserRouter>
    </StrictMode>
  )
}
