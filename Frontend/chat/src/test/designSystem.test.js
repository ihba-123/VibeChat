/**
 * Guards the theme tokens against erosion.
 *
 * These are static checks over the source, not rendering tests, because the thing
 * being protected is the *system*: one palette, one elevation scale, one set of
 * status colours. A single `text-red-500` added in a hurry does not break any
 * behaviour and no rendering test would notice — it just quietly puts one screen
 * on a different palette from the rest, and that is exactly how a design system
 * turns back into a pile of individually styled pages.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CSS = readFileSync(join(SRC, 'index.css'), 'utf8')

/**
 * Files excluded from the palette sweep.
 *
 * The five marketing components are the old long-form landing page: nothing
 * imports them any more (the landing page was rebuilt as a single screen), so
 * holding them to the system would be policing dead code.
 */
const DEAD_MARKETING = ['Navbar.jsx', 'Hero.jsx', 'Features.jsx', 'Demo.jsx', 'Footer.jsx']

const walk = (dir) =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return entry === 'test' ? [] : walk(full)
    return full.endsWith('.jsx') && !DEAD_MARKETING.includes(entry) ? [full] : []
  })

const components = walk(SRC).map((file) => ({
  path: relative(SRC, file).replace(/\\/g, '/'),
  source: readFileSync(file, 'utf8'),
}))

describe('theme tokens', () => {
  it('has both themes defining every token the other does', () => {
    const names = (selector) => {
      // The palette block, not the font-stack `:root` that precedes it.
      const blocks = CSS.split(`${selector} {`).slice(1)
      const body = blocks.find((block) => block.includes('--surface:'))
      expect(body, `no palette block for ${selector}`).toBeDefined()
      return new Set(
        [...body.slice(0, body.indexOf('\n}')).matchAll(/^\s*(--[a-z0-9-]+):/gm)].map(
          (match) => match[1],
        ),
      )
    }

    // Geometry, not colour: the corner radius is the same in both themes, so it is
    // declared once and inherited. Every *colour* token has to exist in both.
    const THEME_INVARIANT = new Set(['--radius'])

    const light = names(':root')
    const dark = names('.dark')

    // A token defined in one theme only silently falls back to the other theme's
    // value — or to nothing — on whichever screens happen to use it.
    expect([...light].filter((token) => !dark.has(token) && !THEME_INVARIANT.has(token))).toEqual(
      [],
    )
    expect([...dark].filter((token) => !light.has(token))).toEqual([])
  })

  it('keeps pure white and pure black out of the light palette', () => {
    const body = CSS.split(':root {')
      .slice(1)
      .find((block) => block.includes('--surface:'))

    // `oklch(1 0 0)` is #fff and `oklch(0 0 0)` is #000. The brightest surface is
    // 0.995 and the darkest text 0.225 — deliberately, so nothing in light mode is
    // maximally bright or maximally dark.
    expect(body).not.toMatch(/oklch\(1 0 0\s*\)/)
    expect(body).not.toMatch(/oklch\(0 0 0\s*\)/)
  })

  it('routes every shadow utility through the elevation scale', () => {
    for (const step of ['sm', 'md', 'lg', 'xl', '2xl']) {
      expect(CSS).toMatch(new RegExp(`--shadow-${step}:\\s*var\\(--elev-\\d\\)`))
    }
  })
})

describe('component styling stays on the system', () => {
  /** Raw palette colours that have a token equivalent. */
  const RAW_COLOUR = /\b(?:bg|text|border|ring|from|via|to)-(?:red|emerald|green|amber|yellow|orange|blue|indigo|violet|purple|slate|gray|zinc|neutral|stone)-\d{2,3}\b/g

  it('uses status tokens instead of raw palette colours', () => {
    const offenders = components.flatMap(({ path, source }) =>
      (source.match(RAW_COLOUR) ?? []).map((match) => `${path}: ${match}`),
    )
    expect(offenders).toEqual([])
  })

  /**
   * `text-white` and `bg-black` are allowed in exactly two places, both of which
   * are theme-independent by design: controls sitting on the lightbox's black
   * scrim, and avatar initials on a generated accent fill. Anywhere else they are
   * a colour that ignores the theme.
   */
  it('confines white and black literals to surfaces that are never themed', () => {
    const ALLOWED = ['components/chat/ImageLightbox.jsx', 'components/ui.jsx']
    const offenders = components
      .filter(({ path }) => !ALLOWED.includes(path))
      .filter(({ source }) => /\b(?:bg|text|border)-(?:white|black)\b/.test(source))
      .map(({ path }) => path)

    expect(offenders).toEqual([])
  })
})
