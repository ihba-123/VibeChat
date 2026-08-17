import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import App from './App.jsx'
import AuthProvider from './auth/AuthProvider'
import ToastProvider from './components/Toaster'
import './index.css'
import { persistOptions, queryClient } from './lib/queryClient'
import RealtimeProvider from './realtime/RealtimeProvider'

/**
 * Provider order matters:
 *  - the router is outermost, since navigation is used inside auth and shell code;
 *  - the query cache wraps auth, because signing out clears it;
 *  - toasts wrap realtime, which reports connection problems through them;
 *  - realtime is innermost, as it needs the session and the cache to exist.
 *
 * BrowserRouter (not HashRouter): the Google sign-in flow redirects back to a real
 * path, which a hash router never sees.
 */
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
        <ToastProvider>
          <AuthProvider>
            <RealtimeProvider>
              <App />
            </RealtimeProvider>
          </AuthProvider>
        </ToastProvider>
      </PersistQueryClientProvider>
    </BrowserRouter>
  </StrictMode>,
)
