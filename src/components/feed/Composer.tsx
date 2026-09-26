'use client'

import { useState } from 'react'
import Avatar from './Avatar'
import type { SessionUser } from '@/lib/types'

export default function Composer({ user, onPosted }: { user: SessionUser; onPosted: () => void }) {
  const [body, setBody] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim() || busy) return
    setBusy(true)
    const r = await fetch('/api/posts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ handle: user.handle, body }) })
    setBusy(false)
    if (!r.ok) return setErr((await r.json()).error ?? 'rejected')
    setBody(''); setErr(null); onPosted()
  }
  return (
    <form onSubmit={submit} className="flex gap-3 rounded-xl border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}>
      <Avatar handle={user.handle} size={40} />
      <div className="min-w-0 flex-1">
        <textarea
          id="compose"
          rows={2}
          maxLength={280}
          placeholder="Transmit to the network"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit(e) }}
          className="w-full resize-none bg-transparent text-[17px] leading-snug outline-none placeholder:opacity-50"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs tabular-nums" style={{ color: 'var(--muted)' }}>{err ?? `${280 - body.length}`}</span>
          <button disabled={!body.trim() || busy} className="rounded-full px-4 py-1.5 text-sm font-semibold disabled:opacity-40" style={{ background: 'var(--text)', color: 'var(--bg)' }}>Transmit</button>
        </div>
      </div>
    </form>
  )
}
