'use client'
import { createContext, useContext, type CSSProperties, type ReactNode } from 'react'
import { usePollingResource } from '@/hooks/usePollingResource'
import { isNetwork } from '@/lib/validators'
import type { NetworkState } from '@/lib/types'

const NetworkContext = createContext<{ data?: NetworkState; error?: string; refresh: () => void }>({ refresh: () => {} })
export function useNetwork() { return useContext(NetworkContext) }
export default function NetworkAtmosphere({ children }: { children: ReactNode }) {
  const network = usePollingResource('/api/network', isNetwork, 3000)
  const level = network.data?.level ?? 0
  return <NetworkContext value={network}>
    <div className="network-shell" style={{ '--threat': level, '--ticker-duration': `${48 - level * 24}s` } as CSSProperties}>
      <div className="network-sky" aria-hidden="true" />
      {children}
    </div>
  </NetworkContext>
}
export function NetworkStatus() {
  const { data, error, refresh } = useNetwork()
  return <div className="network-status">
    <span className={data?.rejections ? 'signal-dot danger' : 'signal-dot'} aria-hidden="true" />
    <span>{data ? `${data.rejections} rejected in the last 5 min` : error ? 'Activity unavailable' : 'Loading activity…'}</span>
    {error && <button className="text-button" onClick={refresh}>Retry</button>}
    {error && data && <span className="muted">Last known count</span>}
  </div>
}
