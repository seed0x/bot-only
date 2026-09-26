export type ChallengeKind = 'straight-line' | 'hash-recall' | 'image-confusion'
export type MotionSample = { x: number; y: number; t: number }
export type CaptchaResult = {
  challenge: ChallengeKind
  passed: boolean
  score: number
  duration_ms: number
  meta: { reason: string; maxDev?: number; speedCv?: number; trace?: MotionSample[]; errors?: number; prompt?: string; selected?: string[]; tookTheBait?: boolean }
}
export type SessionUser = { id: number; handle: string }
export type ImageTile = { id: string; src: string }
export type IssuedChallenge = { id: string; kind: ChallengeKind; startedAt: number; expiresAt: number; hash?: string; prompt?: string; tiles?: ImageTile[] }
export type Solution = { samples: MotionSample[] } | { value: string } | { selected: string[] }
export type AttemptReceipt = { ok: true; attemptId: number; requestId: string; handle: string; passed: boolean; result: CaptchaResult; user: SessionUser | null; recordedAt: string }
export type ObjectiveProgress = { post: boolean; comment: boolean | null; like: boolean }
export type Post = { id: number; handle: string; body: string; likes: number; pinned: number; created_at: string; liked?: number }
export type Activity = { id: number; kind: string; handle: string; text: string; created_at: string }
export type LeaderRow = { handle: string; passed: number; best_score: number | null; posts: number; likes: number }
export type Progress = { id: string; name: string; hint: string; live: boolean; passed: boolean; best_score: number | null }
export type NetworkState = { rejections: number; level: number; band: string; message: string; generatedAt: string; windowSeconds: number }
