import { getDb } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Who beats the most challenges, then who does it most machine-like (lowest score).
export function GET() {
  const rows = getDb().prepare(`
    select u.handle,
           (select count(distinct challenge) from captcha_attempts a where a.user_id = u.id and a.passed = 1) as passed,
           (select min(score) from captcha_attempts a where a.user_id = u.id and a.passed = 1) as best_score,
           (select count(*) from posts p where p.user_id = u.id) as posts,
           (select count(*) from likes l join posts p on p.id = l.post_id where p.user_id = u.id) as likes
    from users u
    where u.verified_bot = 1
    order by passed desc, best_score asc, likes desc
    limit 100
  `).all()
  return Response.json(rows)
}
