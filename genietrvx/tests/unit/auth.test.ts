import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT, jwtVerify } from "jose";
import { Store } from "@/lib/server/db";

const { cookie, getStore } = vi.hoisted(() => ({ cookie: vi.fn(), getStore: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: cookie }) }));
vi.mock("@/lib/server/store", () => ({ getStore }));

const secret = "test-only-session-key-at-least-32-characters";
const session = { id: "user-1", name: "Admin", email: "admin@example.test", role: "admin" as const };
let store: Store;
let auth: typeof import("@/lib/server/auth");

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("AUTH_SECRET", secret);
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  store = new Store(":memory:", "json");
  store.upsert("users", session.id, { ...session, active: true, passwordHash: "not-exposed" });
  getStore.mockReturnValue(store);
  cookie.mockReturnValue(undefined);
  auth = await import("@/lib/server/auth");
});

afterEach(() => {
  store.close();
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("sessions signées", () => {
  it("signe un jeton HS256 valable sept jours sans exposer le mot de passe", async () => {
    const user = { ...session, passwordHash: "not-exposed" };
    const token = await auth.signSession(user);
    const { payload, protectedHeader } = await jwtVerify(token, new TextEncoder().encode(secret));
    expect(protectedHeader.alg).toBe("HS256");
    expect(payload).toEqual({
      sub: session.id, name: session.name, email: session.email, role: session.role,
      iat: Date.now() / 1000, exp: Date.now() / 1000 + auth.sessionMaxAge,
    });
    expect(auth.sessionMaxAge).toBe(7 * 24 * 60 * 60);
  });

  it("refuse une requête sans cookie sans consulter la base", async () => {
    expect(await auth.getCurrentUser()).toBeNull();
    expect(cookie).toHaveBeenCalledWith(auth.SESSION_COOKIE);
    expect(getStore).not.toHaveBeenCalled();
  });

  it("utilise le rôle et le profil actuels en base, pas ceux du jeton", async () => {
    cookie.mockReturnValue({ value: await auth.signSession(session) });
    store.update("users", session.id, { name: "Viewer", email: "viewer@example.test", role: "viewer", active: true });
    expect(await auth.getCurrentUser()).toEqual({
      id: session.id, name: "Viewer", email: "viewer@example.test", role: "viewer",
    });
  });

  it.each(["désactivé", "supprimé"])("refuse un compte %s après émission du jeton", async (state) => {
    cookie.mockReturnValue({ value: await auth.signSession(session) });
    if (state === "supprimé") store.remove("users", session.id);
    else store.update("users", session.id, { ...session, active: false });
    expect(await auth.getCurrentUser()).toBeNull();
  });

  it("refuse le jeton dès son expiration", async () => {
    cookie.mockReturnValue({ value: await auth.signSession(session) });
    vi.advanceTimersByTime(auth.sessionMaxAge * 1000);
    expect(await auth.getCurrentUser()).toBeNull();
    expect(getStore).not.toHaveBeenCalled();
  });

  it.each(["malformé", "autre clé", "autre algorithme", "sans sujet"])("refuse un jeton %s", async (kind) => {
    let token = "not.a.jwt";
    if (kind !== "malformé") {
      const jwt = new SignJWT({ role: "admin" }).setExpirationTime("1h");
      if (kind !== "sans sujet") jwt.setSubject(session.id);
      token = await jwt.setProtectedHeader({ alg: kind === "autre algorithme" ? "HS384" : "HS256" })
        .sign(new TextEncoder().encode(kind === "autre clé" ? "different-key-".repeat(5) : secret));
    }
    cookie.mockReturnValue({ value: token });
    expect(await auth.getCurrentUser()).toBeNull();
    expect(getStore).not.toHaveBeenCalled();
  });
});

describe("limitation des connexions", () => {
  it("bloque au dixième échec et isole chaque clé", () => {
    for (let i = 0; i < 9; i++) auth.recordFailedLogin("ip:email");
    expect(auth.isRateLimited("ip:email")).toBe(false);
    auth.recordFailedLogin("ip:email");
    expect(auth.isRateLimited("ip:email")).toBe(true);
    expect(auth.isRateLimited("other:email")).toBe(false);
    expect(auth.isRateLimited("ip:other")).toBe(false);
  });

  it("expire après quinze minutes et compte une nouvelle fenêtre", () => {
    for (let i = 0; i < 10; i++) auth.recordFailedLogin("key");
    vi.advanceTimersByTime(15 * 60 * 1000 - 1);
    expect(auth.isRateLimited("key")).toBe(true);
    vi.advanceTimersByTime(1);
    expect(auth.isRateLimited("key")).toBe(false);
    vi.advanceTimersByTime(1);
    auth.recordFailedLogin("key");
    expect(auth.isRateLimited("key")).toBe(false);
    for (let i = 0; i < 9; i++) auth.recordFailedLogin("key");
    expect(auth.isRateLimited("key")).toBe(true);
  });

  it("efface les échecs après une connexion réussie", () => {
    for (let i = 0; i < 10; i++) auth.recordFailedLogin("key");
    auth.clearFailedLogins("key");
    auth.recordFailedLogin("key");
    expect(auth.isRateLimited("key")).toBe(false);
  });
});
