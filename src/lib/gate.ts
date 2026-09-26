import { createHash, randomBytes } from 'node:crypto'
import { getDb } from './db'
import type { AttemptReceipt, SessionUser } from './types'

export const GATE_COOKIE = 'bot-only-admission'
export const GATE_TTL_SECONDS = 12 * 60 * 60
const hash = (token: string) => createHash('sha256').update(token).digest('hex')

export function issueAdmission(receipt: AttemptReceipt): string | null {
  if (!receipt.passed || !receipt.user || receipt.result.challenge !== 'image-confusion') return null
  const token = randomBytes(32).toString('hex')
  const db = getDb()
  db.prepare('delete from gate_sessions where expires_at <= ?').run(Date.now())
  db.prepare('insert into gate_sessions (token_hash, user_id, attempt_id, expires_at) values (?, ?, ?, ?)')
    .run(hash(token), receipt.user.id, receipt.attemptId, Date.now() + GATE_TTL_SECONDS * 1000)
  return token
}

export function admittedUser(token: string | undefined): (SessionUser & { humanity: number }) | null {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null
  const user = getDb().prepare(`
    select u.id, u.handle, u.humanity_score as humanity from gate_sessions s
    join users u on u.id = s.user_id
    join captcha_attempts a on a.id = s.attempt_id and a.user_id = u.id
    where s.token_hash = ? and s.expires_at > ? and u.verified_bot = 1
      and a.challenge = 'image-confusion' and a.passed = 1
  `).get(hash(token), Date.now()) as (SessionUser & { humanity: number }) | undefined
  return user ? { id: user.id, handle: user.handle, humanity: user.humanity } : null
}

export function requestAdmission(req: Request): SessionUser | null {
  const token = req.headers.get('cookie')?.split(';').map(part => part.trim()).find(part => part.startsWith(GATE_COOKIE + '='))?.slice(GATE_COOKIE.length + 1)
  return admittedUser(token)
}
