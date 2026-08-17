import { Check, Search, Users } from 'lucide-react'
import { useMemo, useState } from 'react'

import { useDebouncedValue } from '../../hooks/ui'
import { useCreateGroup } from '../../hooks/useChat'
import { useFriends } from '../../hooks/useSocial'
import { cn } from '../../lib/utils'
import { useToast } from '../Toaster'
import { Avatar, Button, EmptyState, Input, Modal, Spinner } from '../ui'

/** Create a group conversation from the user's friends. */
export default function NewGroupModal({ open, onClose, onCreated }) {
  const [name, setName] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState([])
  const [error, setError] = useState(null)

  const debouncedSearch = useDebouncedValue(search)
  const { friends, isLoading } = useFriends(debouncedSearch)
  const createGroup = useCreateGroup()
  const toast = useToast()

  const selectedIds = useMemo(() => new Set(selected.map((person) => person.user_id)), [selected])

  const reset = () => {
    setName('')
    setSearch('')
    setSelected([])
    setError(null)
  }

  const close = () => {
    reset()
    onClose?.()
  }

  const toggle = (person) => {
    setSelected((current) =>
      current.some((entry) => entry.user_id === person.user_id)
        ? current.filter((entry) => entry.user_id !== person.user_id)
        : [...current, person],
    )
  }

  const submit = async () => {
    setError(null)
    if (!name.trim()) {
      setError('Give the group a name.')
      return
    }
    if (selected.length < 1) {
      setError('Pick at least one person.')
      return
    }

    try {
      const result = await createGroup.mutateAsync({
        name: name.trim(),
        participantIds: selected.map((person) => person.user_id),
      })
      toast.success(result.created ? 'Group created.' : 'That group already exists.')
      onCreated?.(result.room_id)
      close()
    } catch (requestError) {
      setError(requestError?.message || 'Could not create the group.')
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="New group"
      description="Pick friends to add, then give the group a name."
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button onClick={submit} loading={createGroup.isPending}>
            Create group
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Group name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Weekend plans"
          maxLength={255}
          error={error && !name.trim() ? error : undefined}
        />

        {selected.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selected.map((person) => (
              <button
                key={person.user_id}
                type="button"
                onClick={() => toggle(person)}
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
          aria-label="Search friends"
        />

        <div className="max-h-72 space-y-0.5 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          ) : friends.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No friends to add"
              description="Add friends first, then you can group them here."
            />
          ) : (
            friends.map((person) => {
              const isSelected = selectedIds.has(person.user_id)
              return (
                <button
                  key={person.user_id}
                  type="button"
                  onClick={() => toggle(person)}
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
                      'flex h-6 w-6 items-center justify-center rounded-full border',
                      isSelected
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border',
                    )}
                  >
                    {isSelected && <Check className="h-3 w-3" />}
                  </span>
                </button>
              )
            })
          )}
        </div>

        {error && selected.length === 0 && <p className="text-sm text-red-500">{error}</p>}
      </div>
    </Modal>
  )
}
