'use client'
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { ApiError, jsonPost, requestJson } from '@/lib/api'
import { isStartReceipt, isBindReceipt, isCompletion, isFinishReceipt, isFinishRequest } from '@/lib/survival/receipts'
import type { SessionUser, SurvivalFinishReceipt, SurvivalFinishRequest, Post, SurvivalObjective, SurvivalObjectiveSubmission, SurvivalStartRequest, SurvivalStartReceipt, SurvivalBindReceipt, SurvivalObjectiveReceipt, SurvivalDetectorResult, SurvivalEvent, SurvivalInputMode, SurvivalPauseReason, SurvivalRunState } from '@/lib/types'
import { createSurvivalState, transitionSurvival } from '@/lib/survival/engine'
import { SURVIVAL_ID_PATTERN, SURVIVAL_LIMITS, SURVIVAL_RULES_VERSION, SURVIVAL_TIMING, survivalStageAt } from '@/lib/survival/config'
import { installSurvivalSensors } from '@/lib/survival/browser'
import GameHud from './GameHud'
import GameOver from './GameOver'

const checkpointKey = 'bot-only-survival-diagnostic-v1'
type Mutation = { url: string; body: Record<string, unknown>; game: SurvivalObjectiveSubmission; validate: (v: unknown) => boolean; result?: unknown; busy?: boolean }
type Start = { request: SurvivalStartRequest; receipt?: SurvivalStartReceipt; bindId: string; handle?: string; verified?: boolean }
type GameContextValue = {
  state: SurvivalRunState; readings: Partial<Record<SurvivalDetectorResult['detector'], SurvivalDetectorResult>>
  storageError: string | null; networkError: string | null; starting: boolean; fallback: string | null; retryMutation: () => void
  resource: (owner: 'like_targets' | 'gate_challenge' | 'feed_identity', blocked: boolean) => void
  targets: (posts: Post[] | null) => void
  mutate: <T>(url: string, body: Record<string, unknown>, kind: SurvivalObjective['kind'], validate: (v: unknown) => v is T, postId?: number) => Promise<T>
  saveState: 'idle' | 'saving' | 'saved' | 'error'; saveError: string | null; saveResult: () => Promise<SurvivalFinishReceipt | null>; end: () => Promise<void>; restart: () => Promise<void>
  start: (mode: SurvivalInputMode) => void; resume: () => void
  pause: (reason: SurvivalPauseReason, acquired: boolean) => void
}
const GameContext = createContext<GameContextValue | null>(null)
export function useSurvivalGame() {
  const value = useContext(GameContext)
  if (!value) throw new Error('Survival game requires GameProvider.')
  return value
}

export default function GameProvider({ children }: { children: React.ReactNode }) {
  const current = useRef(createSurvivalState())
  const lastCheckpoint = useRef<string | null>(null)
  const sensors = useRef<ReturnType<typeof installSurvivalSensors> | null>(null)
  const [state, setState] = useState(createSurvivalState)
  const [readings, setReadings] = useState<GameContextValue['readings']>({})
  const [storageError, setStorageError] = useState<string | null>(null)
  const [networkError, setNetworkError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [fallback, setFallback] = useState<string | null>(null)
  const startPending = useRef<Start | null>(null), startLock = useRef(false), generation = useRef(0)
  const mutation = useRef<Mutation | null>(null)
  const confirmed = useRef(new Map<string, Mutation>())
  const available = useRef<Post[] | null>(null)
  const nextKind = useRef<SurvivalObjective['kind'] | null>(null)
  const mounted = useRef(true)
  const resources = useRef(new Set<string>())
  const pathname = usePathname()
  const [saveState, setSaveState] = useState<GameContextValue['saveState']>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const finishPending = useRef<SurvivalFinishRequest | null>(null)
  const finishReceipt = useRef<SurvivalFinishReceipt | null>(null)
  const finishFlight = useRef<Promise<SurvivalFinishReceipt | null> | null>(null)
  const persist = useCallback(() => {
    try {
      const s = current.current
      // A checkpoint is only a neutral reload result, never a resumable engine state.
      if (s.run && !finishReceipt.current) {
        const payload = JSON.stringify({ run: s.run, activeMs: s.activeMs, completedObjectiveIds: s.completedObjectiveIds, ...(finishPending.current ? { finish: finishPending.current } : {}) })
        if (payload !== lastCheckpoint.current) { sessionStorage.setItem(checkpointKey, payload); lastCheckpoint.current = payload }
      }
      else sessionStorage.removeItem(checkpointKey)
      setStorageError(null)
    } catch { setStorageError('Session storage unavailable. Reload interruption cannot be retained.') }
  }, [])
  const emit = useCallback((event: SurvivalEvent) => {
    const next = transitionSurvival(current.current, event)
    current.current = next.state
    if (next.resetDetectors.length) sensors.current?.reset()
    // The 100ms pulse bounds clock-only renders; input changes publish only warnings/failure.
    if (event.type !== 'activity' && event.type !== 'sensor_reset' || next.state.phase === 'ended') setState(next.state)
  }, [])
  const pause = useCallback((reason: SurvivalPauseReason, acquired: boolean) => {
    emit({ type: acquired ? 'pause_acquired' : 'pause_released', reason, atMs: performance.now() })
  }, [emit])
  const resource = useCallback((owner: 'like_targets' | 'gate_challenge' | 'feed_identity', blocked: boolean) => {
    if (blocked) resources.current.add(owner)
    else resources.current.delete(owner)
    pause('required_resource', false)
  }, [pause])
  const conditions = useCallback(() => {
    // No pauses: the run keeps counting whatever the tab or page does.
    pause('hidden', false); pause('blurred', false); pause('leaderboard', false)
  }, [pause])
  const issue = useCallback((kind: SurvivalObjective['kind']) => {
    const s = current.current
    if (!s.run || s.phase === 'ended' || s.pendingObjective) return
    // Like targets must come from confirmed visible feed data, never guessed IDs.
    if (kind === 'like' && available.current === null) {
      nextKind.current = kind
      resource('like_targets', true)
      setNetworkError('Load the feed to choose a like target. Retry its posts if unavailable.')
      return
    }
    const eligible = kind === 'like' ? available.current!.filter(p => p.liked !== 1).map(p => p.id).slice(0, 100) : []
    if (kind === 'like' && !eligible.length) {
      kind = 'post'
      setFallback('No eligible like target remains. Replaced with a new Transmit objective and full budget.')
    } else setFallback(null)
    nextKind.current = null
    const now = performance.now()
    emit({ type: 'tick', atMs: now })
    const latest = current.current
    if (latest.phase === 'ended') return
    const stage = survivalStageAt(latest.activeMs)
    emit({ type: 'objective_issued', atMs: now, objective: {
      runId: latest.run!.runId, objectiveId: crypto.randomUUID(), kind, issuedAtActiveMs: latest.activeMs,
      deadlineActiveMs: latest.activeMs + (kind === 'admission' ? SURVIVAL_TIMING.admissionBudgetMs : stage.objectiveBudgetMs),
      stage: stage.id, eligiblePostIds: eligible,
    } })
  }, [emit, resource])
  const targets = useCallback((posts: Post[] | null) => {
    available.current = posts
    const s = current.current
    if (!s.run || s.phase === 'ended' || s.pendingObjective) return
    if (posts && nextKind.current) {
      resource('like_targets', false); setNetworkError(null); issue(nextKind.current)
    } else if (s.objective?.kind === 'like') {
      if (!posts) { resource('like_targets', true); setNetworkError('Like targets unavailable. Open the feed and retry posts.') }
      else {
        resource('like_targets', false); setNetworkError(null)
        if (!posts.some(p => p.liked !== 1 && s.objective!.eligiblePostIds.includes(p.id))) {
          issue('post'); setFallback('All snapshotted like targets became unavailable. Replaced with a new Transmit objective and full budget.')
        }
      }
    }
  }, [issue, resource])
  const start = useCallback(async (mode: SurvivalInputMode) => {
    if (startLock.current) return
    if (current.current.terminal && !finishReceipt.current) { setNetworkError('Save this result before starting another run.'); return }
    startLock.current = true; setStarting(true); setNetworkError(null)
    if (!startPending.current) {
      generation.current++
      finishPending.current = null; finishReceipt.current = null; setSaveState('idle'); setSaveError(null)
      emit({ type: 'new_run', atMs: performance.now() })
      mutation.current = null; confirmed.current.clear(); resources.current.delete('like_targets'); nextKind.current = null; setFallback(null); setReadings({})
      startPending.current = { request: { requestId: crypto.randomUUID(), rulesVersion: SURVIVAL_RULES_VERSION, inputMode: mode }, bindId: crypto.randomUUID() }
    }
    const pending = startPending.current, token = generation.current
    try {
      pending.receipt ??= await requestJson('/api/runs', jsonPost(pending.request), (v): v is SurvivalStartReceipt => isStartReceipt(v) && v.requestId === pending.request.requestId && v.inputMode === pending.request.inputMode)
      if (pending.verified === undefined) {
        const session = await requestJson('/api/session', {}, (v): v is { user: SessionUser | null } => !!v && typeof v === 'object' && 'user' in v && (v.user === null || !!v.user && typeof v.user === 'object' && 'id' in v.user && typeof v.user.id === 'number' && 'handle' in v.user && typeof v.user.handle === 'string'))
        pending.handle = session.user?.handle; pending.verified = !!session.user
      }
      const bound = pending.verified ? await requestJson(`/api/runs/${pending.receipt.runId}/bind`, jsonPost({ requestId: pending.bindId, handle: pending.handle }), (v): v is SurvivalBindReceipt => isBindReceipt(v) && v.runId === pending.receipt!.runId && v.requestId === pending.bindId && v.user.handle === pending.handle) : null
      if (!mounted.current || token !== generation.current) return
      conditions()
      emit({ type: 'start_acknowledged', atMs: performance.now(), receipt: pending.receipt })
      if (bound) emit({ type: 'identity_bound', atMs: performance.now(), receipt: bound })
      issue(bound ? 'post' : 'admission')
      startPending.current = null; persist()
    } catch (error) {
      if (mounted.current) setNetworkError(error instanceof Error ? error.message : 'Start not confirmed. Retry.')
      if (error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 408 && error.status !== 429) startPending.current = null
    } finally { startLock.current = false; if (mounted.current) setStarting(false) }
  }, [conditions, emit, issue, pause, persist])
  const sendMutation = useCallback(async (m: Mutation) => {
    if (m.result !== undefined) return m.result
    if (m.busy) throw new Error('Recording is already pending.')
    m.busy = true; setNetworkError(null)
    try {
      const data = await requestJson<unknown>(m.url, jsonPost(m.body), (v): v is unknown => {
        if (!m.validate(v) || !v || typeof v !== 'object') return false
        // A confirmed failed CAPTCHA is a verdict, not an objective completion.
        if (m.game.kind === 'admission' && 'passed' in v && v.passed === false) return true
        return 'completion' in v && isCompletion(v.completion, m.game) && v.completion.user.handle === m.body.handle &&
          (!current.current.user || current.current.run?.runId !== m.game.runId || v.completion.user.id === current.current.user.id) &&
          (m.game.kind !== 'post' || v.completion.action.kind === 'post' && 'id' in v && v.id === v.completion.action.postId) &&
          (m.game.kind !== 'admission' || v.completion.action.kind === 'admission' && 'attemptId' in v && v.attemptId === v.completion.action.attemptId) &&
          (m.game.kind !== 'like' || 'already' in v && v.already === false && v.completion.action.kind === 'like' && v.completion.action.postId === Number(m.url.split('/').at(-2)))
      })
      m.result = data
      if (current.current.run?.runId === m.game.runId) confirmed.current.set(m.game.requestId, m)
      if (mounted.current && current.current.run?.runId === m.game.runId && current.current.phase !== 'ended') {
        if (m.game.kind === 'admission' && (data as { passed?: boolean }).passed === false) {
          emit({ type: 'verification_rejected', runId: m.game.runId, attemptId: (data as { attemptId: number }).attemptId, atMs: performance.now() })
        } else {
          const receipt = (data as { completion: SurvivalObjectiveReceipt }).completion
          emit({ type: 'objective_acknowledged', receipt, atMs: performance.now() })
          if (current.current.completedObjectiveIds.includes(m.game.objectiveId) && !current.current.pendingObjective) {
            if (receipt.action.kind === 'like' && available.current) {
              const targetId = receipt.action.postId
              available.current = available.current.map(p => p.id === targetId ? { ...p, liked: 1 } : p)
            }
            issue(m.game.kind === 'post' ? 'like' : 'post')
          }
        }
        persist()
      }
      window.dispatchEvent(new Event('network-updated'))
      return data
    } catch (error) {
      const rejected = error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 408 && error.status !== 429
      if (mounted.current && current.current.run?.runId === m.game.runId) {
        setNetworkError(error instanceof Error ? error.message : 'Recording not confirmed. Retry.')
        emit({ type: rejected ? 'objective_rejected' : 'objective_uncertain', ...m.game, message: error instanceof Error ? error.message : 'Recording not confirmed.', atMs: performance.now() })
      }
      if (rejected && mutation.current === m) mutation.current = null
      throw error
    } finally { m.busy = false }
  }, [emit, issue, persist])
  const mutate = useCallback(async <T,>(url: string, body: Record<string, unknown>, kind: SurvivalObjective['kind'], validate: (v: unknown) => v is T, postId?: number): Promise<T> => {
    const prior = confirmed.current.get(body.requestId as string) ?? (mutation.current?.game.requestId === body.requestId ? mutation.current : null)
    if (prior) {
      const { game: _game, ...original } = prior.body
      void _game
      if (prior.url !== url || JSON.stringify(original) !== JSON.stringify(body)) throw new ApiError('Pending request payload must remain unchanged.', 409)
      return await sendMutation(prior) as T
    }
    const s = current.current
    if (s.phase === 'ended') throw new ApiError('This run has ended. Start again to continue.', 409)
    if (s.pendingObjective) throw new ApiError('Resolve the pending objective with Retry first.', 409)
    if (!s.run || s.objective?.kind !== kind) {
      const data = await requestJson(url, jsonPost(body), validate)
      if (kind === 'admission' && s.run && data && typeof data === 'object' && 'passed' in data && data.passed === false && 'attemptId' in data && typeof data.attemptId === 'number' && mounted.current) {
        emit({ type: 'verification_rejected', runId: s.run.runId, attemptId: data.attemptId, atMs: performance.now() })
      }
      return data
    }
    emit({ type: 'tick', atMs: performance.now() })
    const latest = current.current
    if (latest.phase !== 'running' || !latest.objective) throw new ApiError('Resume the run before submitting this objective.', 409)
    if (kind === 'like' && !latest.objective.eligiblePostIds.includes(postId!)) throw new ApiError('Choose an eligible objective target.', 409)
    const { eligiblePostIds: _targets, ...objective } = latest.objective
    void _targets
    const game = { ...objective, requestId: body.requestId as string, submittedAtActiveMs: latest.activeMs }
    emit({ type: 'objective_submitted', submission: game, atMs: latest.lastEventAtMs! })
    if (!current.current.pendingObjective) throw new ApiError('The run ended before submission.', 409)
    const m: Mutation = { url, body: structuredClone({ ...body, game }), game, validate }
    mutation.current = m
    return await sendMutation(m) as T
  }, [emit, sendMutation])
  const retryMutation = useCallback(() => { if (mutation.current) void sendMutation(mutation.current).catch(() => {}) }, [sendMutation])
  const resume = useCallback(() => { conditions(); emit({ type: 'resume_requested', atMs: performance.now() }) }, [conditions, emit])
  const saveResult = useCallback((): Promise<SurvivalFinishReceipt | null> => {
    if (finishReceipt.current) return Promise.resolve(finishReceipt.current)
    if (finishFlight.current) return finishFlight.current
    const snapshot = current.current.terminal
    if (!snapshot) return Promise.resolve(null)
    finishPending.current ??= { requestId: crypto.randomUUID(), snapshot }
    const pending = finishPending.current
    setSaveState('saving'); setSaveError(null); persist()
    const flight = requestJson(`/api/runs/${snapshot.runId}/finish`, jsonPost(pending), (v): v is SurvivalFinishReceipt => isFinishReceipt(v) && v.requestId === pending.requestId && v.runId === snapshot.runId)
      .then(receipt => { finishReceipt.current = receipt; setSaveState('saved'); persist(); return receipt })
      .catch(error => { setSaveState('error'); setSaveError(error instanceof Error ? error.message : 'Result not saved. Retry.'); throw error })
      .finally(() => { finishFlight.current = null })
    finishFlight.current = flight
    return flight
  }, [persist])
  const end = useCallback(async () => {
    if (current.current.pendingObjective || startLock.current) throw new Error('Confirm the pending action before ending this run.')
    const run = current.current.run
    if (!run) return
    if (current.current.phase !== 'ended') emit({ type: 'interrupted', cause: 'closed', runId: run.runId, atMs: performance.now() })
    persist()
    await saveResult()
  }, [emit, persist, saveResult])
  const restart = useCallback(async () => {
    await end()
    await requestJson('/api/session/end', jsonPost({}), (v): v is { ok: true } => !!v && typeof v === 'object' && 'ok' in v && v.ok === true)
    // A failed clear is visible; never resurrect this run after an explicit restart.
    sessionStorage.removeItem(checkpointKey)
    lastCheckpoint.current = null
    current.current = createSurvivalState()
  }, [end])
  useEffect(() => {
    mounted.current = true
    // Strict Mode replay does not reinterpret an in-memory run as a reload.
    if (current.current.phase === 'ready' && !current.current.run) {
      try {
        // A reload is a fresh start: the old checkpoint is dropped, never replayed as an ended run.
        sessionStorage.removeItem(checkpointKey)
        const raw = null as string | null
        if (raw) {
          const saved: unknown = JSON.parse(raw)
          if (!saved || typeof saved !== 'object' || !('run' in saved) || !('activeMs' in saved)) throw new Error('Invalid checkpoint')
          const { run, activeMs, completedObjectiveIds = [] } = saved as { run: Record<string, unknown>; activeMs: number; completedObjectiveIds?: unknown }
          if (!run || run.rulesVersion !== SURVIVAL_RULES_VERSION || typeof run.runId !== 'string' || (!SURVIVAL_ID_PATTERN.test(run.runId) || run.runId.startsWith('local_')) ||
            !['pointer', 'touch_or_keyboard'].includes(String(run.inputMode)) || !Number.isFinite(activeMs) || activeMs < 0 || activeMs > 86400000) throw new Error('Invalid checkpoint')
          if (!Array.isArray(completedObjectiveIds) || completedObjectiveIds.length > SURVIVAL_LIMITS.objectivesMax || new Set(completedObjectiveIds).size !== completedObjectiveIds.length || !completedObjectiveIds.every(id => typeof id === 'string' && SURVIVAL_ID_PATTERN.test(id))) throw new Error('Invalid checkpoint objectives')
          // Only restore a neutral result; never trust persisted counters/evidence.
          const receipt = { ok: true as const, runId: run.runId, requestId: 'local_reload_checkpoint', rulesVersion: SURVIVAL_RULES_VERSION,
            inputMode: run.inputMode as SurvivalInputMode, startedAt: typeof run.startedAt === 'string' ? run.startedAt : new Date().toISOString() }
          current.current = { ...createSurvivalState(), phase: 'ended', run: receipt, activeMs, completedObjectiveIds,
            terminal: { runId: receipt.runId, rulesVersion: receipt.rulesVersion, inputMode: receipt.inputMode, activeMs,
              stage: survivalStageAt(activeMs).id, completedObjectiveIds, status: 'interrupted', interruption: 'reload', measurements: [] } }
          if ('finish' in saved && isFinishRequest(saved.finish) && saved.finish.snapshot.runId === run.runId) {
            finishPending.current = saved.finish
            current.current = { ...current.current, terminal: saved.finish.snapshot }
          }
          setState(current.current)
        }
      } catch { setStorageError('Previous session checkpoint could not be read. Start a new run.') }
    }
    sensors.current = installSurvivalSensors(() => current.current, emit, result => setReadings(old => ({ ...old, [result.detector]: result })))
    const sync = () => { conditions(); persist() }
    const resize = () => emit({ type: 'sensor_reset', cause: 'resize', atMs: performance.now() })
    const leave = () => {
      const s = current.current
      if (s.run && s.phase !== 'ended') emit({ type: 'interrupted', cause: 'closed', runId: s.run.runId, atMs: performance.now() })
      persist()
    }
    document.addEventListener('visibilitychange', sync)
    window.addEventListener('blur', sync)
    window.addEventListener('focus', sync)
    window.addEventListener('resize', resize)
    window.addEventListener('pagehide', leave)
    const timer = window.setInterval(() => {
      const now = performance.now()
      if (current.current.phase === 'countdown' && now >= current.current.countdownEndsAtMs!) emit({ type: 'countdown_finished', atMs: now })
      sensors.current?.pulse(now)
      emit({ type: 'tick', atMs: now })
      persist()
    }, 1000 / SURVIVAL_TIMING.hudHz)
    return () => {
      mounted.current = false
      clearInterval(timer); sensors.current?.dispose(); sensors.current = null
      document.removeEventListener('visibilitychange', sync)
      window.removeEventListener('blur', sync); window.removeEventListener('focus', sync)
      window.removeEventListener('resize', resize); window.removeEventListener('pagehide', leave)
    }
  }, [conditions, emit, persist])
  useEffect(() => {
    emit({ type: 'sensor_reset', cause: 'route', atMs: performance.now() })
    pause('leaderboard', false)
  }, [pathname, emit, pause])
  useEffect(() => { if (state.terminal) void saveResult().catch(() => {}) }, [state.terminal, saveResult])
  return <GameContext.Provider value={{ state, saveState, saveError, saveResult, end, restart, readings, storageError, networkError, starting, fallback, retryMutation, resource, targets, mutate, start, resume, pause }}>
    {state.phase === 'ended' && pathname !== '/leaderboard' ? <GameOver /> : <><GameHud />{children}</>}
  </GameContext.Provider>
}
