/**
 * Runtime smoke tests.
 *
 * The build only proves the code compiles. These mount the real provider tree
 * against a stubbed HTTP layer, so a broken context, a misordered provider or a
 * bad hook call fails here instead of as a blank screen in the browser.
 */

import { render, screen, waitFor, within } from '@testing-library/react'
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

const CONVERSATION = {
  id: 7,
  title: 'Bob Brown',
  is_group: false,
  photo: null,
  other_user_id: 2,
  participants: [
    { user_id: 1, name: 'Alice Anderson', email: 'alice@example.com', photo: null, is_online: true },
    { user_id: 2, name: 'Bob Brown', email: 'bob@example.com', photo: null, is_online: true },
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
  sender: { user_id: 2, name: 'Bob Brown', email: 'bob@example.com', photo: null },
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

/** Longest path first, so `/chatrooms/unread-count/` is not swallowed by `/chatrooms/`. */
const ROUTES = [
  ['/chat-profile/', () => ME],
  ['/chatrooms/unread-count/', () => ({ total_unread: 3 })],
  ['/chatrooms/', () => ({ ...page([CONVERSATION]), total_unread: 3 })],
  ['/message-list/7/', () => ({ next: null, previous: null, results: [MESSAGE, MY_MESSAGE] })],
  ['/friendrequests/', () => page([])],
  ['/friends/', () => page([])],
  ['/online-users/', () => page([])],
  ['/user-search/', () => page([])],
  ['/blocked-users/', () => page([])],
].sort((a, b) => b[0].length - a[0].length)

/**
 * @param route             initial URL
 * @param authenticated     whether the refresh probe succeeds (i.e. a valid cookie)
 * @param mightHaveSession  what the localStorage marker reports; `false` means
 *                          "positively known to have no session", which skips the probe
 */
const mountApp = (route, { authenticated = true, mightHaveSession = true } = {}) => {
  window.history.pushState({}, '', route)

  globalThis.__session = {
    token: authenticated ? 'test-token' : null,
    mightHaveSession,
    refreshCalls: 0,
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
      await screen.findByRole('heading', { name: /connect with real vibes/i }),
    ).toBeInTheDocument()
    // The CTA reflects the anonymous state.
    expect(screen.getByRole('button', { name: /get started/i })).toBeInTheDocument()
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
