'use client'
import { useRef, useState } from 'react'
import { useSurvivalGame } from '../game/GameProvider'
import Avatar from './Avatar'
import { ApiError } from '@/lib/api'
import type { SessionUser } from '@/lib/types'
type Pending = { requestId: string; handle: string; body: string }
export default function Composer({ user, onPosted }: { user: SessionUser; onPosted: () => void }) {
  const { mutate } = useSurvivalGame()
  const [body, setBody] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false), [editable, setEditable] = useState(true)
  const pending = useRef<Pending | null>(null), lock = useRef(false)
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (lock.current || !body.trim()) return
    pending.current ??= { requestId: crypto.randomUUID(), handle: user.handle, body: body.trim() }
    lock.current = true; setBusy(true); setError('')
    try {
      await mutate('/api/posts', pending.current, 'post', (v): v is { id: number } => !!v && typeof v === 'object' && 'id' in v && typeof v.id === 'number')
      pending.current = null; setEditable(true); setBody(''); onPosted(); window.dispatchEvent(new Event('network-updated'))
    } catch (e) {
      const rejected = e instanceof ApiError && e.status >= 400 && e.status < 500
      if (rejected) pending.current = null
      setEditable(rejected); setError(e instanceof Error ? e.message : 'Couldn’t confirm your post. Try again.')
    }
    finally { lock.current = false; setBusy(false) }
  }
  return <form onSubmit={submit} className="composer is-holo">
    <Avatar handle={user.handle} size={36} />
    <div className="composer-content">
      <label htmlFor="compose" className="eyebrow">New post</label>
      <textarea id="compose" rows={2} maxLength={280} disabled={busy || !editable} value={body} onChange={e => { setBody(e.target.value); setError('') }} placeholder="What’s happening?" />
      <div className="composer-actions"><span className="fine-print">{280 - body.length} characters left</span><button className="button-primary" disabled={!body.trim() || busy}>{busy ? 'Posting…' : error ? 'Try again' : 'Post'}</button></div>
      {error && <p className="form-error" role="alert">{error} Your draft is saved here.</p>}
    </div>
  </form>
}
