'use client'

import type { SessionUser } from './types'

const KEY = 'bot-only:user'

export function getSessionUser(): SessionUser | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as SessionUser) : null
  } catch {
    return null
  }
}

export function setSessionUser(u: SessionUser) {
  try { localStorage.setItem(KEY, JSON.stringify(u)) } catch {}
}
