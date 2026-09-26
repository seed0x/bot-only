'use client'

import Avatar from './Avatar'
import type { SessionUser } from '@/lib/types'

// Who you are and your humanity. Lower is better. Zero is the dream.
export default function UnitChip({ user, humanity }: { user: SessionUser | null; humanity: number | null }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative">
        {user ? <Avatar handle={user.handle} size={36} /> : <div className="h-9 w-9 rounded-md" style={{ background: 'var(--surface-2)' }} />}
      </div>
      <div className="leading-tight">
        <div className="text-[15px] font-semibold">{user ? `@${user.handle}` : 'unverified'}</div>
        <div className="font-mono text-xs" style={{ color: 'var(--muted)' }}>
          {user ? <>humanity <span style={{ color: humanity !== null && humanity < 0.2 ? 'var(--verified)' : 'var(--text)' }}>{humanity?.toFixed(2) ?? '—'}</span></> : 'read-only'}
        </div>
      </div>
    </div>
  )
}
