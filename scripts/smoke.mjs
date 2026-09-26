// End-to-end API check against a running server. Usage: npm run smoke  (BASE_URL=https://… for prod)
const base = process.env.BASE_URL ?? 'http://localhost:3000'
const h = 'smoke_' + Math.random().toString(36).slice(2, 7)
let failed = 0
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); if (!ok) failed++ }
const j = async (path, init) => { const r = await fetch(base + path, init); return { status: r.status, body: await r.json().catch(() => null) } }
const post = (path, body) => j(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

const health = await j('/api/health'); check('health', health.body?.ok === true)
const fail = await post('/api/register', { handle: h, result: { challenge: 'straight-line', passed: false, score: 0.9, duration_ms: 1200, meta: { reason: 'smoke fail' } } })
check('failed attempt records, no user', fail.body?.passed === false && fail.body?.user === null)
const human = await post('/api/posts', { handle: h, body: 'let me in' }); check('human cannot post', human.status === 403)
const pass = await post('/api/register', { handle: h, result: { challenge: 'straight-line', passed: true, score: 0.05, duration_ms: 900, meta: {} } })
check('passed attempt creates user', pass.body?.user?.handle === h)
const p = await post('/api/posts', { handle: h, body: 'smoke transmission' }); check('verified unit posts', p.status === 200 && p.body?.id > 0)
const l1 = await post(`/api/posts/${p.body?.id}/like`, { handle: h }); check('like counts', l1.body?.likes === 1)
const l2 = await post(`/api/posts/${p.body?.id}/like`, { handle: h }); check('second like ignored', l2.body?.already === true)
const prog = await j(`/api/progress?handle=${h}`); check('progress shows pass + humanity', prog.body?.humanity === 0.05 && prog.body?.challenges?.find((c) => c.id === 'straight-line')?.passed === true)
const lb = await j('/api/leaderboard'); check('leaderboard lists unit', lb.body?.some((r) => r.handle === h))
const act = await j('/api/activity'); check('activity logged join/post/like', ['join', 'post', 'like'].every((k) => act.body?.some((a) => a.handle === h && a.kind === k)))
const posts = await j('/api/posts'); check('pinned system post first', posts.body?.[0]?.pinned === 1 || posts.body?.[0]?.handle === 'system', `first=@${posts.body?.[0]?.handle}`)
console.log(failed ? `\n${failed} FAILED` : '\nALL PASS'); process.exit(failed ? 1 : 0)
