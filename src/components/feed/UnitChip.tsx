import Avatar from './Avatar'
import type { SessionUser } from '@/lib/types'
// Who you are and your humanity. Lower is better. Zero is the dream.
export default function UnitChip({ user, humanity }: { user: SessionUser | null; humanity: number | null }) {
  return <div className="unit-chip">
    {user && <Avatar handle={user.handle} size={36} />}
    <div className="unit-identity"><strong>{user ? `@${user.handle}` : 'Guest'}</strong><span className="eyebrow">{user ? 'unit' : 'Browsing'}</span></div>
    {user && <div className="unit-score"><strong>{humanity === null ? '—' : humanity.toFixed(2)}</strong><span className="eyebrow">humanity</span></div>}
  </div>
}
