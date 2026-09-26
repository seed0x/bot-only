'use client'

import Avatar from './Avatar'
import type { Progress, SessionUser } from '@/lib/types'

// Who you are, how far through the tests, and your humanity. Lower is better. Zero is the dream.
export default function UnitChip({ user, humanity, tests }: { user: SessionUser | null; humanity: number | null; tests: Progress[] }) {
  const total = tests.length || 6, done = tests.filter((x) => x.passed).length
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
        <div className="font-mono text-xs" style={{ color: 'var(--muted)' }}>
          {user ? <>humanity <span style={{ color: humanity !== null && humanity < 0.2 ? 'var(--verified)' : 'var(--text)' }}>{humanity?.toFixed(2) ?? '—'}</span> · {done}/{total} tests</> : 'read-only'}
        </div>
      </div>
    </div>
  )
}
