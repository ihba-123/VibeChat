/**
 * Route guards — the closest thing a client-side router has to middleware.
 *
 * Every route in App.jsx sits inside exactly one of these, so "is this URL allowed
 * for the current session?" is answered in one file rather than by each screen
 * remembering to check. The important consequence: adding a route without a guard
 * is visible in App.jsx, instead of quietly shipping an unprotected page.
 */

import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { hadSession } from '../api/client'
import FullScreenLoader from '../components/FullScreenLoader'
import { useScopedTheme } from '../hooks/ui'
import { useAuth } from './AuthProvider'

/**
 * The signed-in area, with the theme applied for exactly as long as it is mounted.
 *
 * Mounting is the condition, so the theme comes up on sign-in and is torn down on
 * sign-out without either path having to remember to do it — which is what keeps a
 * dark preference from following the user out onto the public pages.
 *
 * The hook runs before the status branches, not only on the authenticated one, so
 * the "Restoring your session" screen is already themed. Applying it after that
 * screen had painted meant a returning user saw the loader in the base palette and
 * then watched the app flip underneath them.
 */
function ProtectedArea() {
  const { status } = useAuth()
  const location = useLocation()
  useScopedTheme()

  // `surface="app"`: the theme is already applied above, so this one follows it
  // rather than pinning dark in front of a light app.
  if (status === 'loading') {
    return <FullScreenLoader label="Restoring your session" surface="app" />
  }

  if (status !== 'authenticated') {
    // `from` lets the login screen send the user back where they were headed.
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}

/** Gate for signed-in routes. Waits for the bootstrap refresh before redirecting. */
export function ProtectedRoute() {
  return <ProtectedArea />
}

/** Inverse gate: keeps a signed-in user out of the login and register screens. */
export function PublicOnlyRoute() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <FullScreenLoader label="Loading" />
  if (status === 'authenticated') {
    return <Navigate to={location.state?.from?.pathname || '/app'} replace />
  }
  return <Outlet />
}

/**
 * Gate for the public landing page at `/`.
 *
 * Deliberately not PublicOnlyRoute. That guard blocks on the bootstrap probe, which
 * is correct for `/login` — a screen only ever reached on purpose — but wrong for
 * the marketing page, where it would put a full-screen loader in front of every
 * first-time visitor while a refresh request they were never going to pass resolves.
 *
 * So the decision is split by what the session marker actually knows:
 *
 *  - authenticated            → straight to the app; this is the case that let
 *                               someone delete `/app` from the URL and land back on
 *                               the public page without ever signing out.
 *  - still loading, and this
 *    browser has signed in
 *    before                   → hold, because painting the landing page here would
 *                               flash it at a signed-in user mid-reload.
 *  - anything else            → paint immediately. A visitor with no marker, or one
 *                               positively signed out, owes the server nothing.
 */
export function LandingRoute() {
  const { status } = useAuth()

  if (status === 'authenticated') return <Navigate to="/app" replace />
  if (status === 'loading' && hadSession()) return <FullScreenLoader label="Loading" />
  return <Outlet />
}

export default ProtectedRoute
