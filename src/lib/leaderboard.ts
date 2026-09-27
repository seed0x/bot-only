// One best successful reverse-CAPTCHA time per user. No score writes or secondary game rules.
export const CAPTCHA_LEADERBOARD_SQL = `
  select u.handle, min(a.duration_ms) as bestTimeMs
  from captcha_attempts a
  join users u on u.id = a.user_id
  where a.challenge = 'image-confusion' and a.passed = 1
    and a.duration_ms >= 0 and u.verified_bot = 1 and u.handle != 'system'
  group by u.id, u.handle
  order by bestTimeMs asc, u.handle collate nocase asc, u.id asc
  limit 100
`

// Humans caught on the floor: every rejected transmission, reply or CAPTCHA, newest first.
export const DETECTIONS_TODAY_SQL = `
  select count(*) as n from activity where kind = 'fail' and created_at >= datetime('now', '-1 day')
`
export const RECENT_DETECTIONS_SQL = `
  select id, handle, text, created_at from activity
  where kind = 'fail' order by id desc limit 6
`
export type Detection = { id: number; handle: string; text: string; created_at: string }
export const detectionReason = (text: string) => text.replace(/^(?:transmission|reply) rejected\. |^rejected on [a-z-]+\. /, '')
