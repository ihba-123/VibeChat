import { Check, Pencil, Search, ShieldCheck, UserMinus, UserPlus, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { useDebouncedValue } from '../../hooks/ui'
import {
  useAddGroupMembers,
  useRemoveGroupMember,
  useRenameGroup,
} from '../../hooks/useChat'
import { useFriends } from '../../hooks/useSocial'
import { cn, pluralize } from '../../lib/utils'
import { useConfirm } from '../ConfirmDialog'
import { useToast } from '../Toaster'
import { Avatar, Button, IconButton, Input, Modal, Spinner } from '../ui'

/**
 * Group details, and — for the admin — the two things they can change: the name
 * and who is in it.
 *
 * Whether those controls appear is driven by `conversation.is_admin`, which the
 * server computes for the viewer. That is presentation only: the API re-checks the
 * same rule on every call, so a hidden button is never what keeps a member out.
 *
 * The member list is read from the cached conversation row rather than fetched.
 * It is the same data the sidebar and the chat header already render, and both
 * mutations patch that row in place, so the list stays current without a request
 * of its own.
 */
export default function GroupInfoModal({
  open,
  onClose,
  conversation,
  currentUserId,
  startEditingName = false,
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState(null)
  // Which member row is mid-removal, so only that row shows a spinner.
  const [pendingId, setPendingId] = useState(null)
  // The add-people picker is collapsed by default: most visits to this dialog are
  // to read the member list, not to change it.
  const [adding, setAdding] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState([])

  const confirm = useConfirm()
  const toast = useToast()
  const rename = useRenameGroup(conversation?.id)
  const removeMember = useRemoveGroupMember(conversation?.id)
  const addMembers = useAddGroupMembers(conversation?.id)

  const debouncedSearch = useDebouncedValue(search)
  const { friends, isLoading: friendsLoading } = useFriends(debouncedSearch)

  const title = conversation?.title ?? ''
  const isAdmin = Boolean(conversation?.is_admin)
  // Memoised, not a bare `?? []`: a fresh array literal on every render would
  // invalidate every derived memo below it.
  const members = useMemo(() => conversation?.participants ?? [], [conversation?.participants])

  const memberIds = useMemo(
    () => new Set(members.map((person) => person.user_id)),
    [members],
  )
  // Someone already in the group is not a candidate. Filtering here rather than
  // disabling the row keeps the picker to people the action can actually apply to.
  const candidates = useMemo(
    () => friends.filter((person) => !memberIds.has(person.user_id)),
    [friends, memberIds],
  )
  const selectedIds = useMemo(
    () => new Set(selected.map((person) => person.user_id)),
    [selected],
  )

  // The title is read through a ref so the reset below can depend on `open`
  // alone. Depending on the title itself would re-run it after a successful
  // rename — which, when the dialog was opened straight into rename mode, would
  // drop the user back into the editor they had just left.
  const titleRef = useRef(title)
  titleRef.current = title

  // Reopening starts from the stored name, never from a half-typed edit that was
  // abandoned by closing the dialog.
  useEffect(() => {
    if (!open) return
    setName(titleRef.current)
    setEditing(startEditingName && isAdmin)
    setError(null)
    setPendingId(null)
    setAdding(false)
    setSearch('')
    setSelected([])
  }, [open, startEditingName, isAdmin])

  const cancelEdit = () => {
    setName(title)
    setEditing(false)
    setError(null)
  }

  const submitName = async () => {
    const next = name.trim()
    if (!next) {
      setError('A group needs a name.')
      return
    }
    if (next === title) {
      setEditing(false)
      setError(null)
      return
    }
    try {
      await rename.mutateAsync(next)
      toast.success('Group renamed.')
      setEditing(false)
      setError(null)
    } catch (requestError) {
      setError(requestError?.message || 'Could not rename the group.')
    }
  }

  const toggleCandidate = (person) => {
    setSelected((current) =>
      current.some((entry) => entry.user_id === person.user_id)
        ? current.filter((entry) => entry.user_id !== person.user_id)
        : [...current, person],
    )
  }

  const submitAdd = async () => {
    if (!selected.length) return
    try {
      const result = await addMembers.mutateAsync(selected.map((person) => person.user_id))
      toast.success(result.detail || 'Added to the group.')
      setSelected([])
      setSearch('')
      setAdding(false)
    } catch (requestError) {
      toast.error(requestError?.message || 'Could not add those people.')
    }
  }

  const confirmRemove = async (person) => {
    const label = person.name || person.email || 'this member'
    const ok = await confirm({
      title: `Remove ${label}?`,
      description:
        'They lose access to this group and stop receiving its messages. The conversation stays for everyone else.',
      confirmLabel: 'Remove',
    })
    if (!ok) return

    setPendingId(person.user_id)
    try {
      await removeMember.mutateAsync(person.user_id)
      toast.success(`${label} removed from the group.`)
    } catch (requestError) {
      toast.error(requestError?.message || 'Could not remove that member.')
    } finally {
      setPendingId(null)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Group info"
      description={
        isAdmin
          ? 'You created this group, so you can rename it and remove members.'
          : 'Only the group admin can rename it or change who is in it.'
      }
      footer={
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <Avatar src={conversation?.photo} name={title} size="lg" />

          {editing ? (
            <div className="flex min-w-0 flex-1 items-start gap-1.5">
              <Input
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => {
                  // Enter saves and Escape reverts, so the rename never needs the
                  // pointer. Escape is stopped here because the dialog also listens
                  // for it, and cancelling the edit should not close the dialog.
                  if (event.key === 'Enter') submitName()
                  if (event.key === 'Escape') {
                    event.stopPropagation()
                    cancelEdit()
                  }
                }}
                maxLength={255}
                aria-label="Group name"
                error={error ?? undefined}
              />
              <IconButton
                label="Save group name"
                variant="primary"
                onClick={submitName}
                loading={rename.isPending}
              >
                <Check className="icon-md" />
              </IconButton>
              <IconButton label="Cancel rename" onClick={cancelEdit} disabled={rename.isPending}>
                <X className="icon-md" />
              </IconButton>
            </div>
          ) : (
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-card-foreground">{title}</p>
                <p className="text-xs text-muted-foreground">
                  {pluralize(members.length, 'member')}
                </p>
              </div>
              {isAdmin && (
                <IconButton label="Rename group" size="sm" onClick={() => setEditing(true)}>
                  <Pencil className="icon-sm" />
                </IconButton>
              )}
            </div>
          )}
        </div>

        {isAdmin && (
          <div className="rounded-2xl border border-border p-3">
            {adding ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Add people
                  </h3>
                  <IconButton
                    label="Cancel adding people"
                    size="sm"
                    onClick={() => {
                      setAdding(false)
                      setSelected([])
                      setSearch('')
                    }}
                  >
                    <X className="icon-sm" />
                  </IconButton>
                </div>

                {selected.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selected.map((person) => (
                      <button
                        key={person.user_id}
                        type="button"
                        onClick={() => toggleCandidate(person)}
                        className="flex items-center gap-1.5 rounded-full bg-primary/10 py-1 pl-1 pr-2.5 text-sm text-foreground transition-colors hover:bg-primary/20"
                      >
                        <Avatar src={person.photo} name={person.name} size="xs" />
                        {person.name}
                        <span aria-hidden className="text-muted-foreground">
                          ×
                        </span>
                        <span className="sr-only">Remove {person.name}</span>
                      </button>
                    ))}
                  </div>
                )}

                <Input
                  icon={Search}
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search friends"
                  aria-label="Search friends to add"
                />

                <div className="max-h-56 space-y-0.5 overflow-y-auto">
                  {friendsLoading ? (
                    <div className="flex justify-center py-5">
                      <Spinner />
                    </div>
                  ) : candidates.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                      {search
                        ? 'No friends match that search.'
                        : 'All of your friends are already in this group.'}
                    </p>
                  ) : (
                    candidates.map((person) => {
                      const isSelected = selectedIds.has(person.user_id)
                      return (
                        <button
                          key={person.user_id}
                          type="button"
                          onClick={() => toggleCandidate(person)}
                          aria-pressed={isSelected}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors',
                            isSelected ? 'bg-primary/10' : 'hover:bg-muted',
                          )}
                        >
                          <Avatar
                            src={person.photo}
                            name={person.name}
                            size="sm"
                            showPresence
                            isOnline={person.is_online}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-foreground">
                              {person.name}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {person.email}
                            </span>
                          </span>
                          <span
                            className={cn(
                              'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border',
                              isSelected
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-border',
                            )}
                          >
                            {isSelected && <Check className="icon-xs" />}
                          </span>
                        </button>
                      )
                    })
                  )}
                </div>

                <Button
                  fullWidth
                  onClick={submitAdd}
                  disabled={!selected.length}
                  loading={addMembers.isPending}
                >
                  <UserPlus className="icon-sm" />
                  {selected.length
                    ? `Add ${pluralize(selected.length, 'person', 'people')}`
                    : 'Add to group'}
                </Button>
              </div>
            ) : (
              <Button variant="ghost" fullWidth onClick={() => setAdding(true)}>
                <UserPlus className="icon-sm" />
                Add people
              </Button>
            )}
          </div>
        )}

        <div>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Members
          </h3>
          <ul className="max-h-72 space-y-0.5 overflow-y-auto">
            {members.map((person) => {
              const isGroupAdmin = person.user_id === conversation?.admin_id
              const isMe = person.user_id === currentUserId
              // The admin is never removable: the group would be left with nobody
              // able to administer it, and the server refuses it for the same reason.
              const canRemove = isAdmin && !isGroupAdmin && !isMe

              return (
                <li
                  key={person.user_id}
                  className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-muted"
                >
                  <Avatar
                    src={person.photo}
                    name={person.name}
                    size="sm"
                    showPresence
                    isOnline={person.is_online}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium text-foreground">
                        {person.name || person.email}
                      </span>
                      {isMe && <span className="text-xs text-muted-foreground">(you)</span>}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {person.email}
                    </span>
                  </span>

                  {isGroupAdmin && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                      <ShieldCheck className="icon-xs" aria-hidden />
                      Admin
                    </span>
                  )}

                  {canRemove && (
                    <IconButton
                      label={`Remove ${person.name || person.email}`}
                      size="sm"
                      className="text-danger hover:bg-danger-soft"
                      onClick={() => confirmRemove(person)}
                      loading={pendingId === person.user_id}
                      // One removal at a time: the list is patched from each
                      // response, and overlapping requests would race that patch.
                      disabled={pendingId !== null}
                    >
                      <UserMinus className="icon-sm" />
                    </IconButton>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </Modal>
  )
}
