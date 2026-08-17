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

**Redis** backs the channel layer (realtime), the cache (presence, rate limits) and
Celery (OTP email). For a single dev process without Redis installed, set:

```
CACHE_BACKEND=locmem
CHANNEL_LAYER_BACKEND=inmemory
CELERY_TASK_ALWAYS_EAGER=True
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
```

These are per-process and **must not** be used with more than one worker — presence
counting and rate limiting both become wrong. Use Redis for anything real.

With Redis, OTP email needs a worker:

```bash
celery -A System worker -l info -Q emails,default
```

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
- **Connection reuse** via `CONN_MAX_AGE`, and a per-connection send budget on the
  socket so one runaway client cannot saturate the channel layer.
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
  Now storage-backed fields with a `MEDIA_BACKEND` switch and a local-disk fallback.
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
