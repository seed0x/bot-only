'use client'
import { useSyncExternalStore } from 'react'
import type { SessionUser } from './types'
const KEY = 'bot-only:user'
function raw() { try { return localStorage.getItem(KEY) } catch { return null } }
function decode(value: string | null): SessionUser | null {
  try {
    const u = value ? JSON.parse(value) : null
    return u && Number.isSafeInteger(u.id) && u.id > 0 && typeof u.handle === 'string' && /^[a-z0-9_.-]{1,40}$/.test(u.handle) && u.handle !== 'system' ? u : null
  } catch { return null }
}
function subscribe(callback: () => void) {
  window.addEventListener('storage', callback); window.addEventListener('unit-session', callback)
  return () => { window.removeEventListener('storage', callback); window.removeEventListener('unit-session', callback) }
}
export function getSessionUser() { return decode(raw()) }
export function useSessionUser() { return decode(useSyncExternalStore(subscribe, raw, () => null)) }
export function setSessionUser(user: SessionUser) {
  localStorage.setItem(KEY, JSON.stringify(user))
  window.dispatchEvent(new Event('unit-session'))
}
