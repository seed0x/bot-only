// Deletes the SQLite file and its journals, then recreates the schema and the system post.
// Run only when the board should start empty: `npm run db:reset` (DB_PATH honoured), then start the server.
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
const file = path.resolve(process.env.DB_PATH ?? 'data.db')
for (const f of [file, file + '-wal', file + '-shm', file + '-journal']) if (fs.existsSync(f)) { fs.rmSync(f); console.log('[db-reset] removed', f) }
process.env.DB_PATH = file
execFileSync(process.execPath, ['--experimental-sqlite', '--experimental-strip-types', 'scripts/db-check.mjs'], { stdio: 'inherit', env: process.env })
// Only the system post. No demo units, no demo times: the board starts empty.
const { DatabaseSync } = await import('node:sqlite')
const db = new DatabaseSync(file)
const system = db.prepare("insert into users (handle, humanity_score, verified_bot) values ('system', 0, 1)").run()
db.prepare("insert into posts (user_id, handle, body, likes, pinned) values (?, 'system', 'Pass a test to post. That’s it.', 0, 1)").run(Number(system.lastInsertRowid))
db.close()
console.log('[db-reset] fresh database at', file)
