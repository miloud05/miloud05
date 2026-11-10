import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Store } from "@/lib/server/db";
import { GET, POST } from "@/app/api/backup/route";
import type { SessionUser } from "@/lib/server/auth";

const { getCurrentUser, getStore } = vi.hoisted(() => ({ getCurrentUser: vi.fn(), getStore: vi.fn() }));
vi.mock("@/lib/server/auth", () => ({ getCurrentUser }));
vi.mock("@/lib/server/store", () => ({ getStore }));

const admin: SessionUser = { id: "admin-1", name: "Admin", email: "admin@example.test", role: "admin" };
const request = (body: unknown) => new Request("http://localhost/api/backup", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
});
const record = (collection: string, id: string, data: Record<string, unknown>) => ({
  collection, id, data, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
});
const activeAdmin = record("users", "restored-admin", {
  name: "Restored", email: "restored@example.test", role: "admin", active: true, passwordHash: "stored-hash",
});
const backup = (records = [activeAdmin]) => ({ app: "genietrvx", version: 1, records });

// Exercise destructive replacement against both real persistence engines, not a restore mock.
describe.each(["sqlite", "json"] as const)("API de sauvegarde (%s)", (engine) => {
  let store: Store;
  beforeEach(() => {
    vi.clearAllMocks();
    store = new Store(":memory:", engine);
    store.insert("clients", { name: "À conserver en cas de refus" });
    getStore.mockReturnValue(store);
    getCurrentUser.mockResolvedValue(admin);
  });
  afterEach(() => store.close());

  it.each([null, "manager", "accountant", "site_manager", "viewer"] as const)(
    "refuse export et restauration pour %s avant tout accès aux données",
    async (role) => {
      getCurrentUser.mockResolvedValue(role ? { ...admin, role } : null);
      const before = store.dump();
      for (const response of [await GET(), await POST(request(backup()))]) {
        expect(response.status).toBe(role ? 403 : 401);
        expect(await response.json()).toEqual({ error: role ? "forbidden" : "unauthorized" });
      }
      expect(getStore).not.toHaveBeenCalled();
      expect(store.dump()).toEqual(before);
    },
  );

  it("exporte un document réimportable avec les métadonnées et l'en-tête de téléchargement", async () => {
    store.upsert("users", activeAdmin.id, activeAdmin.data);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json");
    expect(response.headers.get("content-disposition")).toMatch(/^attachment; filename="genietrvx-backup-\d{4}-\d{2}-\d{2}\.json"$/);
    const exported = await response.json();
    expect(exported).toEqual({
      app: "genietrvx", version: 1, exportedAt: expect.any(String), records: store.dump(),
    });
    expect(Number.isNaN(Date.parse(exported.exportedAt))).toBe(false);
    const responseAfterImport = await POST(request(exported));
    expect(responseAfterImport.status).toBe(200);
    expect(store.dump()).toEqual(exported.records);
  });

  it("remplace les anciennes données et conserve les identifiants et dates du fichier", async () => {
    const records = [activeAdmin, record("invoices", "invoice-1", { total: 1250.50 })];
    const response = await POST(request(backup(records)));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, restored: 2, by: admin.email });
    expect(store.dump()).toEqual(expect.arrayContaining(records));
    expect(store.dump()).toHaveLength(2);
    expect(store.count("clients")).toBe(0);
  });

  it.each([
    ["vide", []],
    ["sans utilisateur", [record("clients", "client-1", { name: "Client" })]],
    ["admin inactif", [{ ...activeAdmin, data: { ...activeAdmin.data, active: false } }]],
    ["autre rôle", [{ ...activeAdmin, data: { ...activeAdmin.data, role: "viewer" } }]],
    ["sans mot de passe", [{ ...activeAdmin, data: { role: "admin", active: true } }]],
    ["mot de passe non textuel", [{ ...activeAdmin, data: { ...activeAdmin.data, passwordHash: 123 } }]],
  ] as const)("refuse un fichier %s sans supprimer les données", async (_label, records) => {
    const before = store.dump();
    const response = await POST(request(backup([...records])));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "backup_without_admin" });
    expect(store.dump()).toEqual(before);
  });

  it.each([
    null,
    { ...backup(), app: "other-app" },
    { ...backup(), version: "1" },
    { ...backup(), records: "not-an-array" },
    backup([{ ...activeAdmin, id: "" }]),
    { ...backup(), records: [{ ...activeAdmin, data: [] }] },
    { ...backup(), records: [{ ...activeAdmin, createdAt: 123 }] },
  ])("refuse un schéma invalide sans modifier les données (%#)", async (body) => {
    const before = store.dump();
    const response = await POST(request(body));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "validation", details: expect.any(Array) });
    expect(store.dump()).toEqual(before);
  });

  it.each([
    ["text/plain", JSON.stringify(backup()), 415],
    [undefined, JSON.stringify(backup()), 415],
    ["application/json", "{broken", 400],
  ] as const)("refuse le corps %s / %s", async (contentType, body, status) => {
    const before = store.dump();
    const response = await POST(new Request("http://localhost/api/backup", {
      method: "POST", headers: contentType ? { "content-type": contentType } : {}, body,
    }));
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: "invalid_json" });
    expect(store.dump()).toEqual(before);
  });
});
