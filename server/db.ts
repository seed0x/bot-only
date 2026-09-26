import Database from 'better-sqlite3'

export const db = new Database('data.db')
db.pragma('journal_mode = WAL')
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
