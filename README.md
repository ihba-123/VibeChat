# VibeChat

Real-time chat: Django + Channels + PostgreSQL + Redis on the back end, React + Vite
on the front end. Messages are encrypted at rest, delivered over a single
multiplexed WebSocket per user, and cached client-side so the UI paints instantly.

---

## Running it

### 1. Backend

```bash
cd Backend
python -m venv env
env/Scripts/activate          # Windows;  source env/bin/activate on macOS/Linux
pip install -r requirements.txt

cp .env.example .env          # then fill in the blanks (see below)
cd System
python manage.py migrate
python manage.py runserver    # ASGI via Daphne, http://127.0.0.1:8000
```

Required in `Backend/.env`:

| Variable | Notes |
| --- | --- |
| `SECRET_KEY` | Any long random string. |
| `FERNET_KEYS` | Message encryption. Generate: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` |
| `DB_*` | PostgreSQL connection. |
| `CLOUDINARY_*` | Only needed to store uploads on Cloudinary. Leave blank and `MEDIA_BACKEND=auto` falls back to local disk — see below. |

### Media storage

`MEDIA_BACKEND` decides where uploads go:

| Value | Behaviour |
| --- | --- |
| `auto` (default) | Cloudinary when all three `CLOUDINARY_*` values are set, else local disk. |
| `cloudinary` | Always Cloudinary. |
| `local` | Always `MEDIA_ROOT`, served from `BACKEND_URL/media/` in DEBUG. |

The model fields are plain `ImageField`/`FileField` whose storage is resolved through
a callable (`chatapp/storage.py`). That matters twice over: uploads no longer *require*
a working Cloudinary account — `CloudinaryField` sends every write to Cloudinary from
inside `model.save()`, so a bad account made avatars impossible to store at all — and
because the migration records the callable rather than the resolved backend, changing
`MEDIA_BACKEND` never produces a spurious migration.

Note that Cloudinary rejects credentials whose key/secret belong to a different
account than the cloud name, with `401 cloud_name mismatch`. Verify a pair with:

```bash
python -c "import cloudinary,cloudinary.api;cloudinary.config(cloud_name='...',api_key='...',api_secret='...');print(cloudinary.api.ping())"
```

`.env.example` documents every other setting with its default.

### Redis

Required for the channel layer, the cache and Celery. One instance, three logical
databases, so the workloads cannot collide and a `FLUSHDB` on one cannot wipe another:

```
Django Channels ──→ redis://127.0.0.1:6379/0     REDIS_CHANNELS_DB=0
Django cache ─────→ redis://127.0.0.1:6379/1     REDIS_CACHE_DB=1
Celery ───────────→ redis://127.0.0.1:6379/2     REDIS_CELERY_DB=2
```

All three derive from a single `REDIS_URL`, so pointing at a managed Redis is a
one-line change. Verify with `redis-cli ping` (expect `PONG`) and `manage.py check`.

This is what makes multiple workers correct:

```
Worker 1 ─┐
Worker 2 ─┼── Redis ── shared cache (presence, rate limits)
Worker 3 ─┘           shared channel layer (realtime fan-out)
```

Without it, a socket held by worker 2 never receives a message published by worker 1,
and each worker keeps its own presence counters.

OTP email needs a worker running:

```bash
celery -A System worker -l info -Q emails,default
```

For a single dev process with no Redis installed, `CACHE_BACKEND=locmem` and
`CHANNEL_LAYER_BACKEND=inmemory` fall back to per-process implementations (plus
`CELERY_TASK_ALWAYS_EAGER=True` and the console email backend to skip the broker).
`manage.py check` warns when any of these are active — they **must not** be used with
more than one worker.

### 2. Frontend

```bash
cd Frontend/chat
npm install
cp .env.example .env          # defaults point at http://localhost:8000
npm run dev                   # http://localhost:5173
```

> Restart `npm run dev` after changing `.env` or `vite.config.js` — Vite only reads
> both at startup — and hard-reload the browser (Ctrl/Cmd+Shift+R). Hot reload
> cannot migrate a tab across a router change.

### 3. Tests

```bash
cd Backend/System && python manage.py test        # 58 tests: API, models, WebSocket
cd Frontend/chat  && npm test                     # 28 tests: config, provider, app smoke
cd Frontend/chat  && npm run lint
```

The frontend suite mounts the real provider tree **inside StrictMode**, matching
`main.jsx`. That is not incidental: StrictMode's doubled effects are what expose a
self-cancelling bootstrap, and a suite without it will pass while the running app
hangs.

---

## Architecture

### Realtime

One WebSocket per signed-in user at `ws/stream/`, carrying every conversation they
belong to plus presence, typing and notifications. The alternative — a socket per
open conversation — multiplies connections by the number of chats and leaves the
sidebar blind to activity in rooms the user is not currently looking at.

`ws/chat/<room_id>/` still exists for single-room clients and speaks the same
protocol. Both patterns accept the trailing slash as optional: `APPEND_SLASH` only
redirects HTTP, so a handshake one slash off an exact route just raises
"No route found for path" and the socket dies with nothing useful for the client to
act on.

Client → server: `message.send`, `message.read`, `typing`, `room.subscribe`, `ping`.
Server → client: `ready`, `message.new`, `message.read`, `typing`, `presence`,
`conversation.new`, `friend.request`, `friend.update`, `block`, `error`, `pong`.

Every event payload is built in `chatapp/realtime.py`, which both the consumer and
the HTTP views publish through, so the two paths cannot drift.

### Presence

Per-user connection counters in Redis (`chatapp/presence.py`). The database is
written only on the 0→1 and 1→0 transitions, so several tabs behave correctly and
write volume stays flat as the user count grows. Reads degrade to the persisted
`Profile.is_online` column if the cache is unavailable.

### Auth

Access token in memory only; refresh token in an HttpOnly cookie. On load the SPA
calls `/api/refresh-token/` once to re-establish the session — nothing long-lived is
reachable from JavaScript. A 401 triggers exactly one refresh no matter how many
requests fail together (`src/api/client.js`), which matters because rotation is on:
concurrent refreshes would invalidate each other.

Because the cookie is HttpOnly, the app cannot tell "signed in" from "never signed
in" without asking, and asking on every page load means a 401 plus a server-side
warning for every anonymous visitor. A non-sensitive `vibechat.session` marker in
localStorage records what is known, with **three** states — and the default is the
part that matters:

| Marker | Meaning | Boot behaviour |
| --- | --- | --- |
| `'1'` | signed in here | probe |
| `'0'` | positively no session (logged out, or a refresh 401'd) | skip the probe |
| absent | unknown | **probe** |

Treating *absent* as "no session" is what makes this dangerous: it silently signs out
anyone holding a valid cookie whose marker was never written — a browser that signed
in under an earlier build, or one whose localStorage was cleared while the cookie
survived. Unknown must always ask.

A refresh that 401s while the marker says `'1'` is retried once after 500ms, covering
the cross-tab case where another tab rotated the cookie moments earlier.

The bootstrap runs exactly once and has **no cancellation flag**. A run-once ref and a
cancel-on-cleanup flag cannot coexist: under StrictMode the effect runs, the cleanup
sets `cancelled = true`, the effect re-runs and short-circuits on the ref, and the
settled request is then discarded — leaving the app on the splash screen forever.
`src/test/authProvider.test.jsx` pins this down; note it is deliberately separate from
the app-level suite, because Suspense from the lazy routes reorders effect timing
enough to hide the race there.

Google sign-in completes as an allauth session, which the SPA exchanges for a token
pair at `/api/auth/session-token/`.

### Client caching

React Query, with the socket writing directly into the cache (`src/lib/cacheUpdates.js`):

- **Messages** — cursor-paginated infinite query, `staleTime: Infinity`. History does
  not change; new messages arrive over the socket.
- **Conversations** — page-paginated; incoming messages patch the row and reorder it
  in place rather than refetching the list.
- **Optimistic sends** — the bubble renders immediately with a `client_id`, and the
  server echoes that id back so the stored row replaces the right bubble instead of
  appearing twice. Unconfirmed after 15s, it is marked failed and offers a retry.
- **Uploads** — images and files go over HTTP rather than the socket so progress can
  be reported. The queued attachment can be removed at any point, including mid-flight:
  the remove control aborts the request through an `AbortController`, and a cancel is
  not reported as a failure.
- **Persistence** — conversations, messages and profile are mirrored to
  localStorage, so a reload paints real content instead of spinners. Bump
  `VITE_CACHE_KEY` to invalidate every client's snapshot after a breaking change.

### Typography

One family, Inter, applied globally from `src/index.css`. Self-hosted via
`@fontsource-variable/inter` and imported in `main.jsx` — no third-party request on
first paint, works offline, and the variable file covers every weight in one download
per subset.

`--font-inter` holds the stack; `--font-sans` and the Tailwind `--font-sans` theme
token both point at it, which is also what makes Tailwind derive its own
`--default-font-family` from Inter. A universal `font-family: inherit` catches
third-party markup, an explicit rule covers form controls (which never inherit the
document font), and `code`/`pre`/`kbd`/`samp` are restored to the mono stack
afterwards.

Only four weights are used: 400 body and chat messages, 500 buttons/labels/nav, 600
headings and usernames, 700 major headings.

Before this, three families were declared (`Poppins` on `body`, `Geist` in the theme
token, `Poppins Fallback` via a `font-poppins` utility) and **none of them were ever
loaded** — `index.html` linked no font at all, so every surface silently fell back to
the browser default.

### Configuration

No host, port, path, or asset id is written into application code. The backend reads
everything through `python-decouple`; the frontend funnels every `VITE_*` var through
`src/config.js`, and every route lives in `src/api/endpoints.js`.

---

## Scale notes

- **Queries are bounded.** The conversation sidebar costs four queries per page
  regardless of how many conversations exist; message pages use `select_related` for
  senders (a 30-message page was issuing ~60 extra queries). Every list endpoint is
  paginated — `users/all-status/` previously serialised the entire user table with a
  Cloudinary lookup per row.
- **Cursor pagination for history.** Offset paging shifts under concurrent writes, so
  page 2 repeats or skips rows; cursors also stay O(1) on the `(chat_room, timestamp)`
  index instead of degrading as the offset grows.
- **Blocks are cached** (5 min, explicitly invalidated) so the check on every message
  send is not a database round trip.
- **`CONN_MAX_AGE` stays at 0** unless a pooler is in front. Django holds persistent
  connections in thread-local storage and `close_old_connections()` only closes the
  calling thread's, so under ASGI every new thread-pool thread opens a connection and
  keeps it — the count climbs until PostgreSQL answers *"FATAL: sorry, too many
  clients already"*. Measured: 240 requests over 6 rounds of 40 concurrent held at
  **1** connection with it off, versus 42 → 57 → 67 → exhausted with it at 60.
  `chatapp/checks.py` warns at startup if it is enabled without `DB_BEHIND_POOLER`.
- **A per-connection send budget** on the socket so one runaway client cannot
  saturate the channel layer.
- **Throttle scopes** per concern (`auth`, `otp`, `search`, `upload`) rather than one
  shared anonymous bucket.

---

## What was fixed

### Broke the app outright

- **Signals never registered.** `chatapp/apps.py` defined `ready()` at module level,
  outside the class — so no `Profile` was created for new users, and every endpoint
  touching `user.profile` raised `RelatedObjectDoesNotExist`.
- **Token refresh returned no access token.** `RefreshTokenView` built one and then
  returned only the refresh token, so a session could never be renewed.
- **Avatar uploads were silently discarded.** `ProfileUpdateSerializer` declared
  `photo` as a `SerializerMethodField`, which is read-only.
- **Read receipts never recorded.** The consumer called `.update(is_read=True)` and
  then iterated the same queryset, which by then matched nothing, so `read_by` stayed
  empty.
- **`find_private_chat` matched nothing.** Two chained `filter()` calls on the
  `participants` many-to-many plus a `Count()` over that same relation makes Django
  reuse a constrained join, so the count came back as 1 and never equalled 2.
- **`useParams()` in a layout route** returned no `roomId` (a parent route only sees
  its own path params), which broke sidebar highlighting, unread suppression, and the
  mobile pane switch. Now matched with `useMatch`.
- **The app hung on the splash screen** for any signed-in user reloading the page: the
  session bootstrap paired a run-once ref with a cancel-on-cleanup flag, so under
  StrictMode the restored session was thrown away and status never left `'loading'`.
  A hard timeout now guarantees the loader exits regardless.
- **A valid session could be treated as signed out**, letting a signed-in user back
  onto the login screen, because an *absent* session marker was read as "no session"
  rather than "unknown".
- **Avatars collapsed their own layout and overlapped neighbouring text.** The image
  sat in normal flow while only the initials fallback was absolutely positioned, so a
  broken image URL — hidden by an `onError` handler — left the wrapper 0×0. The
  initials then escaped their row (overlapping names and message previews) and the
  presence dot anchored to the collapsed box instead of the circle. The size now lives
  on the wrapper with both layers absolute inside it, so a 404 changes nothing.
- **An invalid media account returned an unhandled 500.** Cloudinary uploads run
  inside `model.save()`, so a wrong `cloud_name` escaped as a server error with no
  usable detail. Mapped to 502 with an actionable message; the provider's own reason
  is logged.
- **Uploads required a working Cloudinary account.** `CloudinaryField` gives no way to
  store a file anywhere else, so avatars and attachments were impossible without one.
  Now storage-backed fields with a `MEDIA_BACKEND` switch and a local-disk fallback. The
  `cloudinary.config()` call at the top of settings still read the three credentials
  with a bare `config('CLOUDINARY_CLOUD_NAME')`, though — and python-decouple raises
  `UndefinedValueError` for a key that is simply absent, so settings failed to import
  a dozen lines *before* reaching the fallback written to handle that exact case.
  Any deployment that did not declare the keys at all could not start. All three are
  now read with defaults, and the SDK is configured only when there is something to
  configure: handed three empty strings it is nominally configured with no
  `cloud_name`, which is the state that makes URL building raise.
- **Every avatar-less user produced a 404.** The default avatar was a Cloudinary
  public id that has to exist in the configured account; when it does not, each list
  row fires a broken image request. Absent an explicit `DEFAULT_AVATAR_URL`, the API
  now returns `photo: null` and the clients draw an initials badge.
- **Every WebSocket connection failed** with `No route found for path 'ws/stream'`:
  the client built its socket URL with the helper that strips trailing slashes, so it
  dialled `/ws/stream` against a route declared as `ws/stream/`. Route paths now keep
  their slash, and the patterns accept either spelling.
- **CORS with credentials.** `CORS_ALLOW_ALL_ORIGINS = True` cannot be combined with
  cookies; the refresh cookie was never sent. Now an explicit allow-list with
  `CORS_ALLOW_CREDENTIALS`.
- **Footer was unrenderable** — `<Link href="#">` (react-router needs `to`), which is
  why it had been commented out of the app.

### Data corruption

- **Messages were re-encrypted on every save.** Any second save (marking read, an
  admin edit) buried the plaintext under a second Fernet layer. `save()` is now
  idempotent, and keys are rotatable via `FERNET_KEYS`.
- **Attachment broadcasts leaked ciphertext.** The upload path hand-built a payload
  containing raw `message.content`. Both paths now use the same serializer.

### Wrong identifiers

- Person serializers exposed the **Profile** id as `id`, so clients sent profile ids
  to endpoints expecting user ids — addressing the wrong person in friend requests,
  blocking and opening a conversation. Every person payload now carries `user_id`.

### Errors reported as 500s

- `PermissionError` from the message service was swallowed by a bare
  `except Exception` and returned as 500 instead of 403.
- `AttachmentView` ignored `is_valid()`, so bad input reached `serializer.save()`.
- `user_search` returned a dict on bad input which the view fed to a `many=True`
  serializer.
- `participant_ids: "abc"` was measured with `len()`, so a 3-character string looked
  like a three-participant request.
- Cloudinary raises without a configured `cloud_name`, which turned every profile,
  message and conversation response into a 500. URL building now degrades to `null`
  and the clients render initials.

### Security

- **WebSocket auth accepted refresh tokens.** `UntypedToken` skips the token-type
  claim; now `AccessToken`, honouring the configured signing key rather than assuming
  HS256.
- **Password-reset endpoints** had to be given explicit `AllowAny` once the project
  default became `IsAuthenticated` — otherwise a locked-out user could not reset.
- **Logout did not blacklist** the refresh token, leaving the cookie replayable.
- **Password reset did not revoke sessions**; a session opened by whoever prompted the
  reset stayed usable.
- **Password changes bypassed Django's validators.**
- Login now answers 401 uniformly instead of leaking whether an email exists.

### Correctness

- **Presence flipped offline when any one socket closed** — closing one of two tabs
  marked an active user offline.
- **Presence and blocking created chat rooms as a side effect**, just to name a
  channel group.
- **Blocking announced itself before writing the row**, so a failed write still kicked
  two people out of a conversation.
- **OTP codes expired early.** TOTP steps are aligned to absolute time, so a code
  generated late in a 10-minute step died moments later. Now verified with
  `valid_window=1`, and `verify-otp` no longer consumes the code the reset step needs.
- **Rate limiting was read-then-write**, so concurrent requests each concluded they
  were under the limit. Now `add()` + `incr()`.
- **Accepting a friend request twice** added the friendship twice; the row is now
  locked with `select_for_update`.
- **Opening an existing direct chat returned 400** with no room id, leaving the client
  nowhere to navigate. It is now idempotent: 200 with the existing room.
- **Unfriending someone could make them un-re-addable.** Removing a friend dropped
  the two membership rows and left the `FriendRequest` behind, still saying
  "accepted" about two people who were no longer friends. `send_friend_request` reads
  that history as current, and a settled request addressed *to* the sender was
  answered with "this person already sent you a request — accept it instead" —
  pointing at a request that no longer existed anywhere in the UI. It hit whoever had
  originally *accepted*, since the stored row runs sender → accepter, and there was
  no way out of it. Unfriending now clears the request history for the pair (the
  conversation and its messages are deliberately untouched), and a settled request in
  the other direction no longer blocks a fresh one. The same dead end could be
  reached without a friendship at all: A asks, B rejects, B can never ask A.
- **The theme switch got slower the more of the app was on screen.** A
  `html.theme-transition *` rule started a colour transition on *every element in the
  document*, so the page did not change theme — each panel eased there on its own
  clock and it read as a fill spreading across the view. Every frame of those
  transitions also repainted the glass chrome, re-running its `backdrop-filter` blur
  for the whole duration, per panel. And `useScopedTheme()` subscribed to the theme
  store from the root of the signed-in area, so each toggle re-rendered the route
  guard, AppShell, the conversation list and every message bubble — for a value only
  the toggle's own glyph displays. The switch is now one `startViewTransition`
  cross-fade of the whole viewport: the palette flips in a single style pass with
  element transitions suppressed, and two snapshots blend on the compositor. Nothing
  repaints during the fade, no blur is recomputed, and every breakpoint gets the
  identical transition. Browsers without the API swap instantly rather than
  staggering.
- **The landing page was a desktop composition narrowed onto a phone.** Its one rule
  — one viewport, no scroll — is a desktop rule: side by side, the copy and the
  product preview are one composition, but stacked into a phone they are two, and
  forcing both into a single screen made every element fight the others for height.
  At 320×568 that was a 24px headline over a 195px chat card, each cramped, neither
  the subject; on a tall phone a `max-h-[42vh]` cap stopped the card short and left a
  band of dead background under it. Below `sm` the page is now two screens that snap
  — the pitch and its call to action, then the product — with a sticky header across
  both, a cue advertising the second, and the preview re-proportioned for a phone
  (13px bubbles, a 36px avatar, a date chip, a softer radius). The CTAs are sized
  rather than stretched: `items-stretch` made the primary as wide as the viewport,
  which at 430px reads as a banner rather than a button. Every mobile rule is written
  with the `max-sm:` variant, and the build is checked to confirm all 93 of them are
  emitted inside a max-width media query, so the tablet and desktop layouts are
  reached by exactly the classes they always were. Measured over CDP at 320, 360,
  375, 390 and 430: no horizontal overflow, nothing clipped, two clean screens.
- **The mobile tab bar scrolled away.** It was the last child of the sidebar's flex
  column, so a long conversation list could compress it, and the shell's height came
  from a lone `h-dvh` — which the build's minifier reduces to a single `100dvh`
  declaration, leaving anything older than its browser targets at `height: auto`, the
  document scrolling, and the bar going with it. The bar is now fixed to the viewport
  with a spacer holding its place in the column, the shell height has a real
  `@supports` fallback, and `viewport-fit=cover` plus `env(safe-area-inset-bottom)`
  keeps the labels clear of the iOS home indicator.
- **`CELERY_TASK_QUEUES` was a dict**, which is not a valid Celery value, so the
  `emails` queue was unroutable. Replaced with `task_routes`.
- **`DEFAULT_FILE_STORAGE`** was removed in Django 5; now `STORAGES`.
- Default avatar ids were four different literals across the serializers, several
  pointing at assets that do not exist. Defaults now live in settings, and the
  signals that wrote a hardcoded id onto every new row (from inside `post_save`, so
  they re-entered the same signal) are gone.
- Six packages were missing `__init__.py`, and `requirements.txt` omitted `celery`,
  `pyotp` and `django-allauth` — a fresh install could not boot.

---

## Endpoints

Every one of these is wired up in the UI.

| Method | Path | UI |
| --- | --- | --- |
| POST | `/api/register/` | Register |
| POST | `/api/login/` | Login |
| POST | `/api/logout/` | Account menu, Settings |
| POST | `/api/refresh-token/` | Session bootstrap, 401 retry |
| GET | `/api/profile/` | — (account basics) |
| POST | `/api/auth/session-token/` | Google callback |
| POST | `/api/password/forgot/` `verify-otp/` `reset/` | Forgot-password flow |
| POST | `/api/password/change/` | Settings → Security |
| GET | `/api/chatrooms/` | Conversation sidebar |
| POST | `/api/chatrooms/create/` | Open direct chat, New group |
| GET | `/api/chatrooms/unread-count/` | Tab badge |
| GET | `/api/message-list/<room>/` | Message history (infinite scroll) |
| POST | `/api/chat/<room>/messages/` | Image / file upload |
| GET | `/api/friends/` | People → Friends, New group |
| DELETE | `/api/friends/<user>/` | Chat menu, People |
| GET/POST | `/api/friendrequests/` | People → Requests |
| PUT | `/api/friendrequests/update/<id>/` | Accept / decline |
| GET | `/api/online-users/` | People → Discover |
| GET | `/api/users/all-status/` | Directory |
| GET | `/api/user-search/` | People search |
| GET | `/api/chat-profile/` | Header, Settings |
| PATCH | `/api/chat-profile/update/` | Settings → Profile |
| GET | `/api/chat-profile/<user>/` | Profile modal |
| GET | `/api/blocked-users/` | Settings → Privacy |
| POST | `/api/block-user/<user>/` | Chat menu, Profile modal |
| DELETE | `/api/unblock-user/<user>/` | Settings → Privacy |
| WS | `/ws/stream/` | All realtime |

New in this pass: `chatrooms/`, `chatrooms/unread-count/`, `friends/`,
`friends/<user>/`, `GET friendrequests/`, `blocked-users/`, `auth/session-token/`,
`ws/stream/`. The conversation list, friend-request list and blocked list did not
exist before, so the UI had no way to show any of them.
