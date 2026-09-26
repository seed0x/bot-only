import { DatabaseSync } from 'node:sqlite'

// One SQLite file. DB_PATH points at the Railway volume in production.
// ensureSchema runs on every call: it is a handful of "if not exists" statements, microseconds,
// and it means a hot-reloaded dev server or an old data.db always ends up on the current schema.
const globalForDb = globalThis as unknown as { db?: DatabaseSync }

const SCHEMA = `
  create table if not exists gate_sessions (
    token_hash text primary key,
    user_id integer not null,
    attempt_id integer not null,
    expires_at integer not null
  );
  create table if not exists operation_receipts (
    request_id text primary key,
    fingerprint text not null,
    response text not null
  );
  create table if not exists challenge_instances (
    id text primary key,
    handle text not null,
    kind text not null,
    payload text not null,
    started_at integer not null,
    expires_at integer not null,
    used integer not null default 0
  );
  create table if not exists captcha_tiles (
    token text primary key,
    challenge_id text not null,
    file text not null,
    expires_at integer not null
  );
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
    handle text not null default '',
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
  create unique index if not exists likes_one_per_unit on likes (post_id, user_id);
  create table if not exists activity (
    id integer primary key autoincrement,
    kind text not null,
    handle text not null,
    text text not null,
    created_at text not null default (datetime('now'))
  );
  create index if not exists attempts_recent on captcha_attempts (created_at, passed);
  create table if not exists leaderboard (
    unit_designation text primary key,
    best_time_ms integer not null check (best_time_ms >= 0),
    rounds_survived integer not null check (rounds_survived >= 0)
  );
`

// Additive column migrations for databases created before a column existed.
const COLUMNS: [table: string, column: string, definition: string][] = [
  ['posts', 'handle', "text not null default ''"],
  ['posts', 'pinned', 'integer not null default 0'],
]

function ensureSchema(db: DatabaseSync) {
  db.exec(SCHEMA)
  for (const [table, column, def] of COLUMNS) {
    const cols = db.prepare(`pragma table_info(${table})`).all() as { name: string }[]
    if (!cols.some((c) => c.name === column)) db.exec(`alter table ${table} add column ${column} ${def}`)
  }
}

export function getDb(): DatabaseSync {
  if (!globalForDb.db) {
    const db = new DatabaseSync(process.env.DB_PATH ?? 'data.db')
    db.exec('pragma journal_mode = WAL')
    globalForDb.db = db
  }
  ensureSchema(globalForDb.db)
  return globalForDb.db
}

export function logActivity(kind: string, handle: string, text: string) {
  getDb().prepare('insert into activity (kind, handle, text) values (?, ?, ?)').run(kind, handle, text)
}

export function cleanHandle(raw: unknown): string {
  return String(raw ?? '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24)
}
