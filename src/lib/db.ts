import { DatabaseSync } from 'node:sqlite'

// One SQLite file. DB_PATH points at the Railway volume in production.
const globalForDb = globalThis as unknown as { db?: DatabaseSync }

export function getDb(): DatabaseSync {
  if (globalForDb.db) return globalForDb.db
  const db = new DatabaseSync(process.env.DB_PATH ?? 'data.db')
  db.exec('pragma journal_mode = WAL')
  db.exec(`
    create table if not exists attempts (
      id integer primary key autoincrement,
      name text not null,
      challenge text not null,
      passed integer not null default 0,
      score real not null default 0,
      meta text,
      created_at text not null default (datetime('now'))
    );
  `)
  globalForDb.db = db
  return db
}
