'use client'
import { useEffect, useReducer, useState } from 'react'
import { ApiError, requestJson } from '@/lib/api'

export function usePollingResource<T>(url: string | null, validate: (v: unknown) => v is T, interval = 4000) {
  const [version, refresh] = useReducer((n: number) => n + 1, 0)
  const [state, setState] = useState<{ key: string | null; data?: T; error?: string; errorStatus?: number }>({ key: url })
  useEffect(() => {
    if (!url) return
    let active = true, running = false, failures = 0
    let timer: ReturnType<typeof setTimeout>
    const controller = new AbortController()
    async function load() {
      if (!active || running) return
      clearTimeout(timer)
      if (document.hidden || !navigator.onLine) { timer = setTimeout(load, interval); return }
      running = true
      try {
        const data = await requestJson(url!, { signal: controller.signal }, validate)
        if (active) { failures = 0; setState({ key: url, data }); timer = setTimeout(load, interval) }
      } catch (e) {
        if (active) {
          const status = e instanceof ApiError ? e.status : undefined
          setState(old => ({ key: url, data: old.key === url ? old.data : undefined, error: e instanceof Error ? e.message : 'Network unavailable.', errorStatus: status }))
          // Keep stale data and its visible error while retrying transient failures.
          if (!status || status === 408 || status === 429 || status >= 500) {
            failures = Math.min(failures + 1, 4)
            timer = setTimeout(load, Math.min(30_000, interval * 2 ** failures))
          }
        }
      } finally { running = false }
    }
    void load()
    const resume = () => { if (!document.hidden) void load() }
    window.addEventListener('online', resume)
    window.addEventListener('network-updated', resume)
    document.addEventListener('visibilitychange', resume)
    return () => {
      active = false; controller.abort(); clearTimeout(timer)
      window.removeEventListener('online', resume); window.removeEventListener('network-updated', resume); document.removeEventListener('visibilitychange', resume)
    }
  }, [url, version, interval, validate])
  const current: { data?: T; error?: string; errorStatus?: number } = state.key === url ? state : {}
  return { data: current.data, error: current.error, errorStatus: current.errorStatus, loading: current.data === undefined && !current.error, refresh }
}
