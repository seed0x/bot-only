export type ChallengeKind = 'straight-line' | 'hash-recall' | 'image-confusion'
export type MotionSample = { x: number; y: number; t: number }
export type CaptchaResult = {
  challenge: ChallengeKind
  passed: boolean
  score: number
  duration_ms: number
  meta: { reason: string; maxDev?: number; speedCv?: number; trace?: MotionSample[]; errors?: number; prompt?: string; selected?: string[] }
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

// Survival v1 contracts. Independent of the CAPTCHA registry and lifetime progress.
export type SurvivalInputMode = 'pointer' | 'touch_or_keyboard'
export type SurvivalStageId = 'boot' | 'observe' | 'inspect' | 'audit' | 'purge'
export type SurvivalPhase = 'ready' | 'countdown' | 'running' | 'paused' | 'ended'
export type SurvivalPauseReason = 'leaderboard' | 'hidden' | 'blurred' | 'objective_request' | 'required_resource'
export type SurvivalDetector = 'pointer' | 'typing' | 'scroll'
export type SurvivalFailureReason = 'verification_failed' | 'objective_deadline' | 'idle' | SurvivalDetector
export type SurvivalStage = Readonly<{
  id: SurvivalStageId; startsAtMs: number; idleLimitMs: number
  pointerRatio: number; typingCv: number; scrollCv: number
  objectiveBudgetMs: number; badWindowsToFail: number
}>
export type SurvivalPointerSample = Readonly<{ x: number; y: number; t: number }>
export type SurvivalMeasurement = Readonly<{
  reason: SurvivalFailureReason; activeMs: number; stage: SurvivalStageId
  value: number; threshold: number; unit: 'ms' | 'ratio' | 'cv' | 'boolean'
  explanation: string
}>
export type SurvivalDetectorResult = Readonly<{
  detector: SurvivalDetector; outcome: 'insufficient_data' | 'good' | 'bad'
  stage: SurvivalStageId; value: number | null; threshold: number
  explanation: string; pointerTrace?: readonly SurvivalPointerSample[]
}>
export type SurvivalObjectiveAssociation = Readonly<{ runId: string; objectiveId: string }>
export type SurvivalObjective = SurvivalObjectiveAssociation & Readonly<{
  kind: 'admission' | 'post' | 'like'; issuedAtActiveMs: number; deadlineActiveMs: number
  stage: SurvivalStageId; eligiblePostIds: readonly number[]
}>
export type SurvivalActionReference =
  | Readonly<{ kind: 'admission'; attemptId: number }>
  | Readonly<{ kind: 'post'; postId: number }>
  | Readonly<{ kind: 'like'; likeId: number; postId: number }>
export type SurvivalObjectiveReceipt = SurvivalObjectiveAssociation & Readonly<{
  completionId: string; requestId: string; user: SessionUser
  action: SurvivalActionReference; recordedAt: string
}>
export type SurvivalObjectiveSubmission = SurvivalObjectiveAssociation & Readonly<{
  requestId: string; kind: SurvivalObjective['kind']; submittedAtActiveMs: number
  issuedAtActiveMs: number; deadlineActiveMs: number; stage: SurvivalStageId
}>
export type SurvivalTerminalBase = Readonly<{
  runId: string; rulesVersion: string; inputMode: SurvivalInputMode
  activeMs: number; stage: SurvivalStageId; completedObjectiveIds: readonly string[]
}>
export type SurvivalTerminalSnapshot = SurvivalTerminalBase & (
  | Readonly<{ status: 'failed'; primaryReason: SurvivalFailureReason
      measurements: readonly SurvivalMeasurement[]; pointerTrace?: readonly SurvivalPointerSample[] }>
  | Readonly<{ status: 'interrupted'; interruption: 'reload' | 'closed'; measurements: readonly [] }>
)
export type SurvivalStartRequest = Readonly<{ requestId: string; rulesVersion: string; inputMode: SurvivalInputMode }>
export type SurvivalStartReceipt = SurvivalStartRequest & Readonly<{ ok: true; runId: string; startedAt: string }>
export type SurvivalBindRequest = Readonly<{ requestId: string; handle: string }>
export type SurvivalBindReceipt = Readonly<{ ok: true; requestId: string; runId: string; user: SessionUser }>
export type SurvivalFinishRequest = Readonly<{ requestId: string; snapshot: SurvivalTerminalSnapshot }>
export type SurvivalFinishReceipt = Readonly<{ ok: true; requestId: string; runId: string; resultId: string; ranked: boolean; recordedAt: string }>
export type SurvivalSaveState =
  | Readonly<{ status: 'not_sent' }>
  | Readonly<{ status: 'saving'; request: SurvivalFinishRequest }>
  | Readonly<{ status: 'saved'; receipt: SurvivalFinishReceipt }>
  | Readonly<{ status: 'save_error'; request: SurvivalFinishRequest; message: string; retryable: boolean }>
export type SurvivalScoreRow = Readonly<{
  runId: string; handle: string; activeMs: number; completedObjectives: number
  roundsSurvived: number; stage: SurvivalStageId
}>
export type SurvivalScoresResponse = Readonly<{ rulesVersion: string; inputMode: SurvivalInputMode; scores: readonly SurvivalScoreRow[] }>
// Existing endpoints retain their string error envelope; new run endpoints use it too.
export type SurvivalApiError = Readonly<{ error: string }>
// Events carry monotonic browser time. Async replies also carry runId to reject stale runs.
export type SurvivalEvent = Readonly<{ atMs: number }> & (
  | { type: 'start_acknowledged'; receipt: SurvivalStartReceipt }
  | { type: 'tick' }
  | { type: 'countdown_finished' }
  | { type: 'pause_acquired'; reason: SurvivalPauseReason }
  | { type: 'pause_released'; reason: SurvivalPauseReason }
  | { type: 'resume_requested' }
  | { type: 'activity'; source: 'pointer' | 'scroll' | 'keydown' | 'input' | 'composition' | 'pointerdown' }
  | { type: 'sensor_reset'; cause: 'route' | 'input_target' | 'scroll' | 'resize' | 'unavailable'; detector?: SurvivalDetector }
  | { type: 'detector_evaluated'; result: SurvivalDetectorResult }
  | { type: 'objective_issued'; objective: SurvivalObjective }
  | { type: 'objective_submitted'; submission: SurvivalObjectiveSubmission }
  | { type: 'objective_acknowledged'; receipt: SurvivalObjectiveReceipt }
  | { type: 'objective_rejected'; runId: string; objectiveId: string; requestId: string; message: string }
  | { type: 'objective_uncertain'; runId: string; objectiveId: string; requestId: string; message: string }
  | { type: 'identity_bound'; receipt: SurvivalBindReceipt }
  | { type: 'verification_rejected'; runId: string; attemptId: number }
  | { type: 'interrupted'; cause: 'reload' | 'closed'; runId: string }
  | { type: 'new_run' }
)

export type SurvivalRunState = Readonly<{
  phase: SurvivalPhase; run: SurvivalStartReceipt | null; user: SessionUser | null
  activeMs: number; idleElapsedMs: number; lastEventAtMs: number | null
  countdownEndsAtMs: number | null; pauseReasons: readonly SurvivalPauseReason[]
  objective: SurvivalObjective | null; pendingObjective: SurvivalObjectiveSubmission | null
  completedObjectiveIds: readonly string[]
  badWindows: Readonly<Record<SurvivalDetector, number>>
  terminal: SurvivalTerminalSnapshot | null
}>
// Optional on existing writes; all association/timing fields must be present together.
export type SurvivalMutationFields = Readonly<{ game?: SurvivalObjectiveSubmission }>
