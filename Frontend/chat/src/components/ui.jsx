/**
 * UI primitives.
 *
 * Everything is expressed with the design tokens already defined in index.css
 * (`bg-card`, `text-muted-foreground`, `border-border`, …) so light and dark modes
 * come for free and no component carries a literal colour.
 */

import { AnimatePresence, motion } from 'framer-motion'
import { Loader2, X } from 'lucide-react'
import { forwardRef, useEffect, useId, useMemo, useState } from 'react'

import { accentFor, cn, initials } from '../lib/utils'

// ------------------------------------------------------------------- button

const BUTTON_VARIANTS = {
  primary:
    'bg-primary text-primary-foreground hover:opacity-90 focus-visible:ring-primary shadow-sm',
  secondary:
    'bg-secondary text-secondary-foreground hover:bg-muted focus-visible:ring-ring border border-border',
  ghost: 'text-foreground hover:bg-muted focus-visible:ring-ring',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600 shadow-sm',
  outline:
    'border border-border bg-transparent text-foreground hover:bg-muted focus-visible:ring-ring',
}

const BUTTON_SIZES = {
  sm: 'h-9 px-3 text-sm gap-1.5',
  md: 'h-11 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
}

export const Button = forwardRef(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled,
    className,
    children,
    type = 'button',
    fullWidth = false,
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      // Disabled while loading so a double click cannot fire the action twice.
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-semibold transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
      {children}
    </button>
  )
})

export const IconButton = forwardRef(function IconButton(
  { label, className, size = 'md', variant = 'ghost', ...props },
  ref,
) {
  // Same scale as Button (36 / 44 / 48px) so an IconButton and a Button of the
  // same nominal size line up when they sit side by side in a row.
  const dimensions = size === 'sm' ? 'h-9 w-9' : size === 'lg' ? 'h-12 w-12' : 'h-11 w-11'
  return (
    <Button
      ref={ref}
      variant={variant}
      aria-label={label}
      title={label}
      className={cn('rounded-full p-0', dimensions, className)}
      {...props}
    />
  )
})

// -------------------------------------------------------------------- input

export const Input = forwardRef(function Input(
  { label, error, hint, className, id, icon: Icon, ...props },
  ref,
) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <Icon
            className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            'w-full rounded-lg border bg-background px-3 py-2.5 text-sm text-foreground',
            'placeholder:text-muted-foreground transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent',
            'disabled:cursor-not-allowed disabled:opacity-60',
            Icon && 'pl-10',
            error ? 'border-red-500 focus:ring-red-500' : 'border-input',
            className,
          )}
          {...props}
        />
      </div>
      {error ? (
        <p id={`${inputId}-error`} className="mt-1.5 text-sm text-red-500">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="mt-1.5 text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  )
})

export const Textarea = forwardRef(function Textarea({ label, error, className, id, ...props }, ref) {
  const generatedId = useId()
  const textareaId = id ?? generatedId

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={textareaId} className="mb-1.5 block text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={textareaId}
        aria-invalid={error ? true : undefined}
        className={cn(
          'w-full resize-none rounded-lg border bg-background px-3 py-2.5 text-sm text-foreground',
          'placeholder:text-muted-foreground transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent',
          error ? 'border-red-500' : 'border-input',
          className,
        )}
        {...props}
      />
      {error && <p className="mt-1.5 text-sm text-red-500">{error}</p>}
    </div>
  )
})

// ------------------------------------------------------------------- avatar

const AVATAR_SIZES = {
  xs: 'h-7 w-7 text-[10px]',
  sm: 'h-9 w-9 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-14 w-14 text-base',
  xl: 'h-24 w-24 text-2xl',
}

const DOT_SIZES = { xs: 'h-2 w-2', sm: 'h-2.5 w-2.5', md: 'h-3 w-3', lg: 'h-3.5 w-3.5', xl: 'h-5 w-5' }

/**
 * Avatar with an initials fallback.
 *
 * The size lives on the **wrapper**, and both the initials and the image are
 * absolutely positioned inside it. That ordering is what keeps the layout stable:
 * previously the image sat in normal flow and only the fallback was absolute, so a
 * broken image URL (hidden by an onError handler) collapsed the wrapper to 0×0 —
 * the initials then escaped their row and overlapped neighbouring text, and the
 * presence dot anchored to the collapsed box instead of the circle. A placeholder
 * media id that 404s is entirely normal, so it must not move anything.
 *
 * The initials render underneath; a loaded image simply covers them, so there is no
 * swap to coordinate and nothing to imperatively poke in the DOM.
 */
export function Avatar({ src, name, size = 'md', isOnline, showPresence = false, className }) {
  const background = useMemo(() => accentFor(name || '?'), [name])
  const [failed, setFailed] = useState(false)

  // Retry when the URL changes (e.g. after a fresh avatar upload).
  useEffect(() => setFailed(false), [src])

  const showImage = Boolean(src) && !failed

  return (
    <span
      className={cn('relative inline-flex shrink-0', AVATAR_SIZES[size], className)}
      data-avatar={name || undefined}
    >
      <span
        aria-hidden={showImage || undefined}
        style={{ background }}
        className="absolute inset-0 flex items-center justify-center rounded-full font-semibold leading-none text-white ring-1 ring-border"
      >
        {initials(name)}
      </span>

      {showImage && (
        <img
          src={src}
          alt={name ? `${name}'s avatar` : 'Avatar'}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full rounded-full object-cover ring-1 ring-border"
        />
      )}

      {showPresence && (
        <span
          className={cn(
            'absolute bottom-0 right-0 rounded-full ring-2 ring-card',
            DOT_SIZES[size],
            isOnline ? 'bg-emerald-500' : 'bg-muted-foreground/50',
          )}
          title={isOnline ? 'Online' : 'Offline'}
        />
      )}
    </span>
  )
}

export function PresenceDot({ isOnline, className }) {
  return (
    <span
      className={cn(
        'inline-block h-2 w-2 shrink-0 rounded-full',
        isOnline ? 'bg-emerald-500' : 'bg-muted-foreground/40',
        className,
      )}
      title={isOnline ? 'Online' : 'Offline'}
    />
  )
}

// ------------------------------------------------------------ status & empty

export function Spinner({ className, label = 'Loading' }) {
  return (
    <span role="status" aria-label={label}>
      <Loader2 className={cn('h-6 w-6 animate-spin text-muted-foreground', className)} />
    </span>
  )
}

export function Skeleton({ className }) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} aria-hidden />
}

export function Badge({ children, variant = 'default', className }) {
  const variants = {
    default: 'bg-muted text-muted-foreground',
    primary: 'bg-primary text-primary-foreground',
    success: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    danger: 'bg-red-500/15 text-red-600 dark:text-red-400',
  }
  return (
    <span
      className={cn(
        'inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold leading-none',
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      {Icon && (
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
          <Icon className="h-7 w-7 text-muted-foreground" aria-hidden />
        </span>
      )}
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ErrorState({ title = 'Something went wrong', description, onRetry, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-10 text-center', className)}>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}

// -------------------------------------------------------------------- modal

export function Modal({ open, onClose, title, description, children, footer, size = 'md' }) {
  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }

  useEffect(() => {
    if (!open) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKeyDown)
    // Stop the page behind the dialog from scrolling.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={cn(
              'relative z-10 flex max-h-[90vh] w-full flex-col rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl',
              widths[size],
            )}
          >
            <header className="flex items-start justify-between gap-4 border-b border-border p-5">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-card-foreground">{title}</h2>
                {description && (
                  <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                )}
              </div>
              <IconButton label="Close" size="sm" onClick={onClose}>
                <X className="h-5 w-5" />
              </IconButton>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>

            {footer && (
              <footer className="flex justify-end gap-2 border-t border-border p-4">{footer}</footer>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

// --------------------------------------------------------------------- tabs

export function Tabs({ tabs, value, onChange, className }) {
  return (
    <div role="tablist" className={cn('flex gap-1 rounded-lg bg-muted p-1', className)}>
      {tabs.map((tab) => {
        const active = tab.value === value
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={cn(
              'relative flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              active
                ? 'bg-card text-card-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
            {tab.count > 0 && <Badge variant={active ? 'primary' : 'default'}>{tab.count}</Badge>}
          </button>
        )
      })}
    </div>
  )
}
