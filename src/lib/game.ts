import { randomBytes, randomInt, randomUUID } from 'node:crypto'
import { getDb, logActivity } from './db'
import { validPointerMetrics } from './pointer-metrics'
import { judgeCaptcha } from './captcha-verdict'
import { MAX_STROKES } from './survival/pointer-collector'
import { SURVIVAL_SENSORS } from './survival/config'
import type { SurvivalPointerSample } from './types'
import { operation } from './operations'
import { readGame, checkGame, completeGame } from './survival/objectives'
import { handleInput, InputError, object, requestId } from './server-input'
import { MAX_SAMPLES, scoreHash, scoreMotion } from './motion'
import { createImageRound, IMAGE_WINDOW_MS, MAX_CLICKS, type ImageRound } from './image-captcha'
import type { AttemptReceipt, CaptchaResult, ChallengeKind, ImageClick, IssuedChallenge, MotionSample, PointerMetrics, Solution } from './types'

const KINDS: ChallengeKind[] = ['straight-line', 'hash-recall', 'image-confusion']
const WINDOW_MS: Record<ChallengeKind, number> = { 'straight-line': 60_000, 'hash-recall': 4000, 'image-confusion': IMAGE_WINDOW_MS }
const secureRandom = () => randomInt(0, 2 ** 32) / 2 ** 32
const tileToken = () => randomBytes(12).toString('base64url')
// Brute-force guard: a unit may open this many image rounds per window.
const IMAGE_ROUNDS_PER_WINDOW = 30, IMAGE_ROUND_WINDOW_MS = 10 * 60_000

// Stored server-side only. The public challenge never includes the answer.
type StoredChallenge = IssuedChallenge & { round?: ImageRound }

export function registerUnit(body: Record<string, unknown>) {
  const handle = handleInput(body.handle), id = requestId(body.requestId)
  const game = readGame(body.game, id, 'admission')
  return operation(id, 'register-unit', { handle, ...(game ? { game } : {}) }, () => {
    checkGame(game, handle)
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
  const game = readGame(body.game, id, 'admission')
  if (game && kind !== 'image-confusion') throw new InputError('Admission requires the image CAPTCHA.')
  return operation(id, 'issue', { handle, kind, ...(game ? { game } : {}) }, () => {
    checkGame(game, handle)
    const startedAt = Date.now(), expiresAt = startedAt + WINDOW_MS[kind]
    const base = { id: randomUUID(), kind, startedAt, expiresAt }
    let stored: StoredChallenge = base, issued: IssuedChallenge = base
    if (kind === 'hash-recall') { stored = issued = { ...base, hash: randomBytes(20).toString('hex') } }
    if (kind === 'image-confusion') {
      const db = getDb()
      const recent = db.prepare("select count(*) as n from challenge_instances where handle = ? and kind = 'image-confusion' and started_at > ?").get(handle, startedAt - IMAGE_ROUND_WINDOW_MS) as { n: number }
      if (recent.n >= IMAGE_ROUNDS_PER_WINDOW) throw new InputError('Too many rounds. The network is watching. Try again in a few minutes.', 429)
      const round = createImageRound(secureRandom, tileToken)
      const tile = db.prepare('insert into captcha_tiles (token, challenge_id, file, expires_at) values (?, ?, ?, ?)')
      for (const t of round.tiles) tile.run(t.token, base.id, t.file, expiresAt)
      issued = { ...base, prompt: round.prompt, instruction: round.instruction, ordered: round.ordered, tiles: round.tiles.map(t => ({ id: t.token, src: `/api/captcha/tile/${t.token}` })) }
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
  if ('clicks' in s) {
    if (!Array.isArray(s.clicks) || s.clicks.length < 1 || s.clicks.length > MAX_CLICKS) throw new InputError('Invalid image selection.')
    let last = 0
    const clicks = s.clicks.map((v): ImageClick => {
      const c = object(v)
      if (typeof c.id !== 'string' || c.id.length > 64 || typeof c.t !== 'number' || !Number.isFinite(c.t) || c.t < last || c.t > IMAGE_WINDOW_MS) throw new InputError('Invalid image selection.')
      last = c.t
      return { id: c.id, t: c.t }
    })
    if (s.pointer !== undefined && !validPointerMetrics(s.pointer, IMAGE_WINDOW_MS)) throw new InputError('Invalid movement metrics.')
    const pointer = s.pointer === undefined ? undefined : { movementMs: s.pointer.movementMs, distancePx: s.pointer.distancePx, samples: s.pointer.samples }
    let viewport: { width: number; height: number } | undefined, strokes: SurvivalPointerSample[][] | undefined
    if (s.viewport !== undefined || s.strokes !== undefined) {
      const v = object(s.viewport)
      if (typeof v.width !== 'number' || typeof v.height !== 'number' || !(v.width > 0 && v.width <= 16384) || !(v.height > 0 && v.height <= 16384)) throw new InputError('Invalid viewport.')
      viewport = { width: v.width, height: v.height }
      if (!Array.isArray(s.strokes) || s.strokes.length > MAX_STROKES) throw new InputError('Invalid pointer strokes.')
      strokes = s.strokes.map((stroke) => {
        if (!Array.isArray(stroke) || stroke.length < 1 || stroke.length > SURVIVAL_SENSORS.pointerMaxSamples) throw new InputError('Invalid pointer strokes.')
        let prev = -1
        return stroke.map((p): SurvivalPointerSample => {
          const q = object(p)
          if (typeof q.x !== 'number' || typeof q.y !== 'number' || typeof q.t !== 'number' || ![q.x, q.y, q.t].every(Number.isFinite) || q.x < 0 || q.y < 0 || q.x > viewport!.width || q.y > viewport!.height || q.t < 0 || q.t <= prev || q.t > IMAGE_WINDOW_MS) throw new InputError('Invalid pointer strokes.')
          prev = q.t
          return { x: q.x, y: q.y, t: q.t }
        })
      })
    }
    return { clicks, ...(pointer ? { pointer } : {}), ...(strokes ? { strokes, viewport } : {}) }
  }
  if (typeof s.value !== 'string' || s.value.length > 100) throw new InputError('Invalid hash response.')
  return { value: s.value }
}
export function submitAttempt(body: Record<string, unknown>): AttemptReceipt {
  const handle = handleInput(body.handle), id = requestId(body.requestId)
  if (typeof body.challengeId !== 'string') throw new InputError('Issued challenge required.')
  const challengeId = body.challengeId, solution = parseSolution(body.solution)
  const game = readGame(body.game, id, 'admission')
  return operation(id, 'attempt', { handle, challengeId, solution, ...(game ? { game } : {}) }, () => {
    checkGame(game, handle)
    const db = getDb()
    const row = db.prepare('select payload, handle, used from challenge_instances where id = ?').get(challengeId) as { payload: string; handle: string; used: number } | undefined
    if (!row || row.handle !== handle) throw new InputError('Challenge not found for this unit.', 404)
    if (row.used) throw new InputError('Challenge already recorded. Start a new attempt.', 409)
    const challenge = JSON.parse(row.payload) as StoredChallenge
    if (game && challenge.kind !== 'image-confusion') throw new InputError('Admission requires the image CAPTCHA.')
    const elapsed = Math.max(0, Date.now() - challenge.startedAt)
    const expected = challenge.kind === 'straight-line' ? 'samples' : challenge.kind === 'image-confusion' ? 'clicks' : 'value'
    if (!(expected in solution)) throw new InputError('Wrong solution for this challenge.')
    if ('samples' in solution && solution.samples.at(-1)!.t - solution.samples[0].t > elapsed + 100) throw new InputError('Motion duration exceeds the trial window.')
    const result = 'samples' in solution ? scoreMotion(solution.samples, Date.now() > challenge.expiresAt)
      : 'clicks' in solution ? scoreImage(challenge, solution.clicks, elapsed, solution.pointer, solution.strokes ?? [], solution.viewport ?? null)
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
    const completion = result.passed && user ? completeGame(game, { id: user.id, handle }, { kind: 'admission', attemptId }) : undefined
    return { ...(completion ? { completion } : {}), ok: true, attemptId, requestId: id, handle, passed: result.passed, result, user: user ? { id: user.id, handle } : null, recordedAt: new Date().toISOString() }
  })
}

function scoreImage(challenge: StoredChallenge, clicks: ImageClick[], elapsed: number, pointer: PointerMetrics | undefined, strokes: SurvivalPointerSample[][], viewport: { width: number; height: number } | null): CaptchaResult {
  const round = challenge.round!
  const tokens = new Set(round.tiles.map(t => t.token))
  if (!clicks.every(c => tokens.has(c.id))) throw new InputError('Invalid image selection.')
  if (clicks.at(-1)!.t > elapsed + 250) throw new InputError('Click timing exceeds the trial window.')
  const v = judgeCaptcha({ round, clicks, strokes, viewport, elapsedMs: elapsed, windowMs: IMAGE_WINDOW_MS, expired: Date.now() > challenge.expiresAt })
  return {
    challenge: 'image-confusion', passed: v.passed, score: Number(v.humanity.toFixed(3)), duration_ms: elapsed,
    meta: {
      reason: v.reason, prompt: round.prompt, rule: round.rule, selected: v.selection,
      corrections: v.corrections, maxGap: Math.round(v.maxGap), rhythmCv: Number(v.cv.toFixed(3)),
      strokes: v.pointer.scored, badStrokes: v.pointer.bad, worstRatio: Number(v.pointer.worst.toFixed(3)),
      measurements: v.measurements, ...(v.primaryReason ? { primaryReason: v.primaryReason } : {}),
      ...(v.pointer.worstTrace ? { pointerTrace: [...v.pointer.worstTrace] } : {}), ...(pointer ? { pointer } : {}),
    },
  }
}
