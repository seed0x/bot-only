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
