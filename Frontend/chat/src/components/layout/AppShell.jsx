import {
  LogOut,
  MessageCircleCode,
  MessagesSquare,
  Settings,
  UserPlus,
  Users,
  WifiOff,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Outlet, useLocation, useMatch, useNavigate } from 'react-router-dom'

import { useAuth } from '../../auth/AuthProvider'
import config from '../../config'
import { useIsDesktop, useOnClickOutside } from '../../hooks/ui'
import { useConversations } from '../../hooks/useChat'
import { useFriendRequests, useMe } from '../../hooks/useSocial'
import { cn } from '../../lib/utils'
import { useRealtime } from '../../realtime/RealtimeProvider'
import ConversationList from '../chat/ConversationList'
import NewGroupModal from '../people/NewGroupModal'
import PeoplePanel from '../people/PeoplePanel'
import ProfileModal from '../people/ProfileModal'
import ThemeToggle from '../ThemeToggle'
import { Avatar, Badge, Button, IconButton } from '../ui'

/** Shows when the realtime stream is not connected, so the state is never silent. */
function ConnectionBanner({ status }) {
  if (status === 'open' || status === 'idle') return null

  const label =
    status === 'reconnecting'
      ? 'Reconnecting…'
      : status === 'connecting'
        ? 'Connecting…'
        : 'Offline — messages will send when you reconnect'

  return (
    <div className="flex items-center justify-center gap-2 bg-amber-500/15 px-4 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
      <WifiOff className="h-4 w-4" aria-hidden />
      {label}
    </div>
  )
}

function UserMenu({ me, onOpenSettings, onLogout }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useOnClickOutside(ref, () => setOpen(false))

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Account menu"
        aria-expanded={open}
        className="rounded-full transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {/* Matches the 48px rail buttons above it. */}
        <Avatar src={me?.photo} name={me?.name} size="md" showPresence isOnline />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute bottom-full left-0 z-30 mb-2 w-56 overflow-hidden rounded-xl border border-border bg-card shadow-xl"
        >
          <div className="border-b border-border px-3 py-2.5">
            <p className="truncate text-sm font-semibold text-card-foreground">{me?.name}</p>
            <p className="truncate text-xs text-muted-foreground">{me?.email}</p>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onOpenSettings()
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-card-foreground transition-colors hover:bg-muted"
          >
            <Settings className="h-5 w-5" aria-hidden />
            Settings
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onLogout()
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-red-500 transition-colors hover:bg-red-500/10"
          >
            <LogOut className="h-5 w-5" aria-hidden />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

export default function AppShell() {
  const navigate = useNavigate()
  const location = useLocation()
  // useParams() in a layout route only exposes params matched by that route's own
  // path — `/app` has none — so the child's :roomId has to be matched explicitly.
  // Reading it from useParams() here left roomId permanently undefined, which
  // broke sidebar highlighting, unread suppression, and the mobile pane switch.
  const roomMatch = useMatch('/app/c/:roomId')
  const roomId = roomMatch?.params?.roomId
  const { logout } = useAuth()
  const { status: socketStatus, isOnline, setActiveRoom } = useRealtime()
  const isDesktop = useIsDesktop()

  const [panel, setPanel] = useState('chats')
  const [profileUserId, setProfileUserId] = useState(null)
  const [groupModalOpen, setGroupModalOpen] = useState(false)

  const { data: me } = useMe()
  const conversationsQuery = useConversations()
  const { requests: incomingRequests } = useFriendRequests('incoming', 'pending')

  const isSettings = location.pathname.endsWith('/settings')
  // On a narrow screen only one pane fits, so the sidebar yields to an open
  // conversation and returns via the header's back button.
  const showSidebar = isDesktop || (!roomId && !isSettings)
  const showMain = isDesktop || Boolean(roomId) || isSettings

  // Keeps the realtime layer informed so incoming messages for the visible room
  // do not raise an unread badge that is immediately cleared again.
  useEffect(() => {
    setActiveRoom(roomId ?? null)
    return () => setActiveRoom(null)
  }, [roomId, setActiveRoom])

  const openConversation = useCallback(
    (id) => {
      setPanel('chats')
      navigate(`/app/c/${id}`)
    },
    [navigate],
  )

  const navItems = useMemo(
    () => [
      {
        key: 'chats',
        label: 'Chats',
        icon: MessagesSquare,
        badge: conversationsQuery.totalUnread,
        onClick: () => setPanel('chats'),
      },
      {
        key: 'people',
        label: 'People',
        icon: Users,
        badge: incomingRequests.length,
        onClick: () => setPanel('people'),
      },
    ],
    [conversationsQuery.totalUnread, incomingRequests.length],
  )

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <ConnectionBanner status={socketStatus} />

      <div className="flex min-h-0 flex-1">
        {/* Icon rail */}
        <nav
          aria-label="Main"
          className="hidden w-16 shrink-0 flex-col items-center gap-1.5 border-r border-border bg-sidebar py-3 sm:flex"
        >
          <button
            type="button"
            onClick={() => navigate('/app')}
            aria-label={`${config.appName} home`}
            className="mb-1 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors hover:bg-primary/20"
          >
            <MessageCircleCode className="h-6 w-6" />
          </button>

          {navItems.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={item.onClick}
              aria-label={item.label}
              aria-current={panel === item.key ? 'page' : undefined}
              className={cn(
                'relative flex h-11 w-11 items-center justify-center rounded-xl transition-colors',
                panel === item.key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <item.icon className="h-6 w-6" />
              {item.badge > 0 && (
                <span className="absolute -right-0.5 -top-0.5">
                  <Badge variant="primary">{item.badge > 99 ? '99+' : item.badge}</Badge>
                </span>
              )}
            </button>
          ))}

          <div className="mt-auto flex flex-col items-center gap-2">
            <ThemeToggle size="md" />
            <IconButton
              label="Settings"
              size="md"
              onClick={() => navigate('/app/settings')}
              className={cn(isSettings && 'bg-muted')}
            >
              <Settings className="h-6 w-6" />
            </IconButton>
            <UserMenu
              me={me}
              onOpenSettings={() => navigate('/app/settings')}
              onLogout={logout}
            />
          </div>
        </nav>

        {/* Sidebar panel */}
        {showSidebar && (
          <aside
            className={cn(
              'flex min-h-0 flex-col border-r border-border bg-card',
              isDesktop ? 'w-80 shrink-0 xl:w-96' : 'w-full',
            )}
          >
            {/* h-16 matches the chat header and the settings header exactly, so the
                two panes line up across the divider instead of by coincidence. */}
            <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
              <h1 className="truncate font-poppins text-lg font-bold text-card-foreground">
                {panel === 'chats' ? 'Chats' : 'People'}
              </h1>
              <div className="flex items-center gap-1">
                {panel === 'chats' && (
                  <IconButton
                    label="New group"
                    size="lg"
                    onClick={() => setGroupModalOpen(true)}
                  >
                    <UserPlus className="h-7 w-7" />
                  </IconButton>
                )}
                <span className="sm:hidden">
                  <ThemeToggle size="md" />
                </span>
              </div>
            </header>

            <div className="min-h-0 flex-1">
              {panel === 'chats' ? (
                <ConversationList
                  conversations={conversationsQuery.conversations}
                  activeRoomId={roomId}
                  onSelect={openConversation}
                  isLoading={conversationsQuery.isLoading}
                  isError={conversationsQuery.isError}
                  error={conversationsQuery.error}
                  onRetry={conversationsQuery.refetch}
                  hasNextPage={conversationsQuery.hasNextPage}
                  fetchNextPage={conversationsQuery.fetchNextPage}
                  isFetchingNextPage={conversationsQuery.isFetchingNextPage}
                  isOnline={isOnline}
                  onStartChat={() => setPanel('people')}
                />
              ) : (
                <PeoplePanel
                  onOpenConversation={openConversation}
                  onViewProfile={setProfileUserId}
                />
              )}
            </div>

            {/* Mobile bottom navigation */}
            <nav
              aria-label="Sections"
              className="flex items-center justify-around border-t border-border py-1.5 sm:hidden"
            >
              {navItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={item.onClick}
                  className={cn(
                    'relative flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[11px] font-medium transition-colors',
                    panel === item.key ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  <item.icon className="h-6 w-6" />
                  {item.label}
                  {item.badge > 0 && (
                    <span className="absolute right-1/4 top-0">
                      <Badge variant="primary">{item.badge > 9 ? '9+' : item.badge}</Badge>
                    </span>
                  )}
                </button>
              ))}
              <button
                type="button"
                onClick={() => navigate('/app/settings')}
                className={cn(
                  'flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[11px] font-medium transition-colors',
                  isSettings ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <Settings className="h-6 w-6" />
                Settings
              </button>
            </nav>
          </aside>
        )}

        {/* Main pane */}
        {showMain && (
          <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
            <Outlet context={{ onViewProfile: setProfileUserId, openConversation }} />
          </main>
        )}
      </div>

      <ProfileModal
        userId={profileUserId}
        open={Boolean(profileUserId)}
        onClose={() => setProfileUserId(null)}
        onOpenConversation={openConversation}
      />

      <NewGroupModal
        open={groupModalOpen}
        onClose={() => setGroupModalOpen(false)}
        onCreated={openConversation}
      />
    </div>
  )
}
