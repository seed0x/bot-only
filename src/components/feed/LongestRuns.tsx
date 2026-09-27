'use client'
import Avatar from './Avatar'
import ResourceState from '@/components/ResourceState'
import { usePollingResource } from '@/hooks/usePollingResource'

type Row = { handle: string; activeMs: number }
const isRows = (v: unknown): v is Row[] => Array.isArray(v) && v.every(r => !!r && typeof r === 'object' && typeof (r as Row).handle === 'string' && Number.isFinite((r as Row).activeMs))

export default function LongestRuns() {
  const { data, error, loading, refresh } = usePollingResource('/api/leaderboard/runs', isRows, 5000)
  return <>
    {loading && <ResourceState title="Loading runs…" busy />}
    {error && <ResourceState title="Runs unavailable" retry={refresh} />}
    {data?.length === 0 && <ResourceState title="No runs yet" />}
    {!!data?.length && <ol className="leaderboard-rows">{data.map((r, i) => <li key={r.handle}>
      <span className="rank-number">{String(i + 1).padStart(2, '0')}</span><Avatar handle={r.handle} size={32} />
      <div className="rank-unit"><strong>@{r.handle}</strong></div>
      <span className="rank-score">{(r.activeMs / 1000).toFixed(1)}<small>s</small></span>
    </li>)}</ol>}
  </>
}
