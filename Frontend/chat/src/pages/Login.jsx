import { Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/AuthProvider'
import GoogleButton from '../components/GoogleButton'
import AuthLayout from '../components/layout/AuthLayout'
import { Button, Input } from '../components/ui'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()

  const [form, setForm] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  const update = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }))
    setFieldErrors((current) => ({ ...current, [field]: undefined }))
    setError(null)
  }

  const submit = async (event) => {
    event.preventDefault()
    setError(null)
    setFieldErrors({})

    const errors = {}
    if (!form.email.trim()) errors.email = 'Email is required.'
    if (!form.password) errors.password = 'Password is required.'
    if (Object.keys(errors).length) {
      setFieldErrors(errors)
      return
    }

    setSubmitting(true)
    try {
      await login({ email: form.email.trim().toLowerCase(), password: form.password })
      // Return the user to whatever they were trying to reach.
      navigate(location.state?.from?.pathname || '/app', { replace: true })
    } catch (requestError) {
      setError(requestError?.message || 'Could not sign you in.')
      setFieldErrors({
        email: requestError?.fieldError?.('email'),
        password: requestError?.fieldError?.('password'),
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to pick up your conversations."
      footer={
        <>
          New here?{' '}
          <Link to="/register" className="font-semibold text-primary hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-600 dark:text-red-400"
          >
            {error}
          </div>
        )}

        <Input
          label="Email"
          type="email"
          icon={Mail}
          autoComplete="email"
          value={form.email}
          onChange={update('email')}
          error={fieldErrors.email}
          placeholder="you@example.com"
        />

        <div className="relative">
          <Input
            label="Password"
            type={showPassword ? 'text' : 'password'}
            icon={Lock}
            autoComplete="current-password"
            value={form.password}
            onChange={update('password')}
            error={fieldErrors.password}
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-3 top-[38px] rounded p-1 text-muted-foreground hover:text-foreground"
          >
            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>

        <div className="flex justify-end">
          <Link
            to="/forgot-password"
            className="text-sm font-medium text-primary hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        <Button type="submit" fullWidth loading={submitting}>
          Sign in
        </Button>

        <div className="flex items-center gap-3 py-1">
          <span className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <GoogleButton label="Sign in with Google" />
      </form>
    </AuthLayout>
  )
}
