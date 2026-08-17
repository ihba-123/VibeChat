import { ArrowLeft, Camera, LogOut, ShieldOff } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/AuthProvider'
import { useConfirm } from '../components/ConfirmDialog'
import { useToast } from '../components/Toaster'
import {
  Avatar,
  Button,
  EmptyState,
  IconButton,
  Input,
  Skeleton,
  Spinner,
  Tabs,
  Textarea,
} from '../components/ui'
import config from '../config'
import {
  useBlockedUsers,
  useChangePassword,
  useMe,
  useUnblockUser,
  useUpdateProfile,
} from '../hooks/useSocial'
import { formatListTimestamp, isImageFile } from '../lib/utils'

const TABS = [
  { value: 'profile', label: 'Profile' },
  { value: 'security', label: 'Security' },
  { value: 'privacy', label: 'Privacy' },
]

function ProfileSection() {
  const { data: me, isLoading } = useMe()
  const updateProfile = useUpdateProfile()
  const toast = useToast()
  const fileInputRef = useRef(null)

  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [photo, setPhoto] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [errors, setErrors] = useState({})

  // Seed the form once the profile arrives, and re-seed if it changes elsewhere.
  useEffect(() => {
    if (!me) return
    setName(me.name ?? '')
    setBio(me.bio ?? '')
  }, [me])

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    },
    [previewUrl],
  )

  const pickPhoto = (file) => {
    if (!file) return
    if (!isImageFile(file)) {
      toast.error('Choose an image file.')
      return
    }
    if (file.size > config.maxUploadMb * 1024 * 1024) {
      toast.error(`Images must be under ${config.maxUploadMb}MB.`)
      return
    }
    setPhoto(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  const isDirty = name !== (me?.name ?? '') || bio !== (me?.bio ?? '') || Boolean(photo)

  const save = async (event) => {
    event.preventDefault()
    setErrors({})
    if (!name.trim()) {
      setErrors({ name: 'Name cannot be empty.' })
      return
    }

    try {
      await updateProfile.mutateAsync({ name: name.trim(), bio, photo })
      setPhoto(null)
      setPreviewUrl(null)
      toast.success('Profile updated.')
    } catch (error) {
      setErrors({
        name: error?.fieldError?.('name'),
        bio: error?.fieldError?.('bio'),
        photo: error?.fieldError?.('photo'),
      })
      toast.error(error?.message || 'Could not save your profile.')
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-24 rounded-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="relative">
          <Avatar src={previewUrl || me?.photo} name={name || me?.name} size="xl" />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Change profile photo"
            className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground shadow-md transition-transform hover:scale-105"
          >
            <Camera className="icon-sm" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              pickPhoto(event.target.files?.[0])
              event.target.value = ''
            }}
          />
        </div>

        <div className="min-w-0">
          <p className="truncate font-semibold text-foreground">{me?.name}</p>
          <p className="truncate text-sm text-muted-foreground">{me?.email}</p>
          {photo && (
            <button
              type="button"
              onClick={() => {
                setPhoto(null)
                setPreviewUrl(null)
              }}
              className="mt-1 text-xs font-medium text-primary hover:underline"
            >
              Undo photo change
            </button>
          )}
          {errors.photo && <p className="mt-1 text-xs text-danger">{errors.photo}</p>}
        </div>
      </div>

      <Input
        label="Display name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        error={errors.name}
        maxLength={200}
      />

      <Textarea
        label="Bio"
        rows={4}
        value={bio}
        onChange={(event) => setBio(event.target.value)}
        error={errors.bio}
        maxLength={500}
        placeholder="A sentence or two about you."
      />
      <p className="-mt-4 text-xs text-muted-foreground">{bio.length}/500</p>

      <Button type="submit" loading={updateProfile.isPending} disabled={!isDirty}>
        Save changes
      </Button>
    </form>
  )
}

function SecuritySection() {
  const changePassword = useChangePassword()
  const toast = useToast()
  const [form, setForm] = useState({ oldPassword: '', newPassword: '', confirm: '' })
  const [errors, setErrors] = useState({})

  const update = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  const submit = async (event) => {
    event.preventDefault()
    setErrors({})

    if (!form.oldPassword) {
      setErrors({ oldPassword: 'Enter your current password.' })
      return
    }
    if (form.newPassword.length < 8) {
      setErrors({ newPassword: 'At least 8 characters.' })
      return
    }
    if (form.newPassword !== form.confirm) {
      setErrors({ confirm: 'Passwords do not match.' })
      return
    }

    try {
      await changePassword.mutateAsync({
        oldPassword: form.oldPassword,
        newPassword: form.newPassword,
      })
      setForm({ oldPassword: '', newPassword: '', confirm: '' })
      toast.success('Password changed.')
    } catch (error) {
      setErrors({
        oldPassword: error?.fieldError?.('old_password'),
        // Django's validators come back keyed on new_password.
        newPassword: error?.fieldError?.('new_password') || error?.message,
      })
    }
  }

  return (
    <form onSubmit={submit} className="max-w-md space-y-4">
      <Input
        label="Current password"
        type="password"
        autoComplete="current-password"
        value={form.oldPassword}
        onChange={update('oldPassword')}
        error={errors.oldPassword}
      />
      <Input
        label="New password"
        type="password"
        autoComplete="new-password"
        value={form.newPassword}
        onChange={update('newPassword')}
        error={errors.newPassword}
      />
      <Input
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        value={form.confirm}
        onChange={update('confirm')}
        error={errors.confirm}
      />
      <Button type="submit" loading={changePassword.isPending}>
        Change password
      </Button>
    </form>
  )
}

function PrivacySection() {
  const { blocked, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useBlockedUsers()
  const unblockUser = useUnblockUser()
  const toast = useToast()
  const confirm = useConfirm()

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (!blocked.length) {
    return (
      <EmptyState
        icon={ShieldOff}
        title="No one is blocked"
        description="People you block will be listed here so you can undo it later."
      />
    )
  }

  return (
    <div className="space-y-1">
      {blocked.map((entry) => (
        <div
          key={entry.id}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted"
        >
          <Avatar src={entry.user.photo} name={entry.user.name} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{entry.user.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              Blocked {formatListTimestamp(entry.blocked_at)}
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            loading={unblockUser.isPending && unblockUser.variables === entry.user.user_id}
            onClick={async () => {
              const ok = await confirm({
                title: `Unblock ${entry.user.name}?`,
                description: 'They will be able to message you again.',
                confirmLabel: 'Unblock',
                tone: 'default',
              })
              if (!ok) return
              try {
                await unblockUser.mutateAsync(entry.user.user_id)
                toast.success(`${entry.user.name} unblocked.`)
              } catch (error) {
                toast.error(error?.message || 'Could not unblock.')
              }
            }}
          >
            Unblock
          </Button>
        </div>
      ))}

      {hasNextPage && (
        <div className="flex justify-center pt-3">
          <Button variant="ghost" size="sm" onClick={fetchNextPage} loading={isFetchingNextPage}>
            Load more
          </Button>
        </div>
      )}
    </div>
  )
}

export default function Settings() {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const confirm = useConfirm()
  const [tab, setTab] = useState('profile')

  const signOut = async () => {
    const ok = await confirm({
      title: 'Sign out?',
      description: 'You will need to sign in again to read or send messages on this device.',
      confirmLabel: 'Sign out',
    })
    if (ok) logout()
  }

  return (
    // A full page of its own, not a pane inside the shell — so it owns the viewport
    // and the back button is always available rather than only on narrow screens.
    <div className="flex h-dvh min-h-0 flex-col bg-background">
      <header className="glass relative z-20 flex h-16 shrink-0 items-center gap-3 border-b px-3 sm:px-5">
        <IconButton label="Back to chats" onClick={() => navigate('/app')}>
          <ArrowLeft className="icon-lg" />
        </IconButton>
        <h1 className="flex-1 text-lg font-bold text-card-foreground">Settings</h1>
        <Button variant="ghost" size="sm" className="text-danger hover:bg-danger-soft" onClick={signOut}>
          <LogOut className="icon-sm" />
          Sign out
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
          <Tabs tabs={TABS} value={tab} onChange={setTab} className="mb-6" />

          {tab === 'profile' && <ProfileSection />}
          {tab === 'security' && <SecuritySection />}
          {tab === 'privacy' && <PrivacySection />}
        </div>
      </div>
    </div>
  )
}
