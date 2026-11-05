import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { targetKey, type Target } from './contentDocuments.ts';

// Derived data only. Never write into Payload's tables from this connection.
let database: DatabaseSync;
export function store() {
  if (database) return database;
  const directory = resolve(/* turbopackIgnore: true */ process.env.SEMANTIC_DATA_DIR || './.semantic');
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  database = new DatabaseSync(resolve(directory, 'index.sqlite'));
  database.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS documents (
      key TEXT PRIMARY KEY, target TEXT NOT NULL, revision TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending', hash TEXT, model TEXT, vectors TEXT,
      attempts INTEGER NOT NULL DEFAULT 0, next_attempt INTEGER NOT NULL DEFAULT 0,
      error TEXT, updated INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS queue_due ON documents(status,next_attempt);
    CREATE TABLE IF NOT EXISTS leases (key TEXT PRIMARY KEY, owner TEXT NOT NULL, expires INTEGER NOT NULL);`);
  return database;
}
export function enqueue(target: Target, force = true) {
  const sql = force ? `ON CONFLICT(key) DO UPDATE SET revision=excluded.revision,
    status='pending', attempts=0, next_attempt=0, error=NULL, updated=excluded.updated` : 'ON CONFLICT(key) DO NOTHING';
  store().prepare(`INSERT INTO documents(key,target,revision,updated) VALUES(?,?,?,?) ${sql}`)
    .run(targetKey(target), JSON.stringify(target), randomUUID(), Date.now());
}
export function removeTarget(target: Target) {
  store().prepare('DELETE FROM documents WHERE key=?').run(targetKey(target));
}
export function claimLease(key: string, owner: string, duration = 180_000) {
  return store().prepare(`INSERT INTO leases VALUES(?,?,?) ON CONFLICT(key) DO UPDATE
    SET owner=excluded.owner, expires=excluded.expires WHERE leases.expires<? OR leases.owner=?`)
    .run(key, owner, Date.now() + duration, Date.now(), owner).changes > 0;
}
export function releaseLease(key: string, owner: string) {
  store().prepare('DELETE FROM leases WHERE key=? AND owner=?').run(key, owner);
}
export function health() {
  return store().prepare('SELECT status, COUNT(*) AS count FROM documents GROUP BY status').all();
}
