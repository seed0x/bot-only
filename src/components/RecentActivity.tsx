'use client'
import { useState } from 'react'
import { usePollingResource } from '@/hooks/usePollingResource'
import { isActivity } from '@/lib/validators'
import { isResults } from '@/lib/results'
import { timeAgo } from '@/lib/ui'
import VerdictReceipt from './VerdictReceipt'
import ResourceState from './ResourceState'
import Avatar from './feed/Avatar'

const action: Record<string, string> = { pass: 'passed a test', fail: 'failed a test', join: 'joined', post: 'posted', like: 'liked a post' }
export function RecentResults() {
  const results = usePollingResource('/api/results', isResults, 3000)

  const [paused, setPaused] = useState(false)
  const [snapshot, setSnapshot] = useState<typeof results.data>()
  const rows = paused ? snapshot : results.data
  const passed = rows?.find(row => row.passed)
  const failed = rows?.find(row => !row.passed)
  return <section className="recent-results-panel" aria-label="Recent verification results">
    <div className="activity-heading"><div><h2>Recent results</h2></div>
      <button className="activity-live text-button" disabled={!results.data} aria-pressed={paused} onClick={() => {
        if (!paused) { setSnapshot(results.data) }
        setPaused(!paused)
      }}><span className={`signal-dot${paused || results.error ? ' signal-paused' : ''}`} aria-hidden="true" />{paused ? 'Resume' : 'Pause updates'}</button>
    </div>
    {results.error && <ResourceState title={rows ? 'Results updates paused' : 'Results unavailable'} detail={rows ? 'Showing the last confirmed results.' : 'Your verification is unchanged.'} retry={results.refresh} />}
    {!rows && !results.error && <ResourceState title="Loading results…" busy />}
    {rows?.length === 0 && <ResourceState title="No results yet" detail="The first image CAPTCHA result will appear here." />}
    {rows && rows.length > 0 && <div className="gate-results-grid">{[failed, passed].map((row, index) => row
      ? <VerdictReceipt key={row.attemptId} receipt={row} compact />
      : <div className="result-waiting" key={index}><span className="result-waiting-mark" aria-hidden="true">{index === 0 ? '×' : '✓'}</span><p>No recent {index === 0 ? 'failed' : 'passed'} attempts</p></div>)}</div>}
  </section>
}

export default function RecentActivity() {
  const activity = usePollingResource('/api/activity', isActivity, 3000)
  const timeline = activity.data
  return <section className="recent-activity" aria-label="Recent activity">
    <div className="activity-log"><h2>Recent activity</h2>
      {activity.error && <ResourceState title={timeline ? 'Activity updates paused' : 'Activity unavailable'} retry={activity.refresh} />}
      {!timeline && !activity.error && <ResourceState title="Loading activity…" busy />}
      {timeline?.length === 0 && <ResourceState title="Nothing here yet" detail="Posts, likes and attempts appear as they happen." />}
      <ol>{timeline?.slice(0, 5).map(event => <li key={event.id}>
        <Avatar handle={event.handle} size={24} />
        <div><span className="activity-person">@{event.handle}</span> <span className="muted">{action[event.kind] ?? event.kind}</span></div>
        <time className="activity-time" dateTime={event.created_at.replace(' ', 'T') + 'Z'}>{timeAgo(event.created_at)}</time>
        <span className={`activity-kind activity-${event.kind}`}>{event.kind === 'pass' ? 'Passed' : event.kind === 'fail' ? 'Failed' : event.kind}</span>
      </li>)}</ol>
    </div>
  </section>
}
