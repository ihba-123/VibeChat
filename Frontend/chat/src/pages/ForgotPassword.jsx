import { ArrowLeft, CheckCircle2, KeyRound, Lock, Mail } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { authApi } from '../api'
import AuthLayout from '../components/layout/AuthLayout'
import { Button, Input } from '../components/ui'
import { cn } from '../lib/utils'

const STEPS = ['email', 'otp', 'password', 'done']
const RESEND_COOLDOWN_SECONDS = 45

/** Three-step reset: request a code, confirm it, then choose a new password. */
export default function ForgotPassword() {
  const navigate = useNavigate()

  const [step, setStep] = useState('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')

  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const cooldownTimer = useRef(null)

  useEffect(() => {
    if (cooldown <= 0) return undefined
    cooldownTimer.current = setTimeout(() => setCooldown((value) => value - 1), 1000)
    return () => clearTimeout(cooldownTimer.current)
  }, [cooldown])

  const run = async (action) => {
    setError(null)
    setSubmitting(true)
    try {
      await action()
    } catch (requestError) {
      setError(requestError?.message || 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  const requestCode = (event) => {
    event?.preventDefault()
    if (!email.trim()) {
      setError('Enter your email address.')
      return
    }
    return run(async () => {
      await authApi.forgotPassword({ email: email.trim().toLowerCase() })
      // The response is intentionally identical for unknown addresses, so the copy
      // has to be non-committal too.
      setNotice('If that address is registered, a 6-digit code is on its way.')
      setStep('otp')
      setCooldown(RESEND_COOLDOWN_SECONDS)
    })
  }

  const confirmCode = (event) => {
    event?.preventDefault()
    if (!/^\d{6}$/.test(otp)) {
      setError('Enter the 6-digit code from the email.')
      return
    }
    return run(async () => {
      await authApi.verifyOtp({ email: email.trim().toLowerCase(), otp })
      setNotice(null)
      setStep('password')
    })
  }

  const setNewPassword = (event) => {
    event?.preventDefault()
    if (password.length < 8) {
      setError('Passwords must be at least 8 characters.')
      return
    }
    if (password !== password2) {
      setError('Passwords do not match.')
      return
    }
    return run(async () => {
      await authApi.resetPassword({ email: email.trim().toLowerCase(), otp, password })
      setStep('done')
    })
  }

  const stepIndex = STEPS.indexOf(step)

  return (
    <AuthLayout
      scene="quiet"
      title={
        step === 'done'
          ? 'Password updated'
          : step === 'password'
            ? 'Choose a new password'
            : step === 'otp'
              ? 'Enter your code'
              : 'Reset your password'
      }
      subtitle={
        step === 'done'
          ? 'You can sign in with your new password now.'
          : step === 'password'
            ? 'Pick something you have not used before.'
            : step === 'otp'
              ? `We sent a code to ${email}.`
              : 'We will email you a 6-digit code.'
      }
      footer={
        step !== 'done' && (
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
          >
            <ArrowLeft className="icon-xs" />
            Back to sign in
          </Link>
        )
      }
    >
      {/* Progress dots */}
      {step !== 'done' && (
        <div className="mb-5 flex items-center gap-1.5" aria-hidden>
          {STEPS.slice(0, 3).map((entry, index) => (
            <span
              key={entry}
              className={cn(
                'h-1 flex-1 rounded-full transition-colors',
                index <= stepIndex ? 'bg-primary' : 'bg-border',
              )}
            />
          ))}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-danger-border bg-danger-soft px-3 py-2.5 text-sm text-danger"
        >
          {error}
        </div>
      )}
      {notice && !error && (
        <div className="mb-4 rounded-lg border border-primary/25 bg-primary/10 px-3 py-2.5 text-sm text-foreground">
          {notice}
        </div>
      )}

      {step === 'email' && (
        <form onSubmit={requestCode} className="space-y-4" noValidate>
          <Input
            label="Email"
            type="email"
            icon={Mail}
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
          <Button type="submit" fullWidth loading={submitting}>
            Send code
          </Button>
        </form>
      )}

      {step === 'otp' && (
        <form onSubmit={confirmCode} className="space-y-4" noValidate>
          <Input
            label="6-digit code"
            icon={KeyRound}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={otp}
            onChange={(event) => setOtp(event.target.value.replace(/\D/g, ''))}
            placeholder="123456"
            className="tracking-[0.4em]"
            hint="The code expires after 10 minutes."
          />
          <Button type="submit" fullWidth loading={submitting}>
            Verify code
          </Button>
          <Button
            variant="ghost"
            fullWidth
            disabled={cooldown > 0 || submitting}
            onClick={requestCode}
          >
            {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
          </Button>
        </form>
      )}

      {step === 'password' && (
        <form onSubmit={setNewPassword} className="space-y-4" noValidate>
          <Input
            label="New password"
            type="password"
            icon={Lock}
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 8 characters"
          />
          <Input
            label="Confirm new password"
            type="password"
            icon={Lock}
            autoComplete="new-password"
            value={password2}
            onChange={(event) => setPassword2(event.target.value)}
            placeholder="Repeat your password"
          />
          <Button type="submit" fullWidth loading={submitting}>
            Update password
          </Button>
        </form>
      )}

      {step === 'done' && (
        <div className="flex flex-col items-center text-center">
          <CheckCircle2 className="h-12 w-12 text-success" aria-hidden />
          <p className="mt-4 text-sm text-muted-foreground">
            Your password has been changed and other sessions were signed out.
          </p>
          <Button fullWidth className="mt-6" onClick={() => navigate('/login', { replace: true })}>
            Go to sign in
          </Button>
        </div>
      )}
    </AuthLayout>
  )
}
