import { DatabaseSync } from 'node:sqlite'

// One SQLite file. DB_PATH points at the Railway volume in production.
// ensureSchema runs on every call: it is a handful of "if not exists" statements, microseconds,
// and it means a hot-reloaded dev server or an old data.db always ends up on the current schema.
const globalForDb = globalThis as unknown as { db?: DatabaseSync }

const SCHEMA = `
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
  create table if not exists game_runs (
    id text primary key,
    rules_version text not null,
    input_mode text not null check (input_mode in ('pointer','touch_or_keyboard')),
    user_id integer null references users(id),
    started_at text not null,
    terminal_status text null check (terminal_status in ('failed','interrupted')),
    active_ms real null check (active_ms is null or active_ms between 0 and 86400000),
    completed_objectives integer null check (completed_objectives is null or completed_objectives between 0 and 6000),
    primary_reason text null check (primary_reason is null or primary_reason in ('verification_failed','objective_deadline','idle','pointer','typing','scroll')),
    snapshot_json text null,
    finished_at text null,
    check ((terminal_status is null and active_ms is null and completed_objectives is null and primary_reason is null and snapshot_json is null and finished_at is null)
        or (terminal_status is not null and active_ms is not null and completed_objectives is not null and snapshot_json is not null and finished_at is not null)),
    check ((terminal_status = 'failed' and primary_reason is not null) or (terminal_status = 'interrupted' and primary_reason is null) or terminal_status is null)
  );
  create index if not exists game_runs_best on game_runs (rules_version, input_mode, user_id, terminal_status);
  create table if not exists game_objective_events (
    completion_id text primary key,
    run_id text not null references game_runs(id),
    objective_id text not null,
    request_id text not null unique,
    user_id integer not null references users(id),
    action_kind text not null check (action_kind in ('admission','post','like')),
    action_id integer not null check (action_id > 0),
    target_post_id integer null,
    issued_active_ms real not null check (issued_active_ms between 0 and 86400000),
    submitted_active_ms real not null check (submitted_active_ms between 0 and 86400000),
    deadline_active_ms real not null check (deadline_active_ms between 0 and 86400000),
    stage text not null check (stage in ('boot','observe','inspect','audit','purge')),
    receipt_json text not null,
    recorded_at text not null,
    unique (run_id, objective_id),
    unique (action_kind, action_id),
    check ((action_kind = 'like' and target_post_id is not null and target_post_id > 0) or (action_kind != 'like' and target_post_id is null)),
    check (issued_active_ms <= submitted_active_ms and submitted_active_ms <= deadline_active_ms)
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
    db.exec('pragma foreign_keys = ON')
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
