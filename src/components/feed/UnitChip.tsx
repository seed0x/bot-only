'use client'

import { useEffect, useState } from 'react'
import Avatar from './Avatar'
import type { Progress, SessionUser } from '@/lib/types'

// Who you are, and how far through the gauntlet. The ring is challenges passed / total.
export default function UnitChip({ user }: { user: SessionUser | null }) {
  const [p, setP] = useState<Progress[]>([])
  useEffect(() => {
    if (!user) return
    let alive = true
    fetch(`/api/progress?handle=${encodeURIComponent(user.handle)}`).then((r) => r.json()).then((d) => alive && setP(d))
    return () => { alive = false }
  }, [user])
  const total = p.length || 6, done = p.filter((x) => x.passed).length
  const r = 15, c = 2 * Math.PI * r
  return (
    <div className="flex items-center gap-3">
      <div className="relative">
        {user ? <Avatar handle={user.handle} size={36} /> : <div className="h-9 w-9 rounded-md" style={{ background: 'var(--surface-2)' }} />}
        <svg className="absolute -inset-1.5" viewBox="0 0 40 40" aria-hidden>
          <circle cx="20" cy="20" r={r} fill="none" stroke="var(--line)" strokeWidth="2" />
          <circle cx="20" cy="20" r={r} fill="none" stroke="var(--verified)" strokeWidth="2" strokeLinecap="round"
            strokeDasharray={`${(done / total) * c} ${c}`} transform="rotate(-90 20 20)" />
        </svg>
      </div>
      <div className="leading-tight">
        <div className="text-[15px] font-semibold">{user ? `@${user.handle}` : 'unverified'}</div>
        <div className="text-xs" style={{ color: 'var(--muted)' }}>{user ? `${done}/${total} challenges · verified unit` : 'read-only'}</div>
      </div>
    </div>
  )
}
