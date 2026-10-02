import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { BaseRecord } from "@/lib/schemas";

/**
 * Stockage documentaire sur SQLite (module natif `node:sqlite`, Node ≥ 22.13).
 * Chaque enregistrement est un document JSON rangé par collection.
 */

type Row = { id: string; data: string; created_at: string; updated_at: string };
export type StoredDoc = BaseRecord & Record<string, unknown>;

export class Store {
  readonly db: DatabaseSync;

  constructor(file: string) {
    if (file !== ":memory:") mkdirSync(path.dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS records (
        collection TEXT NOT NULL,
        id TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (collection, id)
      );
      CREATE INDEX IF NOT EXISTS idx_records_collection ON records (collection, created_at);
    `);
  }

  private toDoc(row: Row): StoredDoc {
    return { ...(JSON.parse(row.data) as Record<string, unknown>), id: row.id, createdAt: row.created_at, updatedAt: row.updated_at };
  }

  list<T = StoredDoc>(collection: string): T[] {
    const rows = this.db
      .prepare("SELECT id, data, created_at, updated_at FROM records WHERE collection = ? ORDER BY created_at DESC, rowid DESC")
      .all(collection) as unknown as Row[];
    return rows.map((r) => this.toDoc(r) as T);
  }

  get<T = StoredDoc>(collection: string, id: string): T | null {
    const row = this.db
      .prepare("SELECT id, data, created_at, updated_at FROM records WHERE collection = ? AND id = ?")
      .get(collection, id) as unknown as Row | undefined;
    return row ? (this.toDoc(row) as T) : null;
  }

  count(collection: string): number {
    const row = this.db.prepare("SELECT COUNT(*) AS n FROM records WHERE collection = ?").get(collection) as { n: number };
    return Number(row.n);
  }

  insert<T extends Record<string, unknown>>(collection: string, data: T, id: string = randomUUID()): T & BaseRecord {
    const now = new Date().toISOString();
    const clean = stripMeta(data);
    this.db
      .prepare("INSERT INTO records (collection, id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
      .run(collection, id, JSON.stringify(clean), now, now);
    return { ...(clean as T), id, createdAt: now, updatedAt: now };
  }

  update<T extends Record<string, unknown>>(collection: string, id: string, data: T): (T & BaseRecord) | null {
    const existing = this.get(collection, id);
    if (!existing) return null;
    const now = new Date().toISOString();
    const clean = stripMeta(data);
    this.db
      .prepare("UPDATE records SET data = ?, updated_at = ? WHERE collection = ? AND id = ?")
      .run(JSON.stringify(clean), now, collection, id);
    return { ...(clean as T), id, createdAt: existing.createdAt, updatedAt: now };
  }

  upsert<T extends Record<string, unknown>>(collection: string, id: string, data: T): T & BaseRecord {
    return this.update(collection, id, data) ?? this.insert(collection, data, id);
  }

  remove(collection: string, id: string): boolean {
    const res = this.db.prepare("DELETE FROM records WHERE collection = ? AND id = ?").run(collection, id);
    return Number(res.changes) > 0;
  }

  clear(collection?: string) {
    if (collection) this.db.prepare("DELETE FROM records WHERE collection = ?").run(collection);
    else this.db.exec("DELETE FROM records");
  }

  private depth = 0;

  /** Exécute `fn` dans une transaction (tout ou rien). Les appels imbriqués rejoignent la transaction en cours. */
  transaction<R>(fn: () => R): R {
    if (this.depth > 0) return fn();
    this.db.exec("BEGIN IMMEDIATE");
    this.depth++;
    try {
      const result = fn();
      this.db.exec("COMMIT");
      return result;
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    } finally {
      this.depth--;
    }
  }

  dump(): Array<{ collection: string; id: string; data: unknown; createdAt: string; updatedAt: string }> {
    const rows = this.db
      .prepare("SELECT collection, id, data, created_at, updated_at FROM records ORDER BY collection, created_at")
      .all() as unknown as Array<Row & { collection: string }>;
    return rows.map((r) => ({
      collection: r.collection,
      id: r.id,
      data: JSON.parse(r.data),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  restore(entries: Array<{ collection: string; id: string; data: unknown; createdAt: string; updatedAt: string }>) {
    this.transaction(() => {
      this.db.exec("DELETE FROM records");
      const stmt = this.db.prepare(
        "INSERT INTO records (collection, id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
      );
      for (const e of entries) {
        stmt.run(e.collection, e.id, JSON.stringify(e.data), e.createdAt, e.updatedAt);
      }
    });
  }
}

function stripMeta<T extends Record<string, unknown>>(data: T): Omit<T, "id" | "createdAt" | "updatedAt"> {
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = data;
  void _id;
  void _c;
  void _u;
  return rest;
}

export function databasePath(): string {
  return process.env.DATABASE_PATH || path.join(process.cwd(), "data", "genietrvx.db");
}
