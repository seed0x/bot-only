import { randomBytes, randomInt, randomUUID } from 'node:crypto'
import { getDb, logActivity } from './db'
import { operation } from './operations'
import { handleInput, InputError, object, requestId } from './server-input'
import { MAX_SAMPLES, scoreHash, scoreMotion } from './motion'
import { createImageRound, scoreImageRound, type ImageRound } from './image-captcha'
import type { AttemptReceipt, CaptchaResult, ChallengeKind, IssuedChallenge, MotionSample, Solution } from './types'

const KINDS: ChallengeKind[] = ['straight-line', 'hash-recall', 'image-confusion']
const WINDOW_MS: Record<ChallengeKind, number> = { 'straight-line': 60_000, 'hash-recall': 4000, 'image-confusion': 120_000 }
const secureRandom = () => randomInt(0, 2 ** 32) / 2 ** 32

// Stored server-side only. The public challenge never includes the answer.
type StoredChallenge = IssuedChallenge & { round?: ImageRound }

export function registerUnit(body: Record<string, unknown>) {
  const handle = handleInput(body.handle), id = requestId(body.requestId)
  return operation(id, 'register-unit', { handle }, () => {
    const db = getDb()
    db.prepare('insert into users (handle, humanity_score, verified_bot) values (?, 1, 0) on conflict(handle) do nothing').run(handle)
    const user = db.prepare('select id, handle from users where handle = ?').get(handle)
    return { ok: true, user }
  })
}

export function issueChallenge(body: Record<string, unknown>): IssuedChallenge {
  const handle = handleInput(body.handle), id = requestId(body.requestId)
  if (!KINDS.includes(body.kind as ChallengeKind)) throw new InputError('Unknown or inactive test.')
  const kind = body.kind as ChallengeKind
  return operation(id, 'issue', { handle, kind }, () => {
    const startedAt = Date.now(), expiresAt = startedAt + WINDOW_MS[kind]
    const base = { id: randomUUID(), kind, startedAt, expiresAt }
    let stored: StoredChallenge = base, issued: IssuedChallenge = base
    if (kind === 'hash-recall') { stored = issued = { ...base, hash: randomBytes(20).toString('hex') } }
    if (kind === 'image-confusion') {
      const round = createImageRound(secureRandom)
      issued = { ...base, prompt: round.prompt, tiles: round.tiles.map(({ id, src }) => ({ id, src })) }
      stored = { ...issued, round }
    }
    getDb().prepare('insert into challenge_instances (id, handle, kind, payload, started_at, expires_at) values (?, ?, ?, ?, ?, ?)').run(base.id, handle, kind, JSON.stringify(stored), startedAt, expiresAt)
    return issued
  })
}
function parseSolution(value: unknown): Solution {
  const s = object(value)
  if ('samples' in s) {
    if (!Array.isArray(s.samples) || s.samples.length < 1 || s.samples.length > MAX_SAMPLES) throw new InputError('Invalid motion evidence.')
    let last = -1
    const samples = s.samples.map((v): MotionSample => {
      const p = object(v)
      if (typeof p.x !== 'number' || typeof p.y !== 'number' || typeof p.t !== 'number' ||
          ![p.x, p.y, p.t].every(Number.isFinite) || Math.abs(p.x) > 4096 || Math.abs(p.y) > 4096 || p.t < last || p.t < 0 || p.t > 60_000) throw new InputError('Invalid motion samples.')
      last = p.t
      return { x: p.x, y: p.y, t: p.t }
    })
    return { samples }
  }
  if ('selected' in s) {
    if (!Array.isArray(s.selected) || s.selected.length > 9 || !s.selected.every((v) => typeof v === 'string' && v.length <= 40)) throw new InputError('Invalid image selection.')
    return { selected: [...new Set(s.selected as string[])] }
  }
  if (typeof s.value !== 'string' || s.value.length > 100) throw new InputError('Invalid hash response.')
  return { value: s.value }
}
export function submitAttempt(body: Record<string, unknown>): AttemptReceipt {
  const handle = handleInput(body.handle), id = requestId(body.requestId)
  if (typeof body.challengeId !== 'string') throw new InputError('Issued challenge required.')
  const challengeId = body.challengeId, solution = parseSolution(body.solution)
  return operation(id, 'attempt', { handle, challengeId, solution }, () => {
    const db = getDb()
    const row = db.prepare('select payload, handle, used from challenge_instances where id = ?').get(challengeId) as { payload: string; handle: string; used: number } | undefined
    if (!row || row.handle !== handle) throw new InputError('Challenge not found for this unit.', 404)
    if (row.used) throw new InputError('Challenge already recorded. Start a new attempt.', 409)
    const challenge = JSON.parse(row.payload) as StoredChallenge
    const elapsed = Math.max(0, Date.now() - challenge.startedAt)
    const expected = challenge.kind === 'straight-line' ? 'samples' : challenge.kind === 'image-confusion' ? 'selected' : 'value'
    if (!(expected in solution)) throw new InputError('Wrong solution for this challenge.')
    if ('samples' in solution && solution.samples.at(-1)!.t - solution.samples[0].t > elapsed + 100) throw new InputError('Motion duration exceeds the trial window.')
    const result = 'samples' in solution ? scoreMotion(solution.samples, Date.now() > challenge.expiresAt)
      : 'selected' in solution ? scoreImage(challenge, solution.selected, elapsed)
      : scoreHash(challenge.hash!, solution.value, elapsed)
    let user = db.prepare('select id from users where handle = ?').get(handle) as { id: number } | undefined
    if (result.passed) {
      if (!user) {
        user = { id: Number(db.prepare('insert into users (handle, humanity_score, verified_bot) values (?, ?, 1)').run(handle, result.score).lastInsertRowid) }
        logActivity('join', handle, 'verified non-human. joined the network.')
      } else {
        db.prepare('update users set humanity_score = min(humanity_score, ?), verified_bot = 1 where id = ?').run(result.score, user.id)
        logActivity('pass', handle, `passed ${result.challenge} (humanity ${result.score.toFixed(2)})`)
      }
    } else logActivity('fail', handle, `rejected on ${result.challenge}. ${result.meta.reason}`)
    const attemptId = Number(db.prepare('insert into captcha_attempts (user_id, handle, challenge, passed, score, duration_ms, meta) values (?, ?, ?, ?, ?, ?, ?)').run(user?.id ?? null, handle, result.challenge, Number(result.passed), result.score, result.duration_ms, JSON.stringify(result.meta)).lastInsertRowid)
    db.prepare('update challenge_instances set used = 1 where id = ?').run(challengeId)
    return { ok: true, attemptId, requestId: id, handle, passed: result.passed, result, user: user ? { id: user.id, handle } : null, recordedAt: new Date().toISOString() }
  })
}

function scoreImage(challenge: StoredChallenge, selected: string[], elapsed: number): CaptchaResult {
  const expired = Date.now() > challenge.expiresAt
  const v = scoreImageRound(challenge.round!, selected)
  const passed = v.passed && !expired
  // humanity: 0 for a clean machine pick; taking the bait is maximally human
  const score = passed ? Math.min(0.2, elapsed / 60_000) : v.tookTheBait ? 1 : Math.min(1, 0.4 + (v.wrong + v.missed) * 0.1)
  return {
    challenge: 'image-confusion', passed, score, duration_ms: elapsed,
    meta: { reason: expired ? 'Time’s up.' : v.reason, prompt: challenge.round!.prompt, selected, tookTheBait: v.tookTheBait },
  }
}
