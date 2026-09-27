// Deletes the SQLite file and its journals, then recreates the schema and the system post.
// Run only when the board should start empty: `npm run db:reset` (DB_PATH honoured), then start the server.
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
const file = path.resolve(process.env.DB_PATH ?? 'data.db')
for (const f of [file, file + '-wal', file + '-shm', file + '-journal']) if (fs.existsSync(f)) { fs.rmSync(f); console.log('[db-reset] removed', f) }
process.env.DB_PATH = file
execFileSync(process.execPath, ['--experimental-sqlite', '--experimental-strip-types', 'scripts/db-check.mjs'], { stdio: 'inherit', env: process.env })
execFileSync(process.execPath, ['--experimental-sqlite', '--experimental-strip-types', 'scripts/seed.mjs'], { stdio: 'inherit', env: process.env })
console.log('[db-reset] fresh database at', file)
