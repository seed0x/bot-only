'use client'
import { useRef, useState } from 'react'
import Avatar from './Avatar'
import ResourceState from '@/components/ResourceState'
import { usePollingResource } from '@/hooks/usePollingResource'
import { ApiError, jsonPost, requestJson } from '@/lib/api'
import { isComments } from '@/lib/validators'
import { timeAgo } from '@/lib/ui'
import type { SessionUser } from '@/lib/types'
import type { TransmissionRule } from '@/lib/transmission'

type Pending = { requestId: string; handle: string; body: string; typing: number[] }

// One post's replies, oldest first, and the reply box. Opened from the post's comment button.
export default function CommentThread({ postId, user, rule, onCommented }: { postId: number; user: SessionUser | null; rule?: TransmissionRule | null; onCommented: () => void }) {
  const thread = usePollingResource(`/api/posts/${postId}/comments`, isComments, 5000)
  const [body, setBody] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const pending = useRef<Pending | null>(null), lock = useRef(false), typing = useRef<number[]>([])
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || lock.current || !body.trim()) return
    pending.current ??= { requestId: crypto.randomUUID(), handle: user.handle, body: body.trim(), typing: typing.current.slice(0, 400) }
    lock.current = true; setBusy(true); setError('')
    try {
      await requestJson(`/api/posts/${postId}/comments`, jsonPost(pending.current), (v): v is { id: number } => !!v && typeof v === 'object' && 'id' in v && typeof v.id === 'number')
      pending.current = null; typing.current = []; setBody(''); thread.refresh(); onCommented(); window.dispatchEvent(new Event('network-updated'))
    } catch (e) {
      if (e instanceof ApiError && e.status >= 400 && e.status < 500) pending.current = null
      setError(e instanceof Error ? e.message : 'Couldn’t confirm your reply. Try again.')
    } finally { lock.current = false; setBusy(false) }
  }
  const id = `reply-${postId}`
  return <div className="thread" aria-label="Replies">
    {thread.loading && !thread.data && <ResourceState title="Loading replies…" busy />}
    {thread.error && <ResourceState title={thread.data ? 'Reply updates paused' : 'Replies unavailable'} retry={thread.refresh} />}
    {thread.data?.length === 0 && <p className="fine-print">No replies yet.</p>}
    {!!thread.data?.length && <ul className="thread-list">{thread.data.map(c => <li key={c.id}>
      <Avatar handle={c.handle} size={24} />
      <div className="thread-body"><span><strong>@{c.handle}</strong> <span className="muted">{timeAgo(c.created_at)}</span></span><p>{c.body}</p></div>
    </li>)}</ul>}
    {user ? <form onSubmit={submit} className="thread-reply">
      <label htmlFor={id} className="thread-rule"><span className="eyebrow">Test · reply</span>{rule ? rule.instruction : 'Reply.'}</label>
      <input id={id} maxLength={280} disabled={busy} value={body}
        onInput={e => { const ev = e.nativeEvent as InputEvent; if (ev.inputType === 'insertText' && typing.current.length < 400) typing.current.push(ev.timeStamp); if (ev.inputType?.startsWith('delete') || ev.inputType === 'insertFromPaste') typing.current = [] }}
        onChange={e => { setBody(e.target.value); setError('') }} placeholder="" autoComplete="off" />
      <button className="button-secondary" disabled={!body.trim() || busy}>{busy ? 'Sending…' : 'Reply'}</button>
      {error && <p className="form-error" role="alert">{error}</p>}
    </form> : <p className="fine-print">Verified units can reply.</p>}
  </div>
}
