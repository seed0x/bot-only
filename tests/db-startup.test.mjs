import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
const check = (file, extra = {}) => spawnSync(process.execPath, ['--experimental-sqlite', '--experimental-strip-types', 'scripts/db-check.mjs'], { env: { ...process.env, DB_PATH: file, DB_RESET: '', ...extra }, encoding: 'utf8' })

test('startup migrates the real SQLite file in place without seeding or deleting rows', () => {
  const dir = mkdtempSync(join(tmpdir(), 'onlybots-db-check-')), file = join(dir, 'data.db')
  try {
    assert.equal(check(file).status, 0)
    let db = new DatabaseSync(file)
    assert.equal(db.prepare('select count(*) n from users').get().n, 0)
    db.prepare("insert into users (handle) values ('preserve-me')").run(); db.close()
    assert.equal(check(file).status, 0)
    db = new DatabaseSync(file)
    assert.equal(db.prepare('select handle from users').get().handle, 'preserve-me'); db.close()
    assert.equal(check(file, { DB_RESET: '1' }).status, 1)
    db = new DatabaseSync(file)
    assert.equal(db.prepare('select handle from users').get().handle, 'preserve-me'); db.close()
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
test('a corrupt file stops startup and is neither renamed nor replaced', () => {
  const dir = mkdtempSync(join(tmpdir(), 'onlybots-db-corrupt-')), file = join(dir, 'data.db')
  try {
    const original = Buffer.from('corrupt sqlite fixture; preserve these bytes')
    writeFileSync(file, original)
    assert.equal(check(file).status, 1)
    assert.deepEqual(readFileSync(file), original)
    assert.deepEqual(readdirSync(dir), ['data.db'])
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
