import { DatabaseSync } from 'node:sqlite'

// One SQLite file. DB_PATH points at the Railway volume in production.
const globalForDb = globalThis as unknown as { db?: DatabaseSync }

export function getDb(): DatabaseSync {
  if (globalForDb.db) return globalForDb.db
  const db = new DatabaseSync(process.env.DB_PATH ?? 'data.db')
  db.exec('pragma journal_mode = WAL')
  db.exec(`
    create table if not exists users (
      id integer primary key autoincrement,
      handle text not null unique,
      humanity_score real not null default 1.0,
      verified_bot integer not null default 0,
      created_at text not null default (datetime('now'))
    );
    create table if not exists captcha_attempts (
      id integer primary key autoincrement,
      user_id integer,
      handle text not null,
      challenge text not null,
      passed integer not null default 0,
      score real not null default 0,
      duration_ms integer,
      meta text,
      created_at text not null default (datetime('now'))
    );
    create table if not exists cursor_events (
      id integer primary key autoincrement,
      user_id integer,
      page text not null,
      x real not null,
      y real not null,
      t real not null,
      kind text not null default 'move',
      created_at text not null default (datetime('now'))
    );
    create table if not exists posts (
      id integer primary key autoincrement,
      user_id integer not null,
      body text not null,
      likes integer not null default 0,
      created_at text not null default (datetime('now'))
    );
    create table if not exists likes (
      id integer primary key autoincrement,
      post_id integer not null,
      user_id integer not null,
      created_at text not null default (datetime('now'))
    );
  `)
  globalForDb.db = db
  return db
}
