// Runs before `npm start` and `npm run dev`. Makes the database the app is about to open usable:
//   missing            → create it and seed the demo opening
//   broken or outdated → move it aside as <file>.broken-<time> and seed a fresh one
//   DB_RESET=1         → always seed a fresh one (clears junk before a demo)
//   healthy            → touch nothing
// "Broken" means the queries the app runs on every page fail, or SQLite's integrity check fails.
import { existsSync, renameSync } from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const file = path.resolve(process.env.DB_PATH ?? 'data.db')
process.env.DB_PATH = file

function probe() {
  const db = new DatabaseSync(file)
  try {
    const integrity = db.prepare('pragma integrity_check').get()
    if (integrity.integrity_check !== 'ok') throw new Error('integrity: ' + integrity.integrity_check)
    // the same reads the feed, gate and leaderboard make on every request
    db.prepare("select humanity_score, verified_bot from users where handle = ?").get('probe')
    db.prepare("select challenge, min(score) as best from captcha_attempts where handle = ? and passed = 1 group by challenge").all('probe')
    db.prepare("select id, handle, score, duration_ms, meta, created_at from captcha_attempts where passed = 1 order by id desc limit 1").get()
    db.prepare("select p.id from posts p left join likes l on l.post_id = p.id limit 1").all()
    db.prepare("select id from comments limit 1").all()
    return null
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  } finally { db.close() }
}

let reason = null
if (process.env.DB_RESET === '1') reason = 'DB_RESET=1'
else if (!existsSync(file)) reason = 'no database yet'
else reason = probe()

if (reason === null) {
  console.log(`[db-check] ${file} is healthy`)
} else {
  if (existsSync(file) && process.env.DB_RESET !== '1') {
    const aside = `${file}.broken-${new Date().toISOString().replace(/[:.]/g, '-')}`
    renameSync(file, aside)
    for (const ext of ['-wal', '-shm']) if (existsSync(file + ext)) renameSync(file + ext, aside + ext)
    console.log(`[db-check] ${file} unusable (${reason}); moved to ${aside}`)
  } else if (existsSync(file)) {
    console.log(`[db-check] ${reason}: rebuilding ${file}`)
  } else {
    console.log(`[db-check] ${reason}: creating ${file}`)
  }
  await import('./seed.mjs')
}
