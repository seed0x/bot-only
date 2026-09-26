// The one contract every challenge feeds.
export type CaptchaResult = {
  challenge: string
  passed: boolean
  score: number        // 0 = pure machine, 1 = hopelessly human
  duration_ms: number
  meta?: Record<string, unknown>
}

export type SessionUser = { id: number; handle: string }

export type Post = { id: number; handle: string; body: string; likes: number; pinned: number; created_at: string }
export type Activity = { id: number; kind: string; handle: string; text: string; created_at: string }
export type LeaderRow = { handle: string; passed: number; best_score: number; posts: number; likes: number }
export type Progress = { id: string; name: string; hint: string; live: boolean; passed: boolean; best_score: number | null }
