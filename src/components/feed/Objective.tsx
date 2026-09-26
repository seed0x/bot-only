'use client'
import type { ObjectiveProgress, SessionUser } from '@/lib/types'
import { usePollingResource } from '@/hooks/usePollingResource'
import ResourceState from '../ResourceState'

function isObjectives(v: unknown): v is ObjectiveProgress {
  if (!v || typeof v !== 'object') return false
  return 'post' in v && typeof v.post === 'boolean' && 'like' in v && typeof v.like === 'boolean'
    && 'comment' in v && (v.comment === null || typeof v.comment === 'boolean')
}
export default function Objective({ user, refreshKey }: { user: SessionUser | null; refreshKey: number }) {
  const { data, error, refresh } = usePollingResource(user ? `/api/objectives?handle=${encodeURIComponent(user.handle)}&refresh=${refreshKey}` : null, isObjectives)
  const available = data ? [data.post, data.like, ...(data.comment === null ? [] : [data.comment])] : []
  return <section aria-label="Objectives" className="objectives-panel">
    <div className="objectives-heading"><h2>Objectives</h2>{data && <span>{available.filter(Boolean).length} / {available.length}</span>}</div>
    {!user ? <ResourceState title="Join to track your progress" />
      : !data && !error ? <ResourceState title="Loading objectives…" busy /> : null}
    {error && <ResourceState title={data ? 'Updates paused' : 'Objectives unavailable'} retry={refresh} />}
    {data && <ul className="objective-list">{(['post', 'comment', 'like'] as const).map(key => <li key={key} className={data[key] === null ? 'objective-unavailable' : ''}>
      <span className={`objective-check${data[key] ? ' objective-done' : ''}`} aria-hidden="true">{data[key] ? '✓' : data[key] === null ? '—' : ''}</span>
      <span>{key[0].toUpperCase() + key.slice(1)}</span>
      <span className={data[key] === null ? 'objective-status' : 'sr-only'}>{data[key] === null ? 'Unavailable' : data[key] ? 'Completed' : 'Not completed'}</span>
    </li>)}</ul>}
  </section>
}
