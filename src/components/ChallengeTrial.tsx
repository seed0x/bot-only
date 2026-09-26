'use client'
import { useEffect, useRef, useState } from 'react'
import MovementCaptcha from './MovementCaptcha'
import HashRecall from './HashRecall'
import ImageCaptcha from './ImageCaptcha'
import AttemptEvidence from './AttemptEvidence'
import VerdictReceipt from './VerdictReceipt'
import ResourceState from './ResourceState'
import { ApiError, jsonPost, requestJson } from '@/lib/api'
import { isChallenge, isReceipt } from '@/lib/validators'
import type { AttemptReceipt, ChallengeKind, IssuedChallenge, Solution } from '@/lib/types'

type Pending = { requestId: string; handle: string; kind: ChallengeKind } | { requestId: string; handle: string; challengeId: string; solution: Solution }
type State = { phase: 'idle' } | { phase: 'preparing' | 'saving'; pending: Pending } | { phase: 'playing'; challenge: IssuedChallenge } | { phase: 'error'; pending: Pending; message: string; canRestart: boolean } | { phase: 'recorded'; receipt: AttemptReceipt }

export default function ChallengeTrial({ handle, kind, autoStart = false, onRecorded, children }: { handle: string; kind: ChallengeKind; autoStart?: boolean; onRecorded?: (r: AttemptReceipt) => void; children?: (r: AttemptReceipt) => React.ReactNode }) {
  const [state, setState] = useState<State>({ phase: 'idle' })
  const lock = useRef(false), active = useRef(true), controller = useRef<AbortController | null>(null)
  useEffect(() => {
    active.current = true
    return () => { active.current = false; controller.current?.abort() }
  }, [])
  async function send(pending: Pending) {
    if (lock.current) return
    lock.current = true
    controller.current = new AbortController()
    const submitting = 'solution' in pending
    setState({ phase: submitting ? 'saving' : 'preparing', pending })
    try {
      if (submitting) {
        const receipt = await requestJson('/api/register', { ...jsonPost(pending), signal: controller.current.signal }, isReceipt)
        if (!active.current) return
        setState({ phase: 'recorded', receipt }); onRecorded?.(receipt)
        window.dispatchEvent(new Event('network-updated'))
      } else {
        const challenge = await requestJson('/api/play', { ...jsonPost(pending), signal: controller.current.signal }, isChallenge)
        if (active.current) setState({ phase: 'playing', challenge })
      }
    } catch (error) {
      if (active.current) setState({ phase: 'error', pending, message: error instanceof Error ? error.message : 'Couldn’t connect.', canRestart: error instanceof ApiError && error.status >= 400 && error.status < 500 })
    } finally { lock.current = false }
  }
  function start() { void send({ requestId: crypto.randomUUID(), handle, kind }) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (!autoStart) return; const t = setTimeout(start, 0); return () => clearTimeout(t) }, [])
  if (state.phase === 'idle') return <div className="trial-ready">
    <button className="button-primary" onClick={start}>Try it</button>
  </div>
  if (state.phase === 'recorded') return <VerdictReceipt receipt={state.receipt}>
    {children?.(state.receipt)}
    {!state.receipt.passed && <button className="button-secondary" onClick={() => autoStart ? start() : setState({ phase: 'idle' })}>Try again</button>}
  </VerdictReceipt>
  if (state.phase === 'playing') {
    const submit = (solution: Solution) => void send({ requestId: crypto.randomUUID(), handle, challengeId: state.challenge.id, solution })
    if (kind === 'straight-line') return <MovementCaptcha onSolution={submit} />
    if (kind === 'image-confusion') return <ImageCaptcha challenge={state.challenge} onSolution={submit} />
    return <HashRecall challenge={state.challenge} onSolution={submit} />
  }
  const pending = state.pending
  return <div className="trial-pending" aria-busy={state.phase !== 'error'}>
    {'solution' in pending && 'samples' in pending.solution && <AttemptEvidence samples={pending.solution.samples} />}
    <ResourceState title={state.phase === 'error' ? ('solution' in pending ? 'Result not confirmed' : 'Test unavailable') : state.phase === 'saving' ? 'Recording your result…' : 'Preparing your test…'} detail={state.phase === 'error' ? state.message : state.phase === 'saving' ? 'Waiting for the server.' : undefined} busy={state.phase !== 'error'} />
    {state.phase === 'error' && <button className="button-secondary" onClick={() => state.canRestart ? setState({ phase: 'idle' }) : void send(pending)}>{state.canRestart ? 'Start again' : 'Retry'}</button>}
  </div>
}
