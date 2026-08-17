import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import { ProtectedRoute, PublicOnlyRoute } from './auth/ProtectedRoute'
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
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <Routes>
        <Route path="/" element={<Landing />} />

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
          <Route path="/app" element={<AppShell />}>
            <Route index element={<ChatWelcome />} />
            <Route path="c/:roomId" element={<ChatRoom />} />
            <Route path="settings" element={<Settings />} />
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
