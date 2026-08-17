/**
 * Confirmation prompts for actions that are hard to undo.
 *
 * Exposed as an awaited call rather than a component, because that is what call
 * sites actually want: they already sit inside an async handler, so
 *
 *     if (!(await confirm({ ... }))) return
 *     await blockUser.mutateAsync(id)
 *
 * reads in the order it happens, and the guard cannot be forgotten halfway down a
 * branch. Modelling it as a rendered <ConfirmDialog open={...}> would have meant
 * every screen carrying its own `pendingAction` state and remembering to clear it.
 *
 * One dialog is mounted for the whole app. A second request while one is open
 * resolves the first as cancelled instead of stacking dialogs on top of each other.
 */

import { AlertTriangle } from 'lucide-react'
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

import { Button, Modal } from './ui'

const ConfirmContext = createContext(null)

const DEFAULTS = {
  title: 'Are you sure?',
  description: 'This action cannot be undone.',
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel',
  tone: 'danger',
}

export function ConfirmProvider({ children }) {
  const [request, setRequest] = useState(null)
  const [busy, setBusy] = useState(false)
  // Held in a ref, not in state: settling the promise must not depend on a render
  // having happened, and the resolver is not something the UI reads.
  const resolverRef = useRef(null)

  const settle = useCallback((result) => {
    const resolve = resolverRef.current
    resolverRef.current = null
    setRequest(null)
    setBusy(false)
    resolve?.(result)
  }, [])

  const confirm = useCallback(
    (options = {}) =>
      new Promise((resolve) => {
        // Never leave an earlier caller hanging.
        resolverRef.current?.(false)
        resolverRef.current = resolve
        setBusy(false)
        setRequest({ ...DEFAULTS, ...options })
      }),
    [],
  )

  const onConfirm = useCallback(() => {
    // Guard against a double-click resolving twice.
    if (!resolverRef.current) return
    setBusy(true)
    settle(true)
  }, [settle])

  const onCancel = useCallback(() => settle(false), [settle])

  const value = useMemo(() => ({ confirm }), [confirm])

  const isDanger = request?.tone === 'danger'

  return (
    <ConfirmContext.Provider value={value}>
      {children}

      <Modal
        open={Boolean(request)}
        onClose={onCancel}
        size="sm"
        title={request?.title ?? DEFAULTS.title}
        footer={
          <>
            <Button variant="ghost" onClick={onCancel} disabled={busy}>
              {request?.cancelLabel ?? DEFAULTS.cancelLabel}
            </Button>
            <Button
              variant={isDanger ? 'danger' : 'primary'}
              onClick={onConfirm}
              loading={busy}
              autoFocus
            >
              {request?.confirmLabel ?? DEFAULTS.confirmLabel}
            </Button>
          </>
        }
      >
        <div className="flex gap-3">
          {isDanger && (
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger">
              <AlertTriangle className="icon-md" />
            </span>
          )}
          <p className="min-w-0 text-sm leading-relaxed text-muted-foreground">
            {request?.description}
          </p>
        </div>
      </Modal>
    </ConfirmContext.Provider>
  )
}

/**
 * Returns `confirm(options) => Promise<boolean>`.
 *
 * Resolves false — never rejects — so a call site can guard with a plain `if`
 * without wrapping the prompt itself in a try/catch that would also swallow
 * failures from the action it is guarding.
 */
export function useConfirm() {
  const context = useContext(ConfirmContext)
  if (!context) throw new Error('useConfirm must be used inside <ConfirmProvider>')
  return context.confirm
}

export default ConfirmProvider
