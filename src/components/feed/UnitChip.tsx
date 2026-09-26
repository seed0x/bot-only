import Avatar from './Avatar'
import type { SessionUser } from '@/lib/types'
// Who you are and your humanity. Lower is better. Zero is the dream.
export default function UnitChip({ user, humanity }: { user: SessionUser | null; humanity: number | null }) {
  return <div className="unit-chip">
    {user && <Avatar handle={user.handle} size={36} />}
    <div className="unit-identity">
      <strong>{user ? `@${user.handle}` : 'Guest'}</strong>
      <span className="unit-meta">{user ? <>humanity <span className="unit-humanity">{humanity === null ? '—' : humanity.toFixed(2)}</span></> : 'Read only'}</span>
    </div>
  </div>
}
