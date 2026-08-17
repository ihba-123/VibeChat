import { Moon, Sun } from 'lucide-react'

import { useTheme } from '../hooks/ui'
import { cn } from '../lib/utils'
import { IconButton } from './ui'

/** Icon scales with the button, so `size="lg"` actually reads as larger. */
const ICON_SIZES = { sm: 'h-5 w-5', md: 'h-6 w-6', lg: 'h-7 w-7' }

export default function ThemeToggle({ size = 'md', className }) {
  const { isDark, toggle } = useTheme()
  const iconClass = cn(ICON_SIZES[size] ?? ICON_SIZES.md)

  return (
    <IconButton
      label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={toggle}
      size={size}
      className={className}
    >
      {isDark ? <Sun className={iconClass} /> : <Moon className={iconClass} />}
    </IconButton>
  )
}
