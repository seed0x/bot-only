import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { cors } from 'hono/cors'
import { db } from './db'

const app = new Hono()
app.use('/api/*', cors())

app.get('/api/health', (c) => c.json({ ok: true }))

app.get('/api/attempts', (c) => {
  const rows = db.prepare('select * from attempts order by id desc limit 100').all()
  return c.json(rows)
})

app.post('/api/attempts', async (c) => {
  const b = await c.req.json()
  const info = db
    .prepare('insert into attempts (name, challenge, passed, score, meta) values (?, ?, ?, ?, ?)')
    .run(String(b.name ?? 'anon'), String(b.challenge ?? ''), b.passed ? 1 : 0, Number(b.score ?? 0), b.meta ? JSON.stringify(b.meta) : null)
  return c.json({ id: info.lastInsertRowid })
})

// production: serve the built frontend from the same process
app.use('/*', serveStatic({ root: './dist' }))

const port = Number(process.env.PORT ?? 8787)
serve({ fetch: app.fetch, port })
console.log(`bot-only api on http://localhost:${port}`)
