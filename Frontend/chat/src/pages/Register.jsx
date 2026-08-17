import { Eye, EyeOff, Lock, Mail, User } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/AuthProvider'
import GoogleButton from '../components/GoogleButton'
import AuthLayout from '../components/layout/AuthLayout'
import { Button, Input } from '../components/ui'
import { cn } from '../lib/utils'

const MIN_PASSWORD_LENGTH = 8

/** Mirrors Django's validators closely enough to give feedback before submitting. */
function passwordStrength(password) {
  if (!password) return { score: 0, label: '', tone: '' }
  let score = 0
  if (password.length >= MIN_PASSWORD_LENGTH) score += 1
  if (password.length >= 12) score += 1
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1
  if (/\d/.test(password)) score += 1
  if (/[^A-Za-z0-9]/.test(password)) score += 1

  if (score <= 2) return { score, label: 'Weak', tone: 'bg-red-500' }
  if (score === 3) return { score, label: 'Fair', tone: 'bg-amber-500' }
  if (score === 4) return { score, label: 'Good', tone: 'bg-emerald-500' }
  return { score, label: 'Strong', tone: 'bg-emerald-500' }
}

export default function Register() {
  const navigate = useNavigate()
  const { register } = useAuth()

  const [form, setForm] = useState({ name: '', email: '', password: '', password2: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  const strength = useMemo(() => passwordStrength(form.password), [form.password])

  const update = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }))
    setFieldErrors((current) => ({ ...current, [field]: undefined }))
    setError(null)
  }

  const validate = () => {
    const errors = {}
    if (!form.name.trim()) errors.name = 'What should we call you?'
    if (!form.email.trim()) errors.email = 'Email is required.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      errors.email = 'That does not look like an email address.'
    if (form.password.length < MIN_PASSWORD_LENGTH)
      errors.password = `At least ${MIN_PASSWORD_LENGTH} characters.`
    if (form.password !== form.password2) errors.password2 = 'Passwords do not match.'
    return errors
  }

  const submit = async (event) => {
    event.preventDefault()
    const errors = validate()
    if (Object.keys(errors).length) {
      setFieldErrors(errors)
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await register({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        password2: form.password2,
      })
      navigate('/app', { replace: true })
    } catch (requestError) {
      setError(requestError?.message || 'Could not create your account.')
      // Surface the server's per-field messages (taken password, weak password…).
      setFieldErrors({
        name: requestError?.fieldError?.('name'),
        email: requestError?.fieldError?.('email'),
        password: requestError?.fieldError?.('password'),
        password2: requestError?.fieldError?.('password2'),
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="It takes about twenty seconds."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-primary hover:underline">
            Sign in
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
          label="Name"
          icon={User}
          autoComplete="name"
          value={form.name}
          onChange={update('name')}
          error={fieldErrors.name}
          placeholder="Alex Rivera"
        />

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

        <div>
          <div className="relative">
            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              icon={Lock}
              autoComplete="new-password"
              value={form.password}
              onChange={update('password')}
              error={fieldErrors.password}
              placeholder="At least 8 characters"
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

          {form.password && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex h-1 flex-1 gap-1">
                {[1, 2, 3, 4, 5].map((step) => (
                  <span
                    key={step}
                    className={cn(
                      'h-full flex-1 rounded-full transition-colors',
                      step <= strength.score ? strength.tone : 'bg-border',
                    )}
                  />
                ))}
              </div>
              <span className="text-xs font-medium text-muted-foreground">{strength.label}</span>
            </div>
          )}
        </div>

        <Input
          label="Confirm password"
          type={showPassword ? 'text' : 'password'}
          icon={Lock}
          autoComplete="new-password"
          value={form.password2}
          onChange={update('password2')}
          error={fieldErrors.password2}
          placeholder="Repeat your password"
        />

        <Button type="submit" fullWidth loading={submitting}>
          Create account
        </Button>

        <div className="flex items-center gap-3 py-1">
          <span className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <GoogleButton label="Sign up with Google" />
      </form>
    </AuthLayout>
  )
}
