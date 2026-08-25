import { AnimatePresence, motion } from 'framer-motion'
import { ExternalLink, X } from 'lucide-react'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'

/**
 * Full-screen image viewer. Closes on Escape or a click outside the image.
 *
 * Portalled to the body for the same reason `Modal` is: it is rendered from
 * inside the chat pane, whose `relative z-10` wrapper is a stacking context, so
 * without this the sidebar and the icon rail paint over the "full-screen" viewer.
 */
export default function ImageLightbox({ src, onClose }) {
  useEffect(() => {
    if (!src) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [src, onClose])

  return createPortal(
    <AnimatePresence>
      {src && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
        >
          <div className="absolute right-4 top-4 flex gap-2">
            <a
              href={src}
              target="_blank"
              rel="noreferrer noopener"
              onClick={(event) => event.stopPropagation()}
              aria-label="Open original image"
              className="rounded-full bg-white/10 p-2.5 text-white transition-colors hover:bg-white/20"
            >
              <ExternalLink className="icon-lg" />
            </a>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close preview"
              className="rounded-full bg-white/10 p-2.5 text-white transition-colors hover:bg-white/20"
            >
              <X className="icon-lg" />
            </button>
          </div>

          <motion.img
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.97 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            src={src}
            alt="Shared image"
            onClick={(event) => event.stopPropagation()}
            className="max-h-[88vh] max-w-full rounded-lg object-contain shadow-2xl"
          />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
