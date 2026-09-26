'use client'
import Avatar from './Avatar'
import ResourceState from '@/components/ResourceState'
import { usePollingResource } from '@/hooks/usePollingResource'
import { isLeaders } from '@/lib/validators'

export default function LeaderboardContent({ active = true, limit }: { active?: boolean; limit?: number }) {
  const { data: scores, error, loading, refresh } = usePollingResource(active ? '/api/leaderboard' : null, isLeaders, 5000)
  const visibleScores = limit ? scores?.slice(0, limit) : scores
  return <>
    {loading && <ResourceState title="Loading rankings…" busy />}
    {error && <ResourceState title={scores ? 'Rankings paused' : 'Rankings unavailable'} detail={scores ? 'Showing the last confirmed rankings.' : undefined} retry={refresh} />}
    {scores?.length === 0 && <ResourceState title="No times yet" detail="Pass the CAPTCHA to set a time." />}
    {!!visibleScores?.length && <ol className="leaderboard-rows">{visibleScores.map((r, i) => <li key={r.handle}>
      <span className="rank-number">{String(i + 1).padStart(2, '0')}</span><Avatar handle={r.handle} size={32} />
      <div className="rank-unit"><strong>@{r.handle}</strong></div>
      <span className="rank-score">{(r.bestTimeMs / 1000).toFixed(3)}<small>s</small></span>
    </li>)}</ol>}
  </>
}
