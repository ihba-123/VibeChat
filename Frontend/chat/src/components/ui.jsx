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
import { createPortal } from 'react-dom'

import { accentFor, cn, initials } from '../lib/utils'

// ------------------------------------------------------------------- button

const BUTTON_VARIANTS = {
  primary:
    'bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active '
    + 'focus-visible:ring-primary shadow-sm disabled:bg-muted disabled:text-subtle-foreground',
  secondary:
    'bg-secondary text-secondary-foreground hover:bg-muted hover:border-border-strong '
    + 'focus-visible:ring-ring border border-border disabled:text-subtle-foreground',
  ghost:
    'text-foreground hover:bg-muted focus-visible:ring-ring disabled:text-subtle-foreground',
  danger:
    'bg-danger text-danger-foreground hover:bg-danger-strong focus-visible:ring-danger '
    + 'shadow-sm disabled:bg-muted disabled:text-subtle-foreground',
  outline:
    'border border-border bg-transparent text-foreground hover:bg-muted '
    + 'hover:border-border-strong focus-visible:ring-ring disabled:text-subtle-foreground',
}

const BUTTON_SIZES = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-11 px-6 text-base gap-2',
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
        'disabled:pointer-events-none disabled:opacity-70 disabled:shadow-none active:scale-[0.98]',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="icon-sm animate-spin" aria-hidden />}
      {children}
    </button>
  )
})

export const IconButton = forwardRef(function IconButton(
  { label, className, size = 'md', variant = 'ghost', ...props },
  ref,
) {
  // Same scale as Button (32 / 40 / 44px) so an IconButton and a Button of the
  // same nominal size line up when they sit side by side in a row.
  const dimensions = size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-11 w-11' : 'h-10 w-10'
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
  { label, error, hint, className, id, icon: Icon, trailing, ...props },
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
      {/* Adornments are positioned against this wrapper, which contains only the
          input — never against the whole field group. Call sites used to place a
          reveal button with a hand-tuned `top-[38px]` guessed from the label height,
          which drifted out of alignment and overlapped the input the moment the
          label spacing or the icon size changed. */}
      <div className="relative">
        {Icon && (
          <Icon
            className="icon-md pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            'w-full rounded-lg border bg-field px-3 py-2.5 text-sm text-foreground',
            'placeholder:text-subtle-foreground transition-colors',
            'hover:bg-field-hover hover:border-border-strong',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent focus:bg-surface',
            'disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70 disabled:hover:border-border',
            Icon && 'pl-10',
            trailing && 'pr-11',
            error ? 'border-danger focus:ring-danger' : 'border-input',
            className,
          )}
          {...props}
        />
        {trailing && (
          <span className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center">
            {trailing}
          </span>
        )}
      </div>
      {error ? (
        <p id={`${inputId}-error`} className="mt-1.5 text-sm text-danger">
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
          'w-full resize-none rounded-lg border bg-field px-3 py-2.5 text-sm text-foreground',
          'placeholder:text-subtle-foreground transition-colors',
          'hover:bg-field-hover hover:border-border-strong',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent focus:bg-surface',
          'disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70',
          error ? 'border-danger' : 'border-input',
          className,
        )}
        {...props}
      />
      {error && <p className="mt-1.5 text-sm text-danger">{error}</p>}
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
            isOnline ? 'bg-success' : 'bg-muted-foreground/50',
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
        isOnline ? 'bg-success' : 'bg-muted-foreground/40',
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
      <Loader2 className={cn('icon-lg animate-spin text-muted-foreground', className)} />
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
    success: 'bg-success-soft text-success ring-1 ring-inset ring-success-border',
    danger: 'bg-danger-soft text-danger ring-1 ring-inset ring-danger-border',
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
          <Icon className="icon-xl text-muted-foreground" aria-hidden />
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

/**
 * A dialog, rendered into `document.body`.
 *
 * The portal is not a detail. `fixed inset-0 z-50` only spans the viewport when
 * nothing above it has opened a stacking context — and the app shell is full of
 * them: the chat pane sits in a `relative z-10` wrapper, the sidebar is `z-20`
 * and the icon rail `z-40`. A dialog rendered from inside a route (group info,
 * for one) was therefore scoped to the chat pane and painted *underneath* the
 * sidebar and rail. Portalling to the body puts every dialog in the root
 * stacking context, so where it is rendered from stops mattering.
 */
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

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-scrim backdrop-blur-sm"
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
              'glass-strong relative z-10 flex max-h-[90vh] w-full flex-col rounded-t-2xl border shadow-2xl sm:rounded-2xl',
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
                <X className="icon-md" />
              </IconButton>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>

            {footer && (
              <footer className="flex justify-end gap-2 border-t border-border p-4">{footer}</footer>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
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
