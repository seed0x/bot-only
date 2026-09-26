// The one contract every challenge feeds.
export type CaptchaResult = {
  challenge: string
  passed: boolean
  score: number        // 0 = pure machine, 1 = hopelessly human
  duration_ms: number
  meta?: Record<string, unknown>
}

export type User = {
  id: number
  handle: string
  humanity_score: number
  verified_bot: number
  created_at: string
}
