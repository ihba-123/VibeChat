import { ImagePlus, Paperclip, SendHorizontal, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import config from '../../config'
import { useAutoResize } from '../../hooks/ui'
import { cn, formatBytes, isImageFile } from '../../lib/utils'
import { useToast } from '../Toaster'
import { IconButton, Spinner } from '../ui'

const MAX_BYTES = config.maxUploadMb * 1024 * 1024

/**
 * Preview strip for a queued image or file.
 *
 * The remove control is offered twice on purpose: a cross badge pinned to the
 * thumbnail, which is where people look for it, and a labelled button on the right
 * of the row. It stays available *during* the upload too — clicking it cancels the
 * request rather than leaving the user to wait out a file they did not mean to pick.
 */
function PendingAttachment({ pending, progress, onClear, isUploading }) {
  const removeLabel = isUploading ? 'Cancel upload' : `Remove ${pending.file.name}`

  return (
    <div className="mb-2 flex items-center gap-3 rounded-xl border border-border bg-muted/50 p-2.5">
      <div className="relative shrink-0">
        {pending.previewUrl ? (
          <img
            src={pending.previewUrl}
            alt=""
            className="h-16 w-16 rounded-lg object-cover"
          />
        ) : (
          <span className="flex h-16 w-16 items-center justify-center rounded-lg bg-background">
            <Paperclip className="icon-xl text-muted-foreground" aria-hidden />
          </span>
        )}

        {/* Overlaid cross, offset so it reads as attached to the thumbnail. */}
        <button
          type="button"
          onClick={onClear}
          aria-label={removeLabel}
          title={removeLabel}
          className={cn(
            'absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full',
            'border-2 border-card bg-foreground text-background shadow-md',
            'transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
        >
          <X className="icon-xs" strokeWidth={2.5} />
        </button>
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{pending.file.name}</p>
        <p className="text-xs text-muted-foreground">
          {formatBytes(pending.file.size)}
          {isUploading && ` · ${progress}%`}
        </p>
        {isUploading && (
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-border"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {isUploading && <Spinner label="Uploading" />}
        <IconButton label={removeLabel} onClick={onClear}>
          <X className="icon-lg" />
        </IconButton>
      </div>
    </div>
  )
}

export default function MessageComposer({
  roomId,
  disabled = false,
  disabledReason,
  /** Optional control rendered beside the reason, e.g. an Unblock button. */
  disabledAction,
  onSendText,
  onUpload,
  onTyping,
}) {
  const [text, setText] = useState('')
  const [pending, setPending] = useState(null)
  const [progress, setProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)

  const textareaRef = useAutoResize(text)
  const imageInputRef = useRef(null)
  const fileInputRef = useRef(null)
  const typingSentAt = useRef(0)
  const typingStopTimer = useRef(null)
  // Lets the remove button abort a request that is already in flight.
  const uploadAbortRef = useRef(null)
  const toast = useToast()

  /** Drop the queued attachment, cancelling its upload if one has started. */
  const clearPending = useCallback(() => {
    uploadAbortRef.current?.abort()
    uploadAbortRef.current = null
    setPending(null)
    setProgress(0)
    setIsUploading(false)
  }, [])

  // A queued draft belongs to the conversation it was written in.
  useEffect(() => {
    setText('')
    clearPending()
  }, [roomId, clearPending])

  // Abort any upload still running when the composer goes away.
  useEffect(() => () => uploadAbortRef.current?.abort(), [])

  // Revoke the object URL so previewing images does not leak memory.
  useEffect(
    () => () => {
      if (pending?.previewUrl) URL.revokeObjectURL(pending.previewUrl)
    },
    [pending],
  )

  const stopTyping = useCallback(() => {
    if (typingStopTimer.current) {
      clearTimeout(typingStopTimer.current)
      typingStopTimer.current = null
    }
    if (typingSentAt.current) {
      typingSentAt.current = 0
      onTyping?.(false)
    }
  }, [onTyping])

  useEffect(() => stopTyping, [stopTyping])

  const noteTyping = useCallback(() => {
    const now = Date.now()
    // Throttled: one notice per interval rather than one per keystroke.
    if (now - typingSentAt.current > config.typingThrottleMs) {
      typingSentAt.current = now
      onTyping?.(true)
    }
    if (typingStopTimer.current) clearTimeout(typingStopTimer.current)
    typingStopTimer.current = setTimeout(stopTyping, config.typingIdleMs)
  }, [onTyping, stopTyping])

  const choose = useCallback(
    (file, kind) => {
      if (!file) return
      if (file.size > MAX_BYTES) {
        toast.error(`${file.name} is larger than the ${config.maxUploadMb}MB limit.`)
        return
      }
      if (kind === 'image' && !isImageFile(file)) {
        toast.error('That file is not an image.')
        return
      }
      setPending({
        file,
        kind,
        previewUrl: isImageFile(file) ? URL.createObjectURL(file) : null,
      })
    },
    [toast],
  )

  const submit = useCallback(
    async (event) => {
      event?.preventDefault()
      if (disabled || isUploading) return

      const trimmed = text.trim()
      if (!trimmed && !pending) return
      if (trimmed.length > config.maxMessageLength) {
        toast.error(`Messages are limited to ${config.maxMessageLength} characters.`)
        return
      }

      stopTyping()

      if (pending) {
        // Files go over HTTP so the upload can report progress; the server then
        // broadcasts the stored message to everyone including this client.
        const controller = new AbortController()
        uploadAbortRef.current = controller
        setIsUploading(true)
        setProgress(0)
        try {
          await onUpload?.({
            content: trimmed || undefined,
            image: pending.kind === 'image' ? pending.file : undefined,
            file: pending.kind === 'file' ? pending.file : undefined,
            onProgress: setProgress,
            signal: controller.signal,
          })
          setPending(null)
          setText('')
        } catch (error) {
          // A cancel is the user's own doing, so it is not reported as a failure.
          if (error?.code !== 'cancelled' && !controller.signal.aborted) {
            toast.error(error?.message || 'Upload failed.')
          }
        } finally {
          if (uploadAbortRef.current === controller) uploadAbortRef.current = null
          setIsUploading(false)
          setProgress(0)
        }
        return
      }

      // Clear the input first: the optimistic bubble is what confirms the send, and
      // a lagging textarea makes fast typing feel broken.
      setText('')
      onSendText?.(trimmed)
    },
    [disabled, isUploading, onSendText, onUpload, pending, stopTyping, text, toast],
  )

  const onKeyDown = (event) => {
    // Enter sends, Shift+Enter starts a new line.
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      submit()
    }
  }

  const onPaste = (event) => {
    const file = Array.from(event.clipboardData?.files ?? [])[0]
    if (file) {
      event.preventDefault()
      choose(file, isImageFile(file) ? 'image' : 'file')
    }
  }

  if (disabled) {
    // Takes the composer's place, so the explanation and the way to undo it sit
    // exactly where the user is already looking. `disabledAction` is a slot rather
    // than a blocking-aware button, which keeps this component presentational.
    return (
      <div className="glass-crystal relative z-10 mx-2 mb-2 shrink-0 rounded-3xl border px-4 py-3.5 sm:mx-4 sm:mb-3">
        <div className="mx-auto flex max-w-xl flex-col items-center gap-2.5 sm:flex-row sm:justify-center sm:gap-4">
          <p className="text-center text-sm text-muted-foreground sm:text-left">
            {disabledReason || 'You cannot send messages in this conversation.'}
          </p>
          {disabledAction}
        </div>
      </div>
    )
  }

  const canSend = Boolean(text.trim() || pending) && !isUploading

  return (
    <form
      onSubmit={submit}
      // Floats on its own margins rather than being absolutely positioned over
      // the list. The textarea grows with the message, and an overlaid bar would
      // need its height measured every keystroke to keep the last message clear —
      // in flow, the flex layout does that for free.
      //
      // shrink-0 keeps the composer at its natural height when the message
      // list grows; without it a flex parent can compress it.
      className="glass-crystal relative z-10 mx-2 mb-2 shrink-0 rounded-3xl border px-3 py-3 sm:mx-4 sm:mb-3 sm:px-4"
    >
      {pending && (
        <PendingAttachment
          pending={pending}
          progress={progress}
          isUploading={isUploading}
          onClear={clearPending}
        />
      )}

      <div className="flex min-w-0 items-end gap-2">
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            choose(event.target.files?.[0], 'image')
            event.target.value = ''
          }}
        />
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(event) => {
            choose(event.target.files?.[0], 'file')
            event.target.value = ''
          }}
        />

        <IconButton
          label="Attach an image"
          onClick={() => imageInputRef.current?.click()}
          disabled={isUploading}
        >
          <ImagePlus className="icon-lg" />
        </IconButton>
        <IconButton
          label="Attach a file"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          <Paperclip className="icon-lg" />
        </IconButton>

        <label className="sr-only" htmlFor="composer-input">
          Message
        </label>
        <textarea
          id="composer-input"
          ref={textareaRef}
          rows={1}
          value={text}
          onChange={(event) => {
            setText(event.target.value)
            noteTyping()
          }}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onBlur={stopTyping}
          placeholder="Write a message…"
          maxLength={config.maxMessageLength}
          className={cn(
            // min-h matches the 48px buttons either side so the row aligns.
            'max-h-40 min-h-10 min-w-0 flex-1 resize-none rounded-2xl border border-input bg-field px-4 py-3 text-sm',
            'placeholder:text-subtle-foreground transition-colors hover:bg-field-hover',
            'focus:border-transparent focus:bg-surface focus:outline-none focus:ring-2 focus:ring-ring',
          )}
        />

        <IconButton
          label="Send message"
          type="submit"
          variant={canSend ? 'primary' : 'ghost'}
          disabled={!canSend}
          className="shrink-0"
        >
          <SendHorizontal className="icon-lg" />
        </IconButton>
      </div>
    </form>
  )
}
