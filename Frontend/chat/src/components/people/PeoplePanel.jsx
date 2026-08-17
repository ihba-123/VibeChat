import {
  Ban,
  Check,
  MessageSquare,
  Search,
  UserMinus,
  UserPlus,
  UserRoundSearch,
  Users,
  X,
} from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'

import { useDebouncedValue, useIntersection } from '../../hooks/ui'
import { useOpenDirectChat } from '../../hooks/useChat'
import {
  useBlockUser,
  useDiscoverPeople,
  useFriendRequests,
  useFriends,
  useRemoveFriend,
  useRespondToFriendRequest,
  useSendFriendRequest,
  useUserSearch,
} from '../../hooks/useSocial'
import { useRealtime } from '../../realtime/RealtimeProvider'
import { useToast } from '../Toaster'
import { Button, EmptyState, ErrorState, IconButton, Skeleton, Spinner, Tabs } from '../ui'
import PersonRow from './PersonRow'

const TABS = [
  { value: 'discover', label: 'Discover' },
  { value: 'requests', label: 'Requests' },
  { value: 'friends', label: 'Friends' },
]

function LoadingRows({ count = 5 }) {
  return (
    <div className="space-y-1 p-2">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex items-center gap-3 px-3 py-2.5">
          <Skeleton className="h-11 w-11 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-8 w-20 rounded-lg" />
        </div>
      ))}
    </div>
  )
}

/** Renders any paginated people list with a shared loading/empty/error treatment. */
function PeopleList({ query, items, renderActions, emptyState, onSelect, isOnline }) {
  const sentinelRef = useIntersection(
    () => {
      if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage()
    },
    { enabled: Boolean(query.hasNextPage) },
  )

  if (query.isLoading) return <LoadingRows />
  if (query.isError) {
    return <ErrorState description={query.error?.message} onRetry={query.refetch} />
  }
  if (!items.length) return emptyState

  return (
    <div className="space-y-0.5">
      {items.map((person) => (
        <PersonRow
          key={person.user_id ?? person.id}
          person={person}
          isOnline={isOnline?.(person.user_id) || person.is_online}
          actions={renderActions(person)}
          onClick={onSelect ? () => onSelect(person) : undefined}
        />
      ))}
      {query.hasNextPage && (
        <div ref={sentinelRef} className="flex justify-center py-3">
          {query.isFetchingNextPage ? <Spinner /> : null}
        </div>
      )}
    </div>
  )
}

export default function PeoplePanel({ onOpenConversation, onViewProfile }) {
  const [tab, setTab] = useState('discover')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const isSearching = debouncedSearch.trim().length > 0

  const toast = useToast()
  const { isOnline } = useRealtime()

  // Search has its own endpoint (name + email); Discover stays unfiltered.
  const discover = useDiscoverPeople()
  const searchQuery = useUserSearch(debouncedSearch)
  const incoming = useFriendRequests('incoming', 'pending')
  const outgoing = useFriendRequests('outgoing', 'pending')
  const friendsQuery = useFriends()

  const sendRequest = useSendFriendRequest()
  const respond = useRespondToFriendRequest()
  const removeFriend = useRemoveFriend()
  const blockUser = useBlockUser()
  const openDirect = useOpenDirectChat()

  const tabsWithCounts = useMemo(
    () =>
      TABS.map((entry) =>
        entry.value === 'requests' ? { ...entry, count: incoming.requests.length } : entry,
      ),
    [incoming.requests.length],
  )

  const startChat = useCallback(
    async (userId) => {
      try {
        const result = await openDirect.mutateAsync(userId)
        onOpenConversation?.(result.room_id)
      } catch (error) {
        toast.error(error?.message || 'Could not open that conversation.')
      }
    },
    [onOpenConversation, openDirect, toast],
  )

  const addFriend = useCallback(
    async (person) => {
      try {
        await sendRequest.mutateAsync(person.user_id)
        toast.success(`Friend request sent to ${person.name || person.email}.`)
      } catch (error) {
        toast.error(error?.message || 'Could not send that request.')
      }
    },
    [sendRequest, toast],
  )

  const respondTo = useCallback(
    async (request, action) => {
      try {
        await respond.mutateAsync({ requestId: request.id, action })
        toast.success(
          action === 'accept'
            ? `You and ${request.from_user.name} are now friends.`
            : 'Request declined.',
        )
      } catch (error) {
        toast.error(error?.message || 'Could not update that request.')
      }
    },
    [respond, toast],
  )

  const block = useCallback(
    async (person) => {
      try {
        await blockUser.mutateAsync(person.user_id)
        toast.success(`${person.name || person.email} blocked.`)
      } catch (error) {
        toast.error(error?.message || 'Could not block that person.')
      }
    },
    [blockUser, toast],
  )

  const unfriend = useCallback(
    async (person) => {
      try {
        await removeFriend.mutateAsync(person.user_id)
        toast.success(`${person.name || person.email} removed.`)
      } catch (error) {
        toast.error(error?.message || 'Could not remove that friend.')
      }
    },
    [removeFriend, toast],
  )

  const discoverActions = (person) => (
    <>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => addFriend(person)}
        loading={sendRequest.isPending && sendRequest.variables === person.user_id}
      >
        <UserPlus className="h-5 w-5" />
        Add
      </Button>
      <IconButton label={`Block ${person.name}`} size="sm" onClick={() => block(person)}>
        <Ban className="h-5 w-5" />
      </IconButton>
    </>
  )

  const friendActions = (person) => (
    <>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => startChat(person.user_id)}
        loading={openDirect.isPending && openDirect.variables === person.user_id}
      >
        <MessageSquare className="h-5 w-5" />
        Chat
      </Button>
      <IconButton
        label={`Remove ${person.name} from friends`}
        size="sm"
        onClick={() => unfriend(person)}
      >
        <UserMinus className="h-5 w-5" />
      </IconButton>
    </>
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 space-y-3 p-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search people by name or email"
            aria-label="Search people"
            className="w-full rounded-lg border border-input bg-background py-2.5 pl-10 pr-10 text-sm placeholder:text-muted-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Clear search"
              className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {!isSearching && <Tabs tabs={tabsWithCounts} value={tab} onChange={setTab} />}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {isSearching ? (
          <PeopleList
            query={searchQuery}
            items={searchQuery.results}
            isOnline={isOnline}
            onSelect={(person) => onViewProfile?.(person.user_id)}
            renderActions={discoverActions}
            emptyState={
              <EmptyState
                icon={UserRoundSearch}
                title="No one found"
                description={`Nobody matches “${debouncedSearch}”.`}
              />
            }
          />
        ) : tab === 'discover' ? (
          <PeopleList
            query={discover}
            items={discover.people}
            isOnline={isOnline}
            onSelect={(person) => onViewProfile?.(person.user_id)}
            renderActions={discoverActions}
            emptyState={
              <EmptyState
                icon={Users}
                title="Nobody new right now"
                description="You have already connected with everyone here. Use search to find someone specific."
              />
            }
          />
        ) : tab === 'requests' ? (
          <div className="space-y-4">
            <section>
              <h3 className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Incoming
              </h3>
              <PeopleList
                query={incoming}
                items={incoming.requests.map((request) => ({
                  ...request.from_user,
                  _request: request,
                }))}
                isOnline={isOnline}
                renderActions={(person) => (
                  <>
                    <Button
                      size="sm"
                      onClick={() => respondTo(person._request, 'accept')}
                      loading={
                        respond.isPending && respond.variables?.requestId === person._request.id
                      }
                    >
                      <Check className="h-5 w-5" />
                      Accept
                    </Button>
                    <IconButton
                      label="Decline request"
                      size="sm"
                      onClick={() => respondTo(person._request, 'reject')}
                    >
                      <X className="h-5 w-5" />
                    </IconButton>
                  </>
                )}
                emptyState={
                  <EmptyState
                    icon={UserPlus}
                    title="No pending requests"
                    description="Friend requests sent to you will appear here."
                  />
                }
              />
            </section>

            {outgoing.requests.length > 0 && (
              <section>
                <h3 className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Sent
                </h3>
                <PeopleList
                  query={outgoing}
                  items={outgoing.requests.map((request) => ({ ...request.to_user }))}
                  isOnline={isOnline}
                  renderActions={() => (
                    <span className="text-xs font-medium text-muted-foreground">Pending</span>
                  )}
                  emptyState={null}
                />
              </section>
            )}
          </div>
        ) : (
          <PeopleList
            query={friendsQuery}
            items={friendsQuery.friends}
            isOnline={isOnline}
            onSelect={(person) => onViewProfile?.(person.user_id)}
            renderActions={friendActions}
            emptyState={
              <EmptyState
                icon={Users}
                title="No friends yet"
                description="Add someone from Discover and they will show up here."
                action={
                  <Button size="sm" variant="secondary" onClick={() => setTab('discover')}>
                    Browse people
                  </Button>
                }
              />
            }
          />
        )}
      </div>
    </div>
  )
}
