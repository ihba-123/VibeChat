import { Navigate, Outlet, useLocation } from 'react-router-dom'

import FullScreenLoader from '../components/FullScreenLoader'
import { useAuth } from './AuthProvider'

/** Gate for signed-in routes. Waits for the bootstrap refresh before redirecting. */
export function ProtectedRoute() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <FullScreenLoader label="Restoring your session" />

  if (status !== 'authenticated') {
    // `from` lets the login screen send the user back where they were headed.
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
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

export default ProtectedRoute
