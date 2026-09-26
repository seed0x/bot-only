import { DatabaseSync } from 'node:sqlite'

export const db = new DatabaseSync('data.db')
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
