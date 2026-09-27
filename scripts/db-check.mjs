// Startup checks the configured SQLite file and applies additive schema changes.
// Never replace, rename, reset or seed data to recover from a startup error.
import { existsSync } from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import nextEnv from '@next/env'

nextEnv.loadEnvConfig(process.cwd())
const file = path.resolve(process.env.DB_PATH ?? 'data.db')
process.env.DB_PATH = file
try {
  if (process.env.DB_RESET === '1') throw new Error('DB_RESET is not supported at startup. Existing data was preserved.')
  if (existsSync(file)) {
    const probe = new DatabaseSync(file, { readOnly: true })
    try {
      const rows = probe.prepare('pragma integrity_check').all()
      if (rows.length !== 1 || rows[0].integrity_check !== 'ok') throw new Error('SQLite integrity check failed. Restore or repair this file before starting.')
    } finally { probe.close() }
  }
  const { getDb } = await import('../src/lib/db.ts')
  const db = getDb()
  db.prepare('select id, handle, verified_bot from users limit 0').all()
  db.prepare('select id, handle, pinned from posts limit 0').all()
  db.prepare('select duration_ms from captcha_attempts limit 0').all()
  db.close()
  console.log(`[db-check] ${file}: SQLite schema ready; no data reset or seeded`)
} catch (error) {
  console.error(`[db-check] ${file}: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
