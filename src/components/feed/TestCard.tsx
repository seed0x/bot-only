'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import type { CaptchaResult, Progress, SessionUser } from '@/lib/types'

const MovementCaptcha = dynamic(() => import('@/components/MovementCaptcha'), { ssr: false })
const HashRecall = dynamic(() => import('@/components/HashRecall'), { ssr: false })

// A test issued by @system into the timeline. Play it here; the result posts to the network.
const PLAYERS: Record<string, React.ComponentType<{ onResult: (r: CaptchaResult) => void }>> = {
  'straight-line': MovementCaptcha,
  'hash-recall': HashRecall,
}

export default function TestCard({ test, index, user, onResult }: { test: Progress; index: number; user: SessionUser | null; onResult: () => void }) {
  const [open, setOpen] = useState(false)
  const [last, setLast] = useState<CaptchaResult | null>(null)
  const [busy, setBusy] = useState(false)
  const Player = PLAYERS[test.id]

  async function submit(r: CaptchaResult) {
    if (!user) return
    setBusy(true)
    await fetch('/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ handle: user.handle, result: r }) })
    setBusy(false); setLast(r); onResult()
  }

  return (
    <article className="my-3 rounded-xl border" style={{ borderColor: test.passed ? 'var(--verified)' : 'var(--line)', background: 'var(--surface)' }}>
      <div className="flex items-start gap-3 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md font-mono text-xs font-bold" style={{ background: 'var(--surface-2)', color: 'var(--verified)' }}>SYS</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 text-[15px]">
            <span className="font-semibold">@system</span>
            <span className="font-mono text-xs uppercase tracking-wider" style={{ color: 'var(--muted)' }}>test {String(index + 1).padStart(2, '0')}</span>
            {test.passed && <span className="ml-auto font-mono text-xs" style={{ color: 'var(--verified)' }}>passed · {test.best_score?.toFixed(2)}</span>}
          </div>
          <p className="mt-1 text-[16px] leading-snug"><span className="font-semibold">{test.name}.</span> {test.hint}</p>
          {!open && (
            <button
              onClick={() => setOpen(true)}
              disabled={!user || !Player}
              className="mt-3 rounded-full px-4 py-1.5 text-sm font-semibold disabled:opacity-40"
              style={{ background: test.passed ? 'transparent' : 'var(--text)', color: test.passed ? 'var(--text)' : 'var(--bg)', border: test.passed ? '1px solid var(--line)' : 'none' }}
            >
              {user ? (test.passed ? 'Attempt again' : 'Attempt') : 'Verify to attempt'}
            </button>
          )}
        </div>
      </div>
      {open && Player && (
        <div className="border-t p-4" style={{ borderColor: 'var(--line)' }}>
          <Player key={last ? last.duration_ms : 'first'} onResult={submit} />
          <div className="mt-3 flex items-center gap-3 text-xs" style={{ color: 'var(--muted)' }}>
            {busy && <span>transmitting result…</span>}
            {last && !busy && (
              <>
                <span style={{ color: last.passed ? 'var(--verified)' : 'var(--danger)' }}>{last.passed ? 'Result posted: verified.' : 'Result posted: human.'}</span>
                <button onClick={() => setLast(null)} className="underline">retry</button>
                <button onClick={() => { setOpen(false); setLast(null) }} className="underline">close</button>
              </>
            )}
          </div>
        </div>
      )}
    </article>
  )
}
