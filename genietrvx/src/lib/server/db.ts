import { accessSync, constants, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { BaseRecord } from "@/lib/schemas";

/**
 * Stockage documentaire : chaque enregistrement est un document JSON rangé par collection.
 * Moteur SQLite natif (`node:sqlite`, Node ≥ 22.13) quand il est disponible, sinon fichier JSON
 * (Node 20, hébergeurs sans SQLite) — même API dans les deux cas.
 */

export type StoredDoc = BaseRecord & Record<string, unknown>;
export type EngineKind = "sqlite" | "json";

interface Row {
  collection: string;
  id: string;
  data: string;
  created_at: string;
  updated_at: string;
}

interface Engine {
  /** Lignes d'une collection, de la plus récente à la plus ancienne. */
  list(collection: string): Row[];
  get(collection: string, id: string): Row | undefined;
  count(collection: string): number;
  insert(row: Row): void;
  update(collection: string, id: string, data: string, updatedAt: string): void;
  remove(collection: string, id: string): boolean;
  clear(collection?: string): void;
  /** Toutes les lignes, par collection puis date de création. */
  all(): Row[];
  begin(): void;
  commit(): void;
  rollback(): void;
  close(): void;
}

/* ------------------------------------------------------------------ */
/* Moteur SQLite (node:sqlite)                                          */
/* ------------------------------------------------------------------ */

type SqliteModule = typeof import("node:sqlite");

function loadSqlite(): SqliteModule | null {
  try {
    const getBuiltin = (process as unknown as { getBuiltinModule?: (id: string) => unknown }).getBuiltinModule;
    const mod = getBuiltin?.call(process, "node:sqlite") as SqliteModule | undefined;
    return mod && typeof mod.DatabaseSync === "function" ? mod : null;
  } catch {
    return null;
  }
}

export function sqliteAvailable(): boolean {
  return loadSqlite() !== null;
}

class SqliteEngine implements Engine {
  private db: InstanceType<SqliteModule["DatabaseSync"]>;

  constructor(sqlite: SqliteModule, file: string) {
    this.db = new sqlite.DatabaseSync(file);
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

  list(collection: string): Row[] {
    return this.db
      .prepare("SELECT collection, id, data, created_at, updated_at FROM records WHERE collection = ? ORDER BY created_at DESC, rowid DESC")
      .all(collection) as unknown as Row[];
  }

  get(collection: string, id: string): Row | undefined {
    return this.db
      .prepare("SELECT collection, id, data, created_at, updated_at FROM records WHERE collection = ? AND id = ?")
      .get(collection, id) as unknown as Row | undefined;
  }

  count(collection: string): number {
    const row = this.db.prepare("SELECT COUNT(*) AS n FROM records WHERE collection = ?").get(collection) as { n: number };
    return Number(row.n);
  }

  insert(r: Row) {
    this.db
      .prepare("INSERT INTO records (collection, id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
      .run(r.collection, r.id, r.data, r.created_at, r.updated_at);
  }

  update(collection: string, id: string, data: string, updatedAt: string) {
    this.db.prepare("UPDATE records SET data = ?, updated_at = ? WHERE collection = ? AND id = ?").run(data, updatedAt, collection, id);
  }

  remove(collection: string, id: string): boolean {
    return Number(this.db.prepare("DELETE FROM records WHERE collection = ? AND id = ?").run(collection, id).changes) > 0;
  }

  clear(collection?: string) {
    if (collection) this.db.prepare("DELETE FROM records WHERE collection = ?").run(collection);
    else this.db.exec("DELETE FROM records");
  }

  all(): Row[] {
    return this.db
      .prepare("SELECT collection, id, data, created_at, updated_at FROM records ORDER BY collection, created_at, rowid")
      .all() as unknown as Row[];
  }

  begin() {
    this.db.exec("BEGIN IMMEDIATE");
  }
  commit() {
    this.db.exec("COMMIT");
  }
  rollback() {
    this.db.exec("ROLLBACK");
  }
  close() {
    this.db.close();
  }
}

/* ------------------------------------------------------------------ */
/* Moteur JSON (secours sans node:sqlite)                               */
/* ------------------------------------------------------------------ */

type JsonRow = Row & { seq: number };

class JsonEngine implements Engine {
  private rows = new Map<string, Map<string, JsonRow>>();
  private seq = 0;
  private snapshot: JsonRow[] | null = null;

  constructor(private file: string | null) {
    if (file && existsSync(file)) {
      const parsed = JSON.parse(readFileSync(file, "utf8")) as {
        records?: Array<{ collection: string; id: string; data: unknown; createdAt: string; updatedAt: string }>;
      };
      for (const r of parsed.records ?? []) {
        this.put({ collection: r.collection, id: r.id, data: JSON.stringify(r.data), created_at: r.createdAt, updated_at: r.updatedAt });
      }
    }
  }

  private bucket(collection: string) {
    let b = this.rows.get(collection);
    if (!b) {
      b = new Map();
      this.rows.set(collection, b);
    }
    return b;
  }

  private put(r: Row) {
    this.bucket(r.collection).set(r.id, { ...r, seq: ++this.seq });
  }

  private snapshotRows(): JsonRow[] {
    return [...this.rows.values()].flatMap((b) => [...b.values()].map((r) => ({ ...r })));
  }

  /** Écriture atomique (fichier temporaire puis renommage), hors transaction en cours. */
  private persist() {
    if (!this.file || this.snapshot) return;
    const records = this.all().map((r) => ({
      collection: r.collection,
      id: r.id,
      data: JSON.parse(r.data) as unknown,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify({ app: "genietrvx", version: 1, records }));
    renameSync(tmp, this.file);
  }

  list(collection: string): Row[] {
    return [...(this.rows.get(collection)?.values() ?? [])].sort(
      (a, b) => b.created_at.localeCompare(a.created_at) || b.seq - a.seq,
    );
  }

  get(collection: string, id: string): Row | undefined {
    return this.rows.get(collection)?.get(id);
  }

  count(collection: string): number {
    return this.rows.get(collection)?.size ?? 0;
  }

  insert(r: Row) {
    if (this.get(r.collection, r.id)) throw new Error(`Duplicate id ${r.collection}/${r.id}`);
    this.put(r);
    this.persist();
  }

  update(collection: string, id: string, data: string, updatedAt: string) {
    const row = this.rows.get(collection)?.get(id);
    if (!row) return;
    row.data = data;
    row.updated_at = updatedAt;
    this.persist();
  }

  remove(collection: string, id: string): boolean {
    const removed = this.rows.get(collection)?.delete(id) ?? false;
    if (removed) this.persist();
    return removed;
  }

  clear(collection?: string) {
    if (collection) this.rows.delete(collection);
    else this.rows.clear();
    this.persist();
  }

  all(): Row[] {
    return [...this.rows.values()]
      .flatMap((b) => [...b.values()])
      .sort((a, b) => a.collection.localeCompare(b.collection) || a.created_at.localeCompare(b.created_at) || a.seq - b.seq);
  }

  begin() {
    this.snapshot = this.snapshotRows();
  }

  commit() {
    this.snapshot = null;
    this.persist();
  }

  rollback() {
    const saved = this.snapshot ?? [];
    this.rows.clear();
    for (const r of saved) this.bucket(r.collection).set(r.id, r);
    this.snapshot = null;
  }

  close() {
    this.persist();
  }
}

/* ------------------------------------------------------------------ */
/* Store                                                               */
/* ------------------------------------------------------------------ */

function jsonFileFor(file: string): string {
  return /\.(db|sqlite3?)$/i.test(file) ? file.replace(/\.(db|sqlite3?)$/i, ".json") : `${file}.json`;
}

let fallbackLogged = false;

export class Store {
  readonly engine: EngineKind;
  private impl: Engine;
  private depth = 0;

  constructor(file: string, engine: EngineKind | "auto" = "auto") {
    if (file !== ":memory:") mkdirSync(path.dirname(file), { recursive: true });
    const sqlite = engine === "json" ? null : loadSqlite();
    if (engine === "sqlite" && !sqlite) throw new Error("node:sqlite n'est pas disponible (Node.js ≥ 22.13 requis)");
    if (sqlite) {
      this.engine = "sqlite";
      this.impl = new SqliteEngine(sqlite, file);
    } else {
      this.engine = "json";
      this.impl = new JsonEngine(file === ":memory:" ? null : jsonFileFor(file));
      if (engine === "auto" && !fallbackLogged) {
        fallbackLogged = true;
        console.warn(`[genietrvx] node:sqlite indisponible sur Node ${process.version} : stockage JSON utilisé (${file === ":memory:" ? "mémoire" : jsonFileFor(file)}).`);
      }
    }
  }

  private toDoc(row: Row): StoredDoc {
    return { ...(JSON.parse(row.data) as Record<string, unknown>), id: row.id, createdAt: row.created_at, updatedAt: row.updated_at };
  }

  list<T = StoredDoc>(collection: string): T[] {
    return this.impl.list(collection).map((r) => this.toDoc(r) as T);
  }

  get<T = StoredDoc>(collection: string, id: string): T | null {
    const row = this.impl.get(collection, id);
    return row ? (this.toDoc(row) as T) : null;
  }

  count(collection: string): number {
    return this.impl.count(collection);
  }

  insert<T extends Record<string, unknown>>(collection: string, data: T, id: string = randomUUID()): T & BaseRecord {
    const now = new Date().toISOString();
    const clean = stripMeta(data);
    this.impl.insert({ collection, id, data: JSON.stringify(clean), created_at: now, updated_at: now });
    return { ...(clean as T), id, createdAt: now, updatedAt: now };
  }

  update<T extends Record<string, unknown>>(collection: string, id: string, data: T): (T & BaseRecord) | null {
    const existing = this.impl.get(collection, id);
    if (!existing) return null;
    const now = new Date().toISOString();
    const clean = stripMeta(data);
    this.impl.update(collection, id, JSON.stringify(clean), now);
    return { ...(clean as T), id, createdAt: existing.created_at, updatedAt: now };
  }

  upsert<T extends Record<string, unknown>>(collection: string, id: string, data: T): T & BaseRecord {
    return this.update(collection, id, data) ?? this.insert(collection, data, id);
  }

  remove(collection: string, id: string): boolean {
    return this.impl.remove(collection, id);
  }

  clear(collection?: string) {
    this.impl.clear(collection);
  }

  /** Exécute `fn` dans une transaction (tout ou rien). Les appels imbriqués rejoignent la transaction en cours. */
  transaction<R>(fn: () => R): R {
    if (this.depth > 0) return fn();
    this.impl.begin();
    this.depth++;
    try {
      const result = fn();
      this.impl.commit();
      return result;
    } catch (err) {
      this.impl.rollback();
      throw err;
    } finally {
      this.depth--;
    }
  }

  dump(): Array<{ collection: string; id: string; data: unknown; createdAt: string; updatedAt: string }> {
    return this.impl.all().map((r) => ({
      collection: r.collection,
      id: r.id,
      data: JSON.parse(r.data),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  restore(entries: Array<{ collection: string; id: string; data: unknown; createdAt: string; updatedAt: string }>) {
    this.transaction(() => {
      this.impl.clear();
      for (const e of entries) {
        this.impl.insert({ collection: e.collection, id: e.id, data: JSON.stringify(e.data), created_at: e.createdAt, updated_at: e.updatedAt });
      }
    });
  }

  close() {
    this.impl.close();
  }
}

function stripMeta<T extends Record<string, unknown>>(data: T): Omit<T, "id" | "createdAt" | "updatedAt"> {
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = data;
  void _id;
  void _c;
  void _u;
  return rest;
}

/* ------------------------------------------------------------------ */
/* Emplacement des données                                             */
/* ------------------------------------------------------------------ */

let resolvedDir: string | null = null;

/** Dossier des données ; si le dossier configuré n'est pas inscriptible (hébergeur en lecture seule), dossier temporaire. */
export function dataDirectory(): string {
  if (resolvedDir) return resolvedDir;
  const configured = path.dirname(process.env.DATABASE_PATH || path.join(process.cwd(), "data", "genietrvx.db"));
  try {
    mkdirSync(configured, { recursive: true });
    accessSync(configured, constants.W_OK);
    resolvedDir = configured;
  } catch {
    resolvedDir = path.join(os.tmpdir(), "genietrvx");
    mkdirSync(resolvedDir, { recursive: true });
    console.warn(`[genietrvx] ${configured} n'est pas accessible en écriture : données stockées dans ${resolvedDir}.`);
  }
  return resolvedDir;
}

export function databasePath(): string {
  return path.join(dataDirectory(), path.basename(process.env.DATABASE_PATH || "genietrvx.db"));
}
