'use client'
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import type { SurvivalDetectorResult, SurvivalEvent, SurvivalInputMode, SurvivalPauseReason, SurvivalRunState } from '@/lib/types'
import { createSurvivalState, transitionSurvival } from '@/lib/survival/engine'
import { SURVIVAL_RULES_VERSION, SURVIVAL_TIMING, survivalStageAt } from '@/lib/survival/config'
import { installSurvivalSensors } from '@/lib/survival/browser'
import GameHud from './GameHud'
import GameOver from './GameOver'

const checkpointKey = 'bot-only-survival-diagnostic-v1'
type GameContextValue = {
  state: SurvivalRunState; readings: Partial<Record<SurvivalDetectorResult['detector'], SurvivalDetectorResult>>
  storageError: string | null; start: (mode: SurvivalInputMode) => void; resume: () => void
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
  const pathname = usePathname()
  const persist = useCallback(() => {
    try {
      const s = current.current
      // A checkpoint is only a neutral reload result, never a resumable engine state.
      if (s.run) {
        const payload = JSON.stringify({ run: s.run, activeMs: s.activeMs })
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
  const conditions = useCallback(() => {
    pause('hidden', document.hidden)
    pause('blurred', !document.hasFocus())
  }, [pause])
  const start = useCallback((mode: SurvivalInputMode) => {
    emit({ type: 'new_run', atMs: performance.now() })
    setReadings({})
    conditions()
    emit({ type: 'start_acknowledged', atMs: performance.now(), receipt: {
      ok: true, runId: `local_${crypto.randomUUID()}`, requestId: crypto.randomUUID(),
      rulesVersion: SURVIVAL_RULES_VERSION, inputMode: mode, startedAt: new Date().toISOString(),
    } })
    persist()
  }, [conditions, emit, persist])
  const resume = useCallback(() => { conditions(); emit({ type: 'resume_requested', atMs: performance.now() }) }, [conditions, emit])
  useEffect(() => {
    // Strict Mode replay does not reinterpret an in-memory run as a reload.
    if (current.current.phase === 'ready' && !current.current.run) {
      try {
        const raw = sessionStorage.getItem(checkpointKey)
        if (raw) {
          const saved: unknown = JSON.parse(raw)
          if (!saved || typeof saved !== 'object' || !('run' in saved) || !('activeMs' in saved)) throw new Error('Invalid checkpoint')
          const { run, activeMs } = saved as { run: Record<string, unknown>; activeMs: number }
          if (!run || run.rulesVersion !== SURVIVAL_RULES_VERSION || typeof run.runId !== 'string' || !run.runId.startsWith('local_') ||
            !['pointer', 'touch_or_keyboard'].includes(String(run.inputMode)) || !Number.isFinite(activeMs) || activeMs < 0 || activeMs > 86400000) throw new Error('Invalid checkpoint')
          // Only restore a neutral result; never trust persisted counters/evidence.
          const receipt = { ok: true as const, runId: run.runId, requestId: 'local_reload_checkpoint', rulesVersion: SURVIVAL_RULES_VERSION,
            inputMode: run.inputMode as SurvivalInputMode, startedAt: typeof run.startedAt === 'string' ? run.startedAt : new Date().toISOString() }
          current.current = { ...createSurvivalState(), phase: 'ended', run: receipt, activeMs,
            terminal: { runId: receipt.runId, rulesVersion: receipt.rulesVersion, inputMode: receipt.inputMode, activeMs,
              stage: survivalStageAt(activeMs).id, completedObjectiveIds: [], status: 'interrupted', interruption: 'reload', measurements: [] } }
          setState(current.current)
        }
      } catch { setStorageError('Previous session checkpoint could not be read. Start a new local run.') }
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
      clearInterval(timer); sensors.current?.dispose(); sensors.current = null
      document.removeEventListener('visibilitychange', sync)
      window.removeEventListener('blur', sync); window.removeEventListener('focus', sync)
      window.removeEventListener('resize', resize); window.removeEventListener('pagehide', leave)
    }
  }, [conditions, emit, persist])
  useEffect(() => { emit({ type: 'sensor_reset', cause: 'route', atMs: performance.now() }) }, [pathname, emit])
  return <GameContext.Provider value={{ state, readings, storageError, start, resume, pause }}>
    <GameHud /><GameOver />{children}
  </GameContext.Provider>
}
