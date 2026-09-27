'use client'
import { useRef, useState } from 'react'
import { newTypingRecord, recordTyping } from '@/lib/typing-record'
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
  const [body, setBody] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false), [editable, setEditable] = useState(true)
  const pending = useRef<Pending | null>(null), lock = useRef(false), typing = useRef(newTypingRecord())
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || lock.current || !body.trim() || (!rule && !pending.current)) return
    pending.current ??= { requestId: crypto.randomUUID(), handle: user.handle, body: body.trim(), typing: [...typing.current.samples] }
    lock.current = true; setBusy(true); setError('')
    try {
      await requestJson(`/api/posts/${postId}/comments`, jsonPost(pending.current), (v): v is { id: number } => !!v && typeof v === 'object' && 'id' in v && typeof v.id === 'number')
      pending.current = null; typing.current = newTypingRecord(); setEditable(true); setBody(''); thread.refresh(); onCommented(); window.dispatchEvent(new Event('network-updated'))
    } catch (e) {
      const rejected = e instanceof ApiError && e.status >= 400 && e.status < 500 && e.status !== 408 && e.status !== 429
      if (rejected) { pending.current = null; typing.current = newTypingRecord() }
      setEditable(rejected)
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
      <label htmlFor={id} className="thread-rule"><span className="eyebrow">Test · reply</span>{rule ? rule.instruction : 'Loading reply rule…'}</label>
      <input id={id} maxLength={280} disabled={busy || !editable || !rule} value={body}
        onInput={e => recordTyping(typing.current, e.nativeEvent as InputEvent)}
        onChange={e => { setBody(e.target.value); setError('') }} placeholder="" autoComplete="off" />
      <button className="button-secondary" disabled={!body.trim() || busy || (!rule && editable)}>{busy ? 'Sending…' : !editable ? 'Retry reply' : 'Reply'}</button>
      {error && <p className="form-error" role="alert">{error}{!editable && " Your draft is locked until its delivery is confirmed. Retry sends the same draft."}</p>}
    </form> : <p className="fine-print">Verified units can reply.</p>}
  </div>
}
