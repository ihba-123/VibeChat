/**
 * Runtime smoke tests.
 *
 * The build only proves the code compiles. These mount the real provider tree
 * against a stubbed HTTP layer, so a broken context, a misordered provider or a
 * bad hook call fails here instead of as a blank screen in the browser.
 */

import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The mock delegates to `globalThis.__session` on every call rather than copying
 * it once. A factory that spreads the object is evaluated a single time, which
 * would freeze whatever the first test happened to configure and make every later
 * test run against it.
 */
vi.mock('../api/client', async () => {
  const actual = await vi.importActual('../api/client')
  const session = () => globalThis.__session
  return {
    ...actual,
    getAccessToken: () => session().token,
    setAccessToken: () => {},
    onAuthLost: () => () => {},
    // Stands in for the localStorage marker that decides whether the app bothers
    // probing /refresh-token/ on boot.
    mightHaveSession: () => session().mightHaveSession,
    // The stricter marker the landing guard uses to decide whether holding the
    // first paint is justified.
    hadSession: () => session().hadSession,
    markNoSession: () => {},
    refreshAccessToken: () => {
      session().refreshCalls += 1
      return session().refresh()
    },
    http: {
      get: (url) => session().request('get', url),
      post: (url, body) => session().request('post', url, body),
      patch: (url, body) => session().request('patch', url, body),
      put: (url, body) => session().request('put', url, body),
      delete: (url) => session().request('delete', url),
    },
  }
})

import FullScreenLoader from '../components/FullScreenLoader'
import { setViewport } from './setup'
import TestRoot from './TestRoot'

const page = (results = []) => ({ count: results.length, next: null, previous: null, results })

const ME = {
  id: 1,
  user_id: 1,
  name: 'Alice Anderson',
  email: 'alice@example.com',
  bio: 'Testing.',
  photo: null,
  is_online: true,
  friend_count: 1,
}

/** Bob's current avatar, as a refetched source reports it. */
const BOB_CURRENT_PHOTO = 'http://localhost:8000/media/avatars/bob-current.png'
/** The URL frozen into message rows fetched before he changed it. */
const BOB_STALE_PHOTO = 'http://localhost:8000/media/avatars/bob-old.png'

const CONVERSATION = {
  id: 7,
  title: 'Bob Brown',
  is_group: false,
  photo: null,
  other_user_id: 2,
  participants: [
    { user_id: 1, name: 'Alice Anderson', email: 'alice@example.com', photo: null, is_online: true },
    {
      user_id: 2,
      name: 'Bob Brown',
      email: 'bob@example.com',
      photo: BOB_CURRENT_PHOTO,
      is_online: true,
    },
  ],
  last_message: {
    id: 11,
    preview: 'Hey there',
    timestamp: '2026-01-01T10:00:00Z',
    sender_id: 2,
    sender_name: 'Bob Brown',
    is_mine: false,
  },
  unread_count: 3,
  is_online: true,
  last_activity: '2026-01-01T10:00:00Z',
  created_at: '2026-01-01T09:00:00Z',
}

const MESSAGE = {
  id: 11,
  chat_room: 7,
  sender: { user_id: 2, name: 'Bob Brown', email: 'bob@example.com', photo: BOB_STALE_PHOTO },
  sender_id: 2,
  content: 'Hey there',
  attachment: null,
  attachment_name: null,
  images: null,
  timestamp: '2026-01-01T10:00:00Z',
  is_mine: false,
  read_by_count: 1,
}

const MY_MESSAGE = {
  id: 12,
  chat_room: 7,
  sender: { user_id: 1, name: 'Alice Anderson', email: 'alice@example.com', photo: null },
  sender_id: 1,
  content: 'Replying now',
  attachment: null,
  attachment_name: null,
  images: null,
  timestamp: '2026-01-01T10:01:00Z',
  is_mine: true,
  read_by_count: 2,
}

const LONG_NAME = 'Python_Notes_X_CodeWithNischal_FVN46gX_extra_long_filename.pdf'

const ATTACHMENT_MESSAGE = {
  id: 13,
  chat_room: 7,
  sender: { user_id: 2, name: 'Bob Brown', email: 'bob@example.com', photo: null },
  sender_id: 2,
  content: '',
  attachment: 'http://localhost:8000/media/attachments/long.pdf',
  attachment_name: LONG_NAME,
  images: null,
  timestamp: '2026-01-01T10:02:00Z',
  is_mine: false,
  read_by_count: 1,
}

/** Longest path first, so `/chatrooms/unread-count/` is not swallowed by `/chatrooms/`. */
const ROUTES = [
  ['/chat-profile/', () => ME],
  ['/chatrooms/unread-count/', () => ({ total_unread: 3 })],
  ['/chatrooms/', () => ({ ...page([CONVERSATION]), total_unread: 3 })],
  [
    '/message-list/7/',
    () => ({ next: null, previous: null, results: [MESSAGE, MY_MESSAGE, ATTACHMENT_MESSAGE] }),
  ],
  ['/friendrequests/', () => page([])],
  ['/friends/', () => page([])],
  ['/online-users/', () => page([])],
  ['/user-search/', () => page([])],
  // Driven per test so the blocked state can be varied.
  ['/blocked-users/', () => page(globalThis.__session.blockedUsers)],
  ['/unblock-user/', () => ({ detail: 'User unblocked.', blocked: false })],
].sort((a, b) => b[0].length - a[0].length)

/** A row as GET /blocked-users/ returns it. */
const blockedEntry = (person) => ({
  id: 1,
  user: { user_id: person.user_id, name: person.name, email: person.email, photo: null },
  blocked_at: '2026-01-01T09:30:00Z',
})

/**
 * @param route             initial URL
 * @param authenticated     whether the refresh probe succeeds (i.e. a valid cookie)
 * @param mightHaveSession  what the localStorage marker reports; `false` means
 *                          "positively known to have no session", which skips the probe
 */
const mountApp = (
  route,
  { authenticated = true, mightHaveSession = true, hadSession = authenticated, blockedUsers = [] } = {},
) => {
  window.history.pushState({}, '', route)

  globalThis.__session = {
    token: authenticated ? 'test-token' : null,
    mightHaveSession,
    hadSession,
    refreshCalls: 0,
    blockedUsers,
    // Every request is recorded so tests can assert what the UI actually called.
    calls: [],
    // Resolved on a timer, not as an already-settled promise. This matters: a
    // microtask resolution lands before StrictMode's cleanup runs, which hides the
    // very race this suite is meant to catch. A real refresh is a network call and
    // always settles after the remount.
    refresh: () =>
      new Promise((resolve, reject) => {
        setTimeout(() => {
          if (authenticated) resolve({ token: 'test-token', user: ME })
          else reject(new Error('no session'))
        }, 20)
      }),
    request: (method, url) => {
      globalThis.__session.calls.push(`${method.toUpperCase()} ${url}`)
      const match = ROUTES.find(([path]) => url.includes(path))
      if (!match) return Promise.reject(new Error(`Unhandled ${method} ${url}`))
      return Promise.resolve(match[1]())
    },
  }

  return render(<TestRoot />)
}

beforeEach(() => {
  localStorage.clear()
})

describe('public screens', () => {
  it('renders the landing page for a visitor', async () => {
    mountApp('/', { authenticated: false })

    expect(
      await screen.findByRole('heading', { name: /chat\. connect\./i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /start chatting/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^login$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^get started$/i })).toBeInTheDocument()
  })

  it('fits the landing page in one screen with nothing below the fold', async () => {
    mountApp('/', { authenticated: false })
    await screen.findByRole('heading', { name: /chat\. connect\./i })

    // `h-dvh`, not `min-h-screen`: the latter is only a floor, so the page still
    // grows and scrolls as soon as content exceeds it. And `vh` on mobile measures
    // the viewport with the address bar expanded, which scrolls by the toolbar's
    // height. `overflow-hidden` is the backstop that makes "no scroll" literal.
    const page = document.querySelector('div.h-dvh')
    expect(page).not.toBeNull()
    expect(page).toHaveClass('overflow-hidden')
    expect(page.className).not.toMatch(/min-h-screen/)

    // The hero must be allowed to shrink. Without `min-h-0` a flex child refuses to
    // go below its content height, and the product preview pushes 1366x768 past the
    // fold — the exact failure this layout exists to avoid.
    expect(document.querySelector('main')).toHaveClass('min-h-0')
  })

  it('shows the product itself rather than a generic illustration', async () => {
    mountApp('/', { authenticated: false })
    await screen.findByRole('heading', { name: /chat\. connect\./i })

    // Exposed as one labelled image: the mock bubbles are decorative fiction and
    // would otherwise be read out as if they were a real inbox.
    const preview = await screen.findByRole('img', { name: /preview of the vibechat app/i })
    expect(preview).toBeInTheDocument()
    // Named in the conversation list, the header and the profile panel.
    expect(within(preview).getAllByText(/alex morgan/i).length).toBeGreaterThan(0)
    expect(within(preview).getByText(/type a message/i)).toBeInTheDocument()
    expect(within(preview).getByText(/hey! how are you doing\?/i)).toBeInTheDocument()
  })

  it('routes the landing CTAs into the real auth flow', async () => {
    mountApp('/', { authenticated: false })
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: /start chatting/i }))
    expect(await screen.findByRole('heading', { name: /create your account|sign up/i })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/register')
  })

  it('sends the navbar Login control to the login screen', async () => {
    mountApp('/', { authenticated: false })
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: /^login$/i }))
    expect(await screen.findByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/login')
  })

  /**
   * Features and About are dialogs, not routes. There is no /features or /about
   * page and nothing below the fold to scroll to, so a link would be dead either
   * way; this pins that they actually do something.
   */
  it('opens Features and About without leaving the page', async () => {
    mountApp('/', { authenticated: false })
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: /^features$/i }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/real-time messaging/i)).toBeInTheDocument()
    expect(window.location.pathname).toBe('/')

    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('sends an unauthenticated visitor from /app to the login screen', async () => {
    mountApp('/app', { authenticated: false })

    expect(await screen.findByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument()
  })

  it('validates the login form before calling the API', async () => {
    mountApp('/login', { authenticated: false })
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: /^sign in$/i }))

    expect(await screen.findByText(/email is required/i)).toBeInTheDocument()
    expect(screen.getByText(/password is required/i)).toBeInTheDocument()
  })

  it('has no theme switch on the landing page', async () => {
    mountApp('/', { authenticated: false })

    await screen.findByRole('heading', { name: /chat\. connect\./i })
    expect(
      screen.queryByRole('button', { name: /toggle theme|switch to (light|dark) mode/i }),
    ).not.toBeInTheDocument()
  })

  /**
   * The theme belongs to the signed-in app. It used to be applied in App for every
   * route, so a dark preference followed the user out to the public pages after they
   * signed out — the landing screen pins its own palette and the auth screens should
   * not inherit whatever the last person on this browser picked.
   */
  it('does not apply the saved theme to public screens', async () => {
    localStorage.setItem('theme', 'dark')
    mountApp('/', { authenticated: false })

    await screen.findByRole('heading', { name: /chat\. connect\./i })
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('does not apply it to the sign-in screen either', async () => {
    localStorage.setItem('theme', 'dark')
    mountApp('/login', { authenticated: false })

    await screen.findByRole('heading', { level: 1, name: /welcome back/i })
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('applies the saved theme once inside the app', async () => {
    localStorage.setItem('theme', 'dark')
    mountApp('/app')

    await screen.findByRole('button', { name: /account menu/i })
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('keeps the theme switch inside the signed-in shell', async () => {
    mountApp('/app')

    expect(await screen.findByRole('heading', { name: /^chats$/i })).toBeInTheDocument()
    expect(
      screen.getAllByRole('button', { name: /switch to (light|dark) mode/i }).length,
    ).toBeGreaterThan(0)
  })

  it('renders a 404 for an unknown route', async () => {
    mountApp('/nope', { authenticated: false })
    expect(await screen.findByText('404')).toBeInTheDocument()
  })
})

describe('session bootstrap', () => {
  it('finishes loading and lands on the app when a session is restored', async () => {
    mountApp('/app')

    // Under StrictMode the effect runs, is cleaned up, and runs again. A bootstrap
    // that cancels itself in cleanup leaves status at 'loading' and this splash
    // screen never goes away.
    expect(await screen.findByRole('heading', { name: /^chats$/i })).toBeInTheDocument()
    expect(screen.queryByText(/restoring your session/i)).not.toBeInTheDocument()
  })

  it('still restores a session when the local marker is missing', async () => {
    // A browser holding a valid cookie whose marker was never written — cleared
    // storage, or a build predating the marker. Treating "unknown" as "signed out"
    // logs the user out and lets them back onto the login screen.
    mountApp('/app', { authenticated: true, mightHaveSession: true })

    expect(await screen.findByRole('heading', { name: /^chats$/i })).toBeInTheDocument()
  })

  it('skips the refresh probe when there is positively no session', async () => {
    mountApp('/login', { authenticated: false, mightHaveSession: false })

    expect(await screen.findByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
    // No request means no 401 and no server-side warning for anonymous visitors.
    expect(globalThis.__session.refreshCalls).toBe(0)
  })

  it('probes when the marker is unknown rather than assuming signed out', async () => {
    mountApp('/login', { authenticated: false, mightHaveSession: true })

    await screen.findByRole('heading', { name: /welcome back/i })
    expect(globalThis.__session.refreshCalls).toBeGreaterThan(0)
  })
})

describe('route protection', () => {
  it('keeps a signed-in user off the login screen', async () => {
    mountApp('/login')

    expect(await screen.findByRole('heading', { name: /^chats$/i })).toBeInTheDocument()
    expect(screen.queryByLabelText(/^email$/i)).not.toBeInTheDocument()
    expect(window.location.pathname).toBe('/app')
  })

  it('keeps a signed-in user off the register screen', async () => {
    mountApp('/register')

    expect(await screen.findByRole('heading', { name: /^chats$/i })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/app')
  })

  it('keeps a signed-in user off the forgot-password screen', async () => {
    mountApp('/forgot-password')

    expect(await screen.findByRole('heading', { name: /^chats$/i })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/app')
  })

  it('remembers where an unauthenticated user was heading', async () => {
    mountApp('/app/c/7', { authenticated: false, mightHaveSession: false })

    expect(await screen.findByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/login')
  })
})

describe('mobile chat layout (390px)', () => {
  // One pane at a time on a phone: the conversation list and an open conversation
  // must never be on screen together, and there must always be a way back.
  it('shows the conversation list and no composer at /app', async () => {
    setViewport(390)
    mountApp('/app')

    expect(await screen.findByRole('heading', { name: /^chats$/i })).toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/write a message/i)).not.toBeInTheDocument()
  })

  it('replaces the list with the conversation when one is open', async () => {
    setViewport(390)
    mountApp('/app/c/7')

    expect(await screen.findByPlaceholderText(/write a message/i)).toBeInTheDocument()
    // The sidebar heading must be gone, not merely visually hidden.
    expect(screen.queryByRole('heading', { name: /^chats$/i })).not.toBeInTheDocument()
  })

  it('offers a back control out of an open conversation', async () => {
    setViewport(390)
    mountApp('/app/c/7')

    await screen.findByPlaceholderText(/write a message/i)
    expect(
      screen.getByRole('button', { name: /back to conversations/i }),
    ).toBeInTheDocument()
  })

  it('keeps both panes together on a desktop viewport', async () => {
    setViewport(1280)
    mountApp('/app/c/7')

    // The contrast with the phone case: list and conversation side by side.
    expect(await screen.findByRole('heading', { name: /^chats$/i })).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/write a message/i)).toBeInTheDocument()
  })
})

describe('signed-in shell', () => {
  it('renders the conversation sidebar with preview and unread badge', async () => {
    mountApp('/app')

    const row = await screen.findByRole('button', { name: /Bob Brown/i })
    // A direct chat shows the message alone; only group rows prefix the sender.
    expect(within(row).getByText('Hey there')).toBeInTheDocument()
    expect(within(row).getByText('3')).toBeInTheDocument()

    expect(
      await screen.findByRole('heading', { name: /welcome back, alice/i }),
    ).toBeInTheDocument()
  })

  it('opens a conversation and renders its history', async () => {
    mountApp('/app/c/7')

    await waitFor(() =>
      expect(screen.getAllByText('Hey there').length).toBeGreaterThan(0),
    )
    expect(screen.getByPlaceholderText(/write a message/i)).toBeEnabled()
    expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument()
  })

  it('shows an optimistic bubble the moment a message is sent', async () => {
    mountApp('/app/c/7')
    const user = userEvent.setup()

    const composer = await screen.findByPlaceholderText(/write a message/i)
    await user.type(composer, 'Hello from the test')
    await user.click(screen.getByRole('button', { name: /send message/i }))

    // Rendered with no server round trip, and the input clears straight away.
    expect(await screen.findByText('Hello from the test')).toBeInTheDocument()
    expect(composer).toHaveValue('')
  })

  it('offers a visible way to remove a chosen image before sending', async () => {
    mountApp('/app/c/7')
    const user = userEvent.setup()

    await screen.findByPlaceholderText(/write a message/i)

    const file = new File(['pretend-bytes'], 'holiday.png', { type: 'image/png' })
    // The input is hidden behind the paperclip/image buttons, so upload straight to it.
    const imageInput = document.querySelector('input[type="file"][accept="image/*"]')
    await user.upload(imageInput, file)

    expect(await screen.findByText('holiday.png')).toBeInTheDocument()

    // Two affordances: a cross on the thumbnail and a labelled button beside it.
    const removeControls = screen.getAllByRole('button', { name: /remove holiday\.png/i })
    expect(removeControls.length).toBe(2)

    await user.click(removeControls[0])
    expect(screen.queryByText('holiday.png')).not.toBeInTheDocument()
  })

  it('offers a remove control for a document attachment too', async () => {
    mountApp('/app/c/7')
    const user = userEvent.setup()

    await screen.findByPlaceholderText(/write a message/i)

    const doc = new File(['x'], 'report.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })
    const fileInput = Array.from(document.querySelectorAll('input[type="file"]')).find(
      (input) => !input.accept,
    )
    await user.upload(fileInput, doc)

    expect(await screen.findByText('report.docx')).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: /remove report\.docx/i })[0])
    expect(screen.queryByText('report.docx')).not.toBeInTheDocument()
  })

  it('anchors incoming and outgoing messages to opposite sides', async () => {
    mountApp('/app/c/7')

    // Scoped to the chat pane: the sidebar preview repeats the message text.
    const pane = () => within(document.querySelector('main'))
    // The composer mounts before the history arrives, so wait on a message.
    await waitFor(() => expect(pane().getByText('Replying now')).toBeInTheDocument())

    // Walk up from the text to the row that carries the justification.
    const rowFor = (text) => pane().getByText(text).closest('div.flex.w-full')

    const incoming = rowFor('Hey there')
    const outgoing = rowFor('Replying now')

    expect(incoming).toHaveClass('justify-start')
    expect(outgoing).toHaveClass('justify-end')
    // Full-width rows are what make those justifications reach opposite edges; a
    // centred max-width column pulled both sides into the middle of the pane.
    expect(incoming).toHaveClass('w-full')
    expect(outgoing).toHaveClass('w-full')

    // The width of the scrolling column is deliberately not asserted: jsdom does no
    // layout, so "the row spans the pane" is unmeasurable here. The checkable
    // contract is that the two sides carry opposite justification on a full-width
    // row, which is what the assertions above cover.
  })

  it('shows an avatar on both incoming and outgoing messages', async () => {
    mountApp('/app/c/7')

    const pane = () => within(document.querySelector('main'))
    await waitFor(() => expect(pane().getByText('Replying now')).toBeInTheDocument())

    const rowFor = (text) => pane().getByText(text).closest('div.flex.w-full')

    // Each side renders its sender's avatar; the fallback is an initials badge, so
    // assert on that rather than on an <img> that may not exist.
    expect(within(rowFor('Hey there')).getByText('BB')).toBeInTheDocument()
    expect(within(rowFor('Replying now')).getByText('AA')).toBeInTheDocument()
  })

  it('keeps a long attachment filename from widening the message', async () => {
    mountApp('/app/c/7')

    const pane = () => within(document.querySelector('main'))
    await waitFor(() => expect(pane().getByText(LONG_NAME)).toBeInTheDocument())

    const filename = pane().getByText(LONG_NAME)
    // truncate is what clips it; min-w-0 on the flex parent is what lets truncate
    // engage instead of the text forcing the card wider.
    expect(filename).toHaveClass('truncate')
    expect(filename.parentElement).toHaveClass('min-w-0')
    expect(filename.parentElement).toHaveClass('flex-1')

    // The card fills the bubble and shrinks with it.
    const card = filename.closest('a')
    expect(card).toHaveClass('min-w-0')
    expect(card).toHaveClass('max-w-full')
    // The full name stays reachable even though it is visually clipped.
    expect(card).toHaveAttribute('title', LONG_NAME)

    // And the bubble itself cannot be exceeded by anything inside it.
    const bubble = card.closest('div.rounded-2xl')
    expect(bubble).toHaveClass('max-w-full')
    expect(bubble).toHaveClass('overflow-hidden')
  })

  it('offers Unblock in place of the composer for someone you blocked', async () => {
    mountApp('/app/c/7', {
      blockedUsers: [blockedEntry({ user_id: 2, name: 'Bob Brown', email: 'bob@example.com' })],
    })
    const user = userEvent.setup()

    // The composer is replaced, not merely disabled, and it explains why.
    expect(await screen.findByText(/you blocked bob brown/i)).toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/write a message/i)).not.toBeInTheDocument()

    // The remedy sits where the composer was, rather than only in a header menu.
    const unblock = screen.getByRole('button', { name: /^unblock$/i })
    await user.click(unblock)

    await waitFor(() =>
      expect(globalThis.__session.calls).toContain('DELETE /unblock-user/2/'),
    )
  })

  it('shows the composer normally when nobody is blocked', async () => {
    mountApp('/app/c/7')

    expect(await screen.findByPlaceholderText(/write a message/i)).toBeEnabled()
    expect(screen.queryByRole('button', { name: /^unblock$/i })).not.toBeInTheDocument()
  })

  it('switches the sidebar to the people panel', async () => {
    mountApp('/app')
    const user = userEvent.setup()

    // Rail and mobile nav both expose a People control; either one will do.
    const [peopleButton] = await screen.findAllByRole('button', { name: /^people$/i })
    await user.click(peopleButton)

    expect(await screen.findByPlaceholderText(/search people/i)).toBeInTheDocument()
  })

  it('renders the settings screen with the profile form populated', async () => {
    mountApp('/app/settings')

    expect(await screen.findByRole('heading', { name: /^settings$/i })).toBeInTheDocument()
    expect(await screen.findByLabelText(/display name/i)).toHaveValue('Alice Anderson')
    expect(screen.getByLabelText(/^bio$/i)).toHaveValue('Testing.')
  })
})

/**
 * Reads the Tailwind z-index utility off an element, or null when it carries none.
 *
 * Class names rather than computed style on purpose: jsdom does not run Tailwind,
 * so `getComputedStyle(...).zIndex` is empty for every element here and would make
 * these assertions vacuously pass.
 */
const zIndexOf = (element) => {
  const match = /(?:^|\s)z-(?:\[(\d+)\]|(\d+))(?:\s|$)/.exec(element?.className ?? '')
  return match ? Number(match[1] ?? match[2]) : null
}

describe('overlay stacking', () => {
  beforeEach(() => setViewport(1280))

  /**
   * The account menu lives inside the icon rail, and the rail is a `glass` surface —
   * so `backdrop-filter` makes it a stacking context and the menu's own z-index
   * ranks it only among the rail's children. The sidebar beside it is another glass
   * surface later in the DOM, which is why the menu was painting *behind* it.
   *
   * The fix is that the rail outranks the sidebar, so this asserts the relationship
   * between the two containers, not the menu's own z-index.
   */
  it('opens the account menu above the sidebar rather than behind it', async () => {
    mountApp('/app')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: /account menu/i }))

    const menu = await screen.findByRole('menu')
    expect(within(menu).getByRole('menuitem', { name: /settings/i })).toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: /sign out/i })).toBeInTheDocument()

    const rail = menu.closest('nav')
    const sidebar = document.querySelector('aside')
    expect(rail).not.toBeNull()
    expect(sidebar).not.toBeNull()

    // Both must be ranked; a glass surface with no z-index loses to any later sibling.
    expect(zIndexOf(rail)).toBeGreaterThan(0)
    expect(zIndexOf(sidebar)).toBeGreaterThan(0)
    expect(zIndexOf(rail)).toBeGreaterThan(zIndexOf(sidebar))
  })

  /** Same trap: the conversation menu is trapped inside the glass chat header. */
  it('ranks the chat header above the sidebar it sits beside', async () => {
    mountApp('/app/c/7')

    await screen.findByPlaceholderText(/write a message/i)

    const header = document.querySelector('main header')
    const sidebar = document.querySelector('aside')
    expect(zIndexOf(header)).toBeGreaterThan(zIndexOf(sidebar))
  })
})

describe('confirming destructive actions', () => {
  beforeEach(() => setViewport(1280))

  it('does not block anyone until the prompt is confirmed', async () => {
    mountApp('/app/c/7')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: /conversation options/i }))
    await user.click(await screen.findByRole('menuitem', { name: /^block$/i }))

    // The prompt names the person, so it cannot be dismissed as boilerplate.
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/block bob brown\?/i)).toBeInTheDocument()
    expect(globalThis.__session.calls).not.toContain('POST /block-user/2/')

    // Backing out leaves the account untouched.
    await user.click(within(dialog).getByRole('button', { name: /^cancel$/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(globalThis.__session.calls).not.toContain('POST /block-user/2/')

    // Confirming goes through.
    await user.click(screen.getByRole('button', { name: /conversation options/i }))
    await user.click(await screen.findByRole('menuitem', { name: /^block$/i }))
    const retry = await screen.findByRole('dialog')
    await user.click(within(retry).getByRole('button', { name: /^block$/i }))

    await waitFor(() => expect(globalThis.__session.calls).toContain('POST /block-user/2/'))
  })

  it('asks before signing out from the rail', async () => {
    mountApp('/app')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: /account menu/i }))
    await user.click(await screen.findByRole('menuitem', { name: /sign out/i }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/sign out\?/i)).toBeInTheDocument()
    expect(globalThis.__session.calls).not.toContain('POST /logout/')
  })
})

describe('avatars stay current in old conversations', () => {
  beforeEach(() => setViewport(1280))

  /**
   * Message rows are cached in memory and persisted to localStorage, so they are
   * deliberately never refetched — which froze the sender's avatar at whatever it
   * was when that page was first loaded. Changing your picture then left the same
   * person showing one avatar in the message list and another in the sidebar.
   *
   * The fixture reproduces exactly that: the message row carries the old URL while
   * the conversation payload (which *is* refetched) carries the current one.
   */
  it('renders the current avatar, not the one frozen into the cached message', async () => {
    mountApp('/app/c/7')

    const pane = () => within(document.querySelector('main'))
    await waitFor(() => expect(pane().getByText('Hey there')).toBeInTheDocument())

    const row = pane().getByText('Hey there').closest('div.flex.w-full')
    const avatar = within(row).getByRole('img', { name: /bob brown/i })

    expect(avatar).toHaveAttribute('src', BOB_CURRENT_PHOTO)
    expect(avatar).not.toHaveAttribute('src', BOB_STALE_PHOTO)
  })
})

describe('the landing page is not a way back out', () => {
  beforeEach(() => setViewport(1280))

  /**
   * The reported escape hatch: sign in, then delete `/app` from the address bar.
   * `/` used to sit outside every guard, so it rendered the public marketing page
   * to a fully signed-in user — no logout, no redirect.
   */
  it('sends a signed-in user from / back into the app', async () => {
    mountApp('/')

    expect(await screen.findByRole('button', { name: /account menu/i })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/app')
    expect(screen.queryByRole('heading', { name: /chat\. connect\./i })).toBeNull()
    expect(screen.queryByRole('button', { name: /start chatting/i })).toBeNull()
  })

  /** Replaces rather than pushes, so Back does not bounce between / and /app. */
  it('does not leave the public page in history behind it', async () => {
    mountApp('/')
    await screen.findByRole('button', { name: /account menu/i })

    window.history.back()
    await waitFor(() => expect(window.location.pathname).not.toBe('/'))
  })

  /**
   * The other half of the guard, and the reason it is not simply PublicOnlyRoute:
   * a visitor who has never signed in must not wait behind a bootstrap probe to see
   * the marketing page.
   */
  it('paints the landing page immediately for a first-time visitor', async () => {
    mountApp('/', { authenticated: false, hadSession: false })

    expect(
      await screen.findByRole('heading', { name: /chat\. connect\./i }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/restoring your session/i)).toBeNull()
  })
})

describe('the theme switch belongs to the signed-in app only', () => {
  const THEME_CONTROL = /switch to (light|dark) mode/i

  it.each([
    ['login', '/login'],
    ['register', '/register'],
    ['forgot-password', '/forgot-password'],
  ])('has no theme switch on the %s screen', async (_label, route) => {
    mountApp(route, { authenticated: false })

    // Wait for the form's own heading — level 1, so this targets the card and not
    // the poster's h2, which jsdom renders regardless of the `hidden lg:flex` that
    // hides it in a real browser. Waiting for something concrete stops the
    // assertion passing against a route that has not finished lazy-loading.
    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByRole('button', { name: THEME_CONTROL })).toBeNull()
  })

  it('still offers it inside the app', async () => {
    mountApp('/app')

    expect(await screen.findAllByRole('button', { name: THEME_CONTROL })).not.toHaveLength(0)
  })
})

describe('split auth layout', () => {
  beforeEach(() => setViewport(1280))

  it('pairs the sign-in form with the product poster', async () => {
    mountApp('/login', { authenticated: false })

    expect(await screen.findByRole('heading', { level: 1, name: /welcome back/i })).toBeInTheDocument()

    // The poster is the product visual and nothing else — the only words on this
    // screen belong to the form, so there is exactly one heading.
    expect(screen.getAllByRole('heading')).toHaveLength(1)
    expect(screen.getByRole('img', { name: /preview of the vibechat app/i })).toBeInTheDocument()
  })

  /**
   * Sign-in and sign-up must not be the same still image twice. The accessible name
   * carries the scene's subject, so comparing labels catches a shared scene without
   * reaching into the markup.
   */
  it('gives sign-in and sign-up different posters', async () => {
    mountApp('/login', { authenticated: false })
    await screen.findByRole('heading', { level: 1, name: /welcome back/i })
    const onLogin = screen.getByRole('img', { name: /preview of the vibechat app/i })
      .getAttribute('aria-label')

    cleanup()

    mountApp('/register', { authenticated: false })
    await screen.findByRole('heading', { level: 1 })
    const onRegister = screen.getByRole('img', { name: /preview of the vibechat app/i })
      .getAttribute('aria-label')

    expect(onLogin).not.toBe(onRegister)
    expect(onLogin).toMatch(/alex morgan/i)
    expect(onRegister).toMatch(/design team/i)
  })

  /**
   * The auth screens paint the landing page's ground, so arriving from `/` is
   * continuous rather than a jump from a dark marketing page to a pale form. Pinned
   * on the page root, which is also what makes these screens independent of the
   * theme preference the signed-in app owns.
   */
  it('paints the whole auth screen on the landing ground', async () => {
    localStorage.setItem('theme', 'light')
    mountApp('/login', { authenticated: false })

    const heading = await screen.findByRole('heading', { level: 1, name: /welcome back/i })

    // The form itself, not just the poster, sits inside the pinned surface — and it
    // stays that way with a light preference stored.
    const surface = heading.closest('.dark')
    expect(surface).not.toBeNull()
    expect(surface.contains(document.querySelector('aside'))).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})

describe('loading screens never fall back to white', () => {
  /**
   * The public loaders used to resolve `bg-background` against the base tokens,
   * which is a near-white ground — so a refresh flashed white before the dark page
   * it was loading. Outside the signed-in app there is no theme to follow, so they
   * pin the same ground the landing page paints.
   */
  it('paints the public loader on the landing ground', () => {
    const { unmount } = render(<FullScreenLoader />)
    const surface = screen.getByRole('status').closest('div.min-h-dvh')

    expect(surface).toHaveClass('dark')
    expect(surface).toHaveClass('bg-background')
    unmount()
  })

  /** In the app there *is* a theme, and pinning dark would fight a light one. */
  it('lets the in-app loader follow the applied theme', () => {
    const { unmount } = render(<FullScreenLoader surface="app" />)
    const surface = screen.getByRole('status').closest('div.min-h-dvh')

    expect(surface).not.toHaveClass('dark')
    expect(surface).toHaveClass('bg-background')
    unmount()
  })
})

describe('startup splash', () => {
  it('shows the brand mark and no other chrome', () => {
    const { unmount } = render(<FullScreenLoader />)

    expect(screen.getByRole('img', { name: /vibechat/i })).toBeInTheDocument()

    // The caption is announced but never drawn: removing the visible text was a
    // visual decision, leaving a screen-reader user on a silent unlabelled screen
    // would not be. `sr-only` is the difference between the two.
    const status = screen.getByRole('status')
    expect(status).toHaveClass('sr-only')
    expect(status).toHaveTextContent(/restoring|loading|finishing/i)

    unmount()
  })

  it('passes the caller label through to assistive tech', () => {
    const { unmount } = render(<FullScreenLoader label="Restoring your session" />)
    expect(screen.getByRole('status')).toHaveTextContent(/restoring your session/i)
    unmount()
  })

  /**
   * The trace loops by construction, not by luck: `pathLength="1"` normalises the
   * stroke so the dash pattern in CSS sums to exactly one path length, and the light
   * re-enters the start at the instant it leaves the end. Drop the attribute and the
   * dash pattern is measured against the path's real length instead, which does not
   * divide evenly and puts a visible jump at the loop point.
   */
  it('normalises the traced stroke so the loop has no seam', () => {
    const { unmount } = render(<FullScreenLoader />)

    const traced = document.querySelector('path.vibe-mark-trace')
    expect(traced).not.toBeNull()
    expect(traced.getAttribute('pathLength')).toBe('1')

    // A dim resting stroke sits behind it, so the mark never fully disappears.
    expect(document.querySelectorAll('svg path')).toHaveLength(2)

    unmount()
  })
})

describe('splash ground follows the session', () => {
  /**
   * Once signed in, the splash is part of the app and must obey the toggle. It used
   * to pin the public dark ground everywhere, so a light-theme user got a dark flash
   * whenever a lazily-loaded screen or the session restore put it on screen.
   */
  it('does not pin the public ground while restoring a session', () => {
    localStorage.setItem('theme', 'light')
    mountApp('/app')

    // Rendered synchronously: the bootstrap refresh resolves on a timer, so the
    // restoring state is what is on screen the moment after mount.
    const [status] = screen.getAllByRole('status')
    expect(status.closest('div.min-h-dvh')).not.toHaveClass('dark')
  })
})

describe('theme ground across the session boundary', () => {
  /**
   * The refresh flash was three grounds in a row: the inline dark style, then white
   * the moment index.css landed and `body { background: var(--background) }` resolved
   * against the light base palette, then dark again when React applied the theme.
   *
   * The first two are fixed by the boot script in index.html, which sets the class
   * before the stylesheet can paint. This covers the other half — that leaving the
   * app returns the document to the *public* ground rather than to the light base,
   * which is what left a pale document behind pages that pin their own dark surface.
   */
  it('applies the theme in the app and restores the public ground on the way out', async () => {
    localStorage.setItem('theme', 'light')
    mountApp('/app')

    await screen.findByRole('button', { name: /account menu/i })
    expect(document.documentElement.classList.contains('dark')).toBe(false)

    // Unmounting the tree is what signing out does to the protected area.
    cleanup()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.style.colorScheme).toBe('dark')
  })

  /**
   * The boot script writes an inline background so the first paint is never the
   * browser's white canvas. Inline styles outrank the stylesheet, so it has to be
   * released once the app owns the theme — otherwise a light theme keeps a dark
   * <html> behind it for the rest of the session.
   */
  it('hands the ground back to the stylesheet once the theme is applied', async () => {
    document.documentElement.style.backgroundColor = 'oklch(0.11 0 0)'
    localStorage.setItem('theme', 'dark')
    mountApp('/app')

    await screen.findByRole('button', { name: /account menu/i })
    expect(document.documentElement.style.backgroundColor).toBe('')
  })
})
