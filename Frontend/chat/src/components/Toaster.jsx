/** Lightweight toast system: a provider, a `useToast()` hook, and the viewport. */

import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

import { cn } from '../lib/utils'

const ToastContext = createContext(null)

const DEFAULT_DURATION = 4500

const VARIANTS = {
  success: { Icon: CheckCircle2, accent: 'text-success', ring: 'ring-success-border' },
  error: { Icon: XCircle, accent: 'text-danger', ring: 'ring-danger-border' },
  warning: { Icon: AlertTriangle, accent: 'text-warning', ring: 'ring-warning-border' },
  info: { Icon: Info, accent: 'text-primary', ring: 'ring-primary/20' },
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef(new Map())

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const show = useCallback(
    (message, { variant = 'info', duration = DEFAULT_DURATION, title, action } = {}) => {
      if (!message) return undefined
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

      setToasts((current) => {
        // Collapse a repeat of the message already on screen instead of stacking
        // duplicates, which is what a retried request tends to produce.
        const withoutDuplicate = current.filter((toast) => toast.message !== message)
        return [...withoutDuplicate.slice(-3), { id, message, variant, title, action }]
      })

      if (duration > 0) {
        timers.current.set(id, setTimeout(() => dismiss(id), duration))
      }
      return id
    },
    [dismiss],
  )

  const value = useMemo(
    () => ({
      show,
      dismiss,
      success: (message, options) => show(message, { ...options, variant: 'success' }),
      error: (message, options) => show(message, { ...options, variant: 'error' }),
      warning: (message, options) => show(message, { ...options, variant: 'warning' }),
      info: (message, options) => show(message, { ...options, variant: 'info' }),
    }),
    [show, dismiss],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

function ToastViewport({ toasts, onDismiss }) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-4 sm:items-end"
      role="region"
      aria-live="polite"
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => {
          const { Icon, accent, ring } = VARIANTS[toast.variant] ?? VARIANTS.info
          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className={cn(
                'glass-strong pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border p-3 shadow-lg ring-1',
                ring,
              )}
            >
              <Icon className={cn('mt-0.5 icon-sm shrink-0', accent)} aria-hidden />
              <div className="min-w-0 flex-1">
                {toast.title && (
                  <p className="text-sm font-semibold text-card-foreground">{toast.title}</p>
                )}
                <p className="text-sm text-muted-foreground break-words">{toast.message}</p>
                {toast.action && (
                  <button
                    type="button"
                    onClick={() => {
                      toast.action.onClick?.()
                      onDismiss(toast.id)
                    }}
                    className="mt-2 text-sm font-semibold text-primary hover:underline"
                  >
                    {toast.action.label}
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => onDismiss(toast.id)}
                aria-label="Dismiss notification"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="icon-md" />
              </button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside <ToastProvider>')
  return context
}

export default ToastProvider
