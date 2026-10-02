import { Store, databasePath } from "./db";
import { seedDatabase } from "./seed";
import { settingsSchema, type Settings } from "@/lib/schemas";

const globalForStore = globalThis as unknown as { __gtxStore?: Store };

/** Instance unique de la base (survit au rechargement à chaud en développement). */
export function getStore(): Store {
  if (!globalForStore.__gtxStore) {
    const store = new Store(databasePath());
    seedDatabase(store, { demo: process.env.GENIETRVX_DEMO !== "false" });
    globalForStore.__gtxStore = store;
  }
  return globalForStore.__gtxStore;
}

export function getSettings(store: Store = getStore()): Settings {
  const doc = store.get<Record<string, unknown>>("settings", "main");
  return settingsSchema.parse(doc ?? {});
}

export function saveSettings(input: unknown, store: Store = getStore()): Settings {
  const parsed = settingsSchema.parse(input);
  store.upsert("settings", "main", parsed as unknown as Record<string, unknown>);
  return parsed;
}
