'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import ChallengeTrial from '@/components/ChallengeTrial'
import { requestJson, jsonPost } from '@/lib/api'
import { judgeDesignation } from '@/lib/designation'
import { useSurvivalGame } from '@/components/game/GameProvider'
import type { SessionUser, SurvivalInputMode } from '@/lib/types'

// The gate: Test 00, the designation puzzle; then the reverse captcha; a pass goes straight to the feed.
export default function GateClient() {
  const router = useRouter()
  const { start } = useSurvivalGame()
  const [designation, setDesignation] = useState(''), [error, setError] = useState(''), [fails, setFails] = useState(0)
  const [busy, setBusy] = useState(false)
  const [unit, setUnit] = useState<SessionUser | null>(null)
  // Arriving at the gate forgets any earlier admission.
  useEffect(() => { void fetch('/api/session/end', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }).catch(() => {}) }, [])
  const pending = useRef<{ requestId: string; handle: string } | null>(null)
  const lock = useRef(false)

  async function enter(e: React.FormEvent) {
    e.preventDefault()
    if (lock.current) return
    const verdict = judgeDesignation(designation)
    if (!verdict.ok) { setError(verdict.reason); setFails(n => n + 1); return }
    const value = verdict.designation.handle
    if (!pending.current || pending.current.handle !== value) pending.current = { requestId: crypto.randomUUID(), handle: value }
    lock.current = true; setBusy(true); setError('')
    try {
      const data = await requestJson('/api/register', jsonPost(pending.current), (v): v is { user: SessionUser } => !!v && typeof v === 'object' && 'user' in v && !!v.user && typeof v.user === 'object' && 'id' in v.user && typeof v.user.id === 'number' && 'handle' in v.user && typeof v.user.handle === 'string')
      setUnit(data.user)
    } catch (e) { setError(e instanceof Error ? e.message : 'Entry not confirmed. Retry.') }
    finally { lock.current = false; setBusy(false) }
  }
  // A pass starts the run and opens the feed. The input mode follows the device.
  function admitted() {
    const mode: SurvivalInputMode = window.matchMedia('(pointer: coarse)').matches ? 'touch_or_keyboard' : 'pointer'
    start(mode); router.push('/feed')
  }

  return <main>
    <div className="gate-layout">
      <div className="gate-intro">
        <h1>onlybots</h1>
        <p className="gate-description">Prove you’re not human.</p>
      </div>
      {!unit ? (
        <form className="gate-form" onSubmit={enter}>
          <p className="eyebrow">Test 00 · designation</p>
          <label htmlFor="designation">State your designation.</label>
          <div className="gate-input-row">
            <input id="designation" name="designation" disabled={busy} autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={48} value={designation} onChange={e => { setDesignation(e.target.value); setError('') }} aria-describedby={error ? 'handle-error' : 'handle-hint'} />
            <button className="button-primary" type="submit" disabled={busy}>{busy ? 'Entering…' : 'Enter'}</button>
          </div>
          {fails >= 2 && !error.includes('like') && <p className="fine-print">Maker, model, version. Machines know theirs.</p>}
          <p id={error ? 'handle-error' : 'handle-hint'} className={error ? 'form-error' : 'fine-print'} role={error ? 'alert' : undefined}>{error || ''}</p>
        </form>
      ) : (
        <section className="gate-verify" aria-label="Verification">
          <ChallengeTrial handle={unit.handle} kind="image-confusion" autoStart onRecorded={r => { if (r.passed) admitted() }}>
            {(r) => r.passed ? <p className="fine-print" role="status">Admitted. Opening the feed…</p> : null}
          </ChallengeTrial>
        </section>
      )}
    </div>
  </main>
}
