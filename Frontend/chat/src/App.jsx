import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import { useAuth } from './auth/AuthProvider'
import { LandingRoute, ProtectedRoute, PublicOnlyRoute } from './auth/ProtectedRoute'
import FullScreenLoader from './components/FullScreenLoader'

/**
 * Routes are split so a first-time visitor downloads the landing page only, and
 * the chat shell (with its message list, composer and people panels) arrives when
 * they actually sign in.
 */
const Landing = lazy(() => import('./pages/Landing'))
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const SocialCallback = lazy(() => import('./pages/SocialCallback'))
const AppShell = lazy(() => import('./components/layout/AppShell'))
const ChatWelcome = lazy(() => import('./pages/ChatWelcome'))
const ChatRoom = lazy(() => import('./pages/ChatRoom'))
const Settings = lazy(() => import('./pages/Settings'))
const NotFound = lazy(() => import('./pages/NotFound'))

export default function App() {
  // The route-chunk fallback follows the signed-in theme, and pins the public ground
  // otherwise. Without this, opening a lazily-loaded screen inside the app (Settings,
  // a conversation) flashed the dark public splash at a light-theme user.
  const { isAuthenticated } = useAuth()

  // No theme call here on purpose. It used to apply the saved theme to *every*
  // route, which meant a dark preference followed the user out to the public pages
  // after they signed out. ProtectedRoute now owns it, so the toggle governs the
  // signed-in app and the landing and auth screens keep their own presentation.
  return (
    <Suspense fallback={<FullScreenLoader surface={isAuthenticated ? 'app' : 'public'} />}>
      <Routes>
        {/* The landing page is public, but only to someone who is actually signed
            out — otherwise clearing `/app` from the address bar walked straight back
            out of the authenticated area without ever logging out. */}
        <Route element={<LandingRoute />}>
          <Route path="/" element={<Landing />} />
        </Route>

        {/* Signing in while already signed in just bounces to the app. */}
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
        </Route>

        {/* Where allauth returns after Google sign-in. Must stay reachable while
            the session is still anonymous from the SPA's point of view. */}
        <Route path="/auth/social/callback" element={<SocialCallback />} />

        <Route element={<ProtectedRoute />}>
          {/* Settings sits outside AppShell so it opens as its own full page rather
              than as a pane beside the conversation list. */}
          <Route path="/app/settings" element={<Settings />} />

          <Route path="/app" element={<AppShell />}>
            <Route index element={<ChatWelcome />} />
            <Route path="c/:roomId" element={<ChatRoom />} />
          </Route>
        </Route>

        {/* Legacy paths the old backend settings redirected to. */}
        <Route path="/home" element={<Navigate to="/app" replace />} />
        <Route path="/chat" element={<Navigate to="/app" replace />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}
