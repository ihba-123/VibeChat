import { Moon, Sun } from 'lucide-react'

import { useTheme } from '../hooks/ui'
import { IconButton } from './ui'

/**
 * Theme switch.
 *
 * No size prop and no private size map. This is primary chrome wherever it
 * appears — the rail, the sidebar header, the auth screens — so it uses the same
 * 40px target and 24px glyph as every other chrome control. It previously carried
 * its own `ICON_SIZES` lookup, which is exactly how it ended up smaller than the
 * buttons beside it.
 *
 * Both glyphs are always mounted and cross-faded. Rendering one *or* the other
 * unmounted a node and mounted a different one in the same frame, so the icon
 * blanked while the rest of the page was still fading — a visible blink against
 * an otherwise smooth transition.
 */
export default function ThemeToggle({ className }) {
  const { isDark, toggle } = useTheme()

  return (
    <IconButton
      label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={toggle}
      className={className}
    >
      <span className="relative grid icon-lg place-items-center">
        <Sun
          aria-hidden="true"
          className={`icon-lg col-start-1 row-start-1 transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none ${
            isDark ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-75 opacity-0'
          }`}
        />
        <Moon
          aria-hidden="true"
          className={`icon-lg col-start-1 row-start-1 transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none ${
            isDark ? 'rotate-90 scale-75 opacity-0' : 'rotate-0 scale-100 opacity-100'
          }`}
        />
      </span>
    </IconButton>
  )
}
