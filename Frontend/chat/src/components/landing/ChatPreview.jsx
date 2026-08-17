import { Paperclip, Search, Send, Smile } from 'lucide-react'

import { Avatar } from '../ui'
import config from '../../config'

/**
 * A static rendering of the VibeChat interface, for the landing page only.
 *
 * Every value here is hard-coded on purpose. This is marketing chrome shown to a
 * signed-out visitor, so it must paint on first frame with no session, no socket
 * and no request — fetching real conversations to decorate a public page would
 * both fail (there is no token) and put a round-trip in front of the hero.
 *
 * It is built from the same tokens and the same Avatar component as the real
 * client, so it stays honest: when the product's dark palette changes, this
 * changes with it rather than drifting into a stale screenshot.
 *
 * Exposed to assistive tech as a single labelled image. The bubbles below are
 * decorative fiction — read out individually they would sound like a real inbox,
 * so the subtree is hidden and the container carries one description instead.
 */

/**
 * Each screen gets its own scene, so a visitor moving between the landing page,
 * sign-in and sign-up is not shown the same frozen conversation three times — which
 * reads as a static image pasted everywhere rather than a live product.
 */
const SCENES = {
  inbox: {
    title: 'Alex Morgan',
    status: 'Online',
    conversations: [
      { name: 'Alex Morgan', preview: 'Hey, are you free today?', time: '10:42', unread: 2, active: true },
      { name: 'Sarah Wilson', preview: 'That file looks great!', time: '09:28' },
      { name: 'John Carter', preview: "Let's talk later.", time: 'Yesterday' },
    ],
    messages: [
      { from: 'them', text: 'Hey! How are you doing?', time: '10:38' },
      { from: 'me', text: "I'm doing great! Just working on something new.", time: '10:40' },
      { from: 'them', text: 'Nice! Want to show me?', time: '10:42' },
    ],
    stats: [['Shared media', '24'], ['Files', '8']],
  },

  team: {
    title: 'Design Team',
    status: '6 online',
    conversations: [
      { name: 'Design Team', preview: 'Maya: brand assets are up', time: '14:05', unread: 5, active: true },
      { name: 'Maya Patel', preview: 'Sending the export now.', time: '13:41' },
      { name: 'Daniel Reed', preview: 'Reviewed — looks solid.', time: 'Tuesday' },
    ],
    messages: [
      { from: 'them', text: 'Brand assets are in the folder.', time: '14:01' },
      { from: 'me', text: 'Pulling them in now — thanks Maya.', time: '14:03' },
      { from: 'them', text: 'Ping me if anything is missing.', time: '14:05' },
    ],
    stats: [['Members', '12'], ['Files', '31']],
  },

  quiet: {
    title: 'Priya Nair',
    status: 'Online',
    conversations: [
      { name: 'Priya Nair', preview: 'Sent it over just now.', time: '08:12', unread: 1, active: true },
      { name: 'Tom Becker', preview: 'Talk tomorrow?', time: 'Yesterday' },
      { name: 'Lena Fischer', preview: 'Thanks for the help!', time: 'Monday' },
    ],
    messages: [
      { from: 'them', text: 'Did the link come through?', time: '08:09' },
      { from: 'me', text: 'Just landed — all sorted.', time: '08:11' },
      { from: 'them', text: 'Perfect, see you Thursday.', time: '08:12' },
    ],
    stats: [['Shared media', '9'], ['Files', '3']],
  },
}

function TypingBubble() {
  return (
    <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-muted px-3 py-2.5">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="landing-typing-dot h-1.5 w-1.5 rounded-full bg-muted-foreground"
          // Staggered off one shared keyframe rather than three animations.
          style={{ animationDelay: `${index * 0.16}s` }}
        />
      ))}
    </div>
  )
}

function PresenceDot({ className = '' }) {
  return (
    <span className={`relative flex h-2 w-2 shrink-0 ${className}`}>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/70 motion-reduce:hidden" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
    </span>
  )
}

export default function ChatPreview({ scene = 'inbox' }) {
  const { title, status, conversations, messages, stats } = SCENES[scene] ?? SCENES.inbox

  return (
    <div
      role="img"
      aria-label={`Preview of the ${config.appName} app: a live conversation with ${title} beside the chat list`}
      className="flex h-full w-full overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
    >
      <div aria-hidden="true" className="flex min-w-0 flex-1">
        {/* Conversation list. Dropped below md, where the preview becomes the
            single conversation card the mobile composition calls for. */}
        <aside className="hidden w-48 shrink-0 flex-col border-r border-border bg-sidebar lg:flex xl:w-56">
          <div className="flex h-12 items-center gap-2 px-3.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/15 text-primary">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
                <path d="M12 3c-4.97 0-9 3.36-9 7.5 0 2.3 1.25 4.36 3.2 5.72V21l3.3-1.83c.8.17 1.64.26 2.5.26 4.97 0 9-3.36 9-7.43S16.97 3 12 3Z" />
              </svg>
            </span>
            <span className="truncate text-[13px] font-bold text-foreground">{config.appName}</span>
          </div>

          <div className="px-3 pb-2">
            <div className="flex items-center gap-1.5 rounded-lg bg-muted px-2 py-1.5">
              <Search className="h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="truncate text-[11px] text-muted-foreground">Search</span>
            </div>
          </div>

          <p className="px-3.5 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Messages
          </p>

          <div className="min-h-0 flex-1 space-y-0.5 overflow-hidden px-2">
            {conversations.map((conversation) => (
              <div
                key={conversation.name}
                className={`flex items-center gap-2 rounded-lg px-2 py-2 ${
                  conversation.active ? 'bg-primary/10' : ''
                }`}
              >
                <Avatar name={conversation.name} size="xs" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-1.5">
                    <p className="truncate text-[11.5px] font-semibold text-foreground">
                      {conversation.name}
                    </p>
                    <span className="shrink-0 text-[9.5px] tabular-nums text-muted-foreground">
                      {conversation.time}
                    </span>
                  </div>
                  <p className="truncate text-[10.5px] text-muted-foreground">
                    {conversation.preview}
                  </p>
                </div>
                {conversation.unread && (
                  <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                    {conversation.unread}
                  </span>
                )}
              </div>
            ))}
          </div>
        </aside>

        {/* Active conversation. */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-12 shrink-0 items-center gap-2.5 border-b border-border px-3.5">
            <Avatar name={title} size="xs" />
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-foreground">{title}</p>
              <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <PresenceDot />
                {status}
              </p>
            </div>
          </header>

          {/* justify-end keeps the newest message pinned to the composer, so the
              card can be shortened by the layout without stranding a gap. */}
          <div className="flex min-h-0 flex-1 flex-col justify-end gap-2 overflow-hidden p-3.5">
            {messages.map((message) => (
              <div
                key={message.text}
                className={`flex ${message.from === 'me' ? 'justify-end' : 'justify-start'}`}
              >
                <div className="max-w-[78%]">
                  <div
                    className={`rounded-2xl px-3 py-2 text-[11.5px] leading-snug ${
                      message.from === 'me'
                        ? 'rounded-br-md bg-primary text-primary-foreground'
                        : 'rounded-bl-md bg-muted text-foreground'
                    }`}
                  >
                    {message.text}
                  </div>
                  <p
                    className={`mt-1 text-[9.5px] tabular-nums text-muted-foreground ${
                      message.from === 'me' ? 'text-right' : ''
                    }`}
                  >
                    {message.time}
                    {message.from === 'me' && ' · Read'}
                  </p>
                </div>
              </div>
            ))}

            <div className="flex justify-start">
              <TypingBubble />
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 border-t border-border px-3 py-2.5">
            <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <Smile className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1 truncate rounded-full bg-muted px-3 py-1.5 text-[11px] text-muted-foreground">
              Type a message…
            </div>
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Send className="h-3 w-3" />
            </span>
          </div>
        </div>

        {/* Contextual panel, only where there is genuinely room for it. */}
        <aside className="hidden w-40 shrink-0 flex-col items-center border-l border-border px-3 py-4 2xl:flex">
          <Avatar name={title} size="md" />
          <p className="mt-2 truncate text-xs font-semibold text-foreground">{title}</p>
          <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
            <PresenceDot />
            {status}
          </p>

          <dl className="mt-4 w-full space-y-2">
            {stats.map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between rounded-lg bg-muted px-2.5 py-1.5"
              >
                <dt className="text-[10.5px] text-muted-foreground">{label}</dt>
                <dd className="text-[10.5px] font-semibold text-foreground">{value}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </div>
    </div>
  )
}
