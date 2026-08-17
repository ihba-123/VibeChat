import { motion } from 'framer-motion'
import { MessageCircleCode } from 'lucide-react'
import { Link } from 'react-router-dom'

import config from '../../config'
import ThemeToggle from '../ThemeToggle'

/** Shared frame for the sign-in, sign-up and password-reset screens. */
export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="relative flex min-h-dvh flex-col bg-background">
      {/* Decorative wash; purely presentational so it is hidden from assistive tech. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-24 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <header className="relative z-10 flex items-center justify-between px-5 py-5">
        <Link to="/" className="group flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <MessageCircleCode className="h-6 w-6" />
          </span>
          <span className="font-poppins text-lg font-bold text-foreground group-hover:text-primary">
            {config.appName}
          </span>
        </Link>
        <ThemeToggle size="sm" />
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-5 pb-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="w-full max-w-md"
        >
          <div className="rounded-2xl border border-border bg-card p-6 shadow-xl sm:p-8">
            <h1 className="font-poppins text-2xl font-bold text-card-foreground">{title}</h1>
            {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
            <div className="mt-6">{children}</div>
          </div>
          {footer && <div className="mt-5 text-center text-sm text-muted-foreground">{footer}</div>}
        </motion.div>
      </main>
    </div>
  )
}
