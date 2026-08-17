import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

// Self-hosted Inter, imported before the stylesheet so the @font-face rules are
// registered by the time any component paints. Self-hosted rather than a Google
// Fonts <link>: no third-party request on first paint, it keeps working offline,
// and the variable file covers every weight the UI uses in a single download.
import '@fontsource-variable/inter'

import App from './App.jsx'
import AuthProvider from './auth/AuthProvider'
import ConfirmProvider from './components/ConfirmDialog'
import ToastProvider from './components/Toaster'
import './index.css'
import { persistOptions, queryClient } from './lib/queryClient'
import RealtimeProvider from './realtime/RealtimeProvider'

/**
 * Provider order matters:
 *  - the router is outermost, since navigation is used inside auth and shell code;
 *  - the query cache wraps auth, because signing out clears it;
 *  - toasts wrap realtime, which reports connection problems through them;
 *  - confirmations sit inside toasts, since a confirmed action usually reports its
 *    result as a toast, and outside auth so sign-out can prompt too;
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
          <ConfirmProvider>
            <AuthProvider>
              <RealtimeProvider>
                <App />
              </RealtimeProvider>
            </AuthProvider>
          </ConfirmProvider>
        </ToastProvider>
      </PersistQueryClientProvider>
    </BrowserRouter>
  </StrictMode>,
)
