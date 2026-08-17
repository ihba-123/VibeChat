import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/AuthProvider'
import FullScreenLoader from '../components/FullScreenLoader'
import AuthLayout from '../components/layout/AuthLayout'
import { Button } from '../components/ui'

/**
 * Landing spot after Google sign-in.
 *
 * allauth completes the OAuth dance as a Django session on the API host; this
 * screen trades that session for the JWT pair the SPA actually uses, then moves on.
 */
export default function SocialCallback() {
  const navigate = useNavigate()
  const { completeSocialLogin } = useAuth()
  const [error, setError] = useState(null)
  const attempted = useRef(false)

  useEffect(() => {
    if (attempted.current) return
    attempted.current = true

    completeSocialLogin()
      .then(() => navigate('/app', { replace: true }))
      .catch((requestError) =>
        setError(requestError?.message || 'Could not complete the sign-in.'),
      )
  }, [completeSocialLogin, navigate])

  if (!error) return <FullScreenLoader label="Finishing sign-in" />

  return (
    <AuthLayout
      title="Sign-in did not complete"
      subtitle="The Google session could not be exchanged for an app session."
    >
      <div className="space-y-4">
        <p className="rounded-lg border border-danger-border bg-danger-soft px-3 py-2.5 text-sm text-danger">
          {error}
        </p>
        <Button fullWidth onClick={() => navigate('/login', { replace: true })}>
          Back to sign in
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Or{' '}
          <Link to="/register" className="font-semibold text-primary hover:underline">
            create an account
          </Link>
          .
        </p>
      </div>
    </AuthLayout>
  )
}
