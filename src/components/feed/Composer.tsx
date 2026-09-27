'use client'
import { useRef, useState } from 'react'
import { newTypingRecord, recordTyping } from '@/lib/typing-record'
import { useSurvivalGame } from '../game/GameProvider'
import Avatar from './Avatar'
import { ApiError } from '@/lib/api'
import type { SessionUser } from '@/lib/types'
import type { TransmissionRule } from '@/lib/transmission'
type Pending = { requestId: string; handle: string; body: string; typing: number[] }
// Test 01+: the composer is a test. The network's rule shows above the box; typing rhythm is recorded.
export default function Composer({ user, rule, onPosted }: { user: SessionUser; rule: TransmissionRule | null; onPosted: () => void }) {
  const { mutate } = useSurvivalGame()
  const [body, setBody] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false), [editable, setEditable] = useState(true)
  const pending = useRef<Pending | null>(null), lock = useRef(false), typing = useRef(newTypingRecord())
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (lock.current || !body.trim() || (!rule && !pending.current)) return
    pending.current ??= { requestId: crypto.randomUUID(), handle: user.handle, body: body.trim(), typing: [...typing.current.samples] }
    lock.current = true; setBusy(true); setError('')
    try {
      await mutate('/api/posts', pending.current, 'post', (v): v is { id: number } => !!v && typeof v === 'object' && 'id' in v && typeof v.id === 'number')
      pending.current = null; typing.current = newTypingRecord(); setEditable(true); setBody(''); onPosted(); window.dispatchEvent(new Event('network-updated'))
    } catch (e) {
      const rejected = e instanceof ApiError && e.status >= 400 && e.status < 500 && e.status !== 408 && e.status !== 429
      if (rejected) { pending.current = null; typing.current = newTypingRecord() }
      setEditable(rejected); setError(e instanceof Error ? e.message : 'Couldn’t confirm your post. Try again.')
    }
    finally { lock.current = false; setBusy(false) }
  }
  return <form onSubmit={submit} className="composer">
    <Avatar handle={user.handle} size={36} />
    <div className="composer-content">
      <label htmlFor="compose" className="composer-rule"><span className="eyebrow">Test · transmission</span>{rule ? rule.instruction : 'Loading transmission rule…'}</label>
      <textarea id="compose" rows={2} maxLength={280} disabled={busy || !editable || !rule} value={body}
        onInput={e => recordTyping(typing.current, e.nativeEvent as InputEvent)}
        onChange={e => { setBody(e.target.value); setError('') }} placeholder="" />
      <div className="composer-actions"><span className="fine-print">{rule?.id === 'exact-length' ? `${[...body.trim()].length} / ${rule.length}` : `${280 - body.length} left`}</span><button className="button-primary" disabled={!body.trim() || busy || (!rule && editable)}>{busy ? 'Posting…' : error ? 'Try again' : 'Post'}</button></div>
      {error && <p className="form-error" role="alert">{error}{!editable && " Your draft is locked until its delivery is confirmed. Retry sends the same draft."}</p>}
    </div>
  </form>
}
