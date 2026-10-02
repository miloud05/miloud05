import { describe, expect, it } from "vitest";
import { Store } from "@/lib/server/db";
import { seedDatabase } from "@/lib/server/seed";
import { storeInstanceId } from "@/lib/server/store";
import { deriveFallbackSecret, isEphemeralRuntime, resolveSessionUser, sessionCookieOptions } from "@/lib/server/session";

function seeded() {
  const s = new Store(":memory:");
  seedDatabase(s, { demo: true });
  return s;
}

describe("resolveSessionUser", () => {
  it("retourne l'utilisateur actif trouvé en base", () => {
    const s = seeded();
    const admin = s.list<{ id: string; email: string }>("users").find((u) => u.email === "admin@genietrvx.dz")!;
    const user = resolveSessionUser({ sub: admin.id, sid: storeInstanceId(s) }, s, storeInstanceId(s));
    expect(user?.email).toBe("admin@genietrvx.dz");
    expect(user?.role).toBe("admin");
  });

  it("refuse un compte désactivé", () => {
    const s = seeded();
    const u = s.list<Record<string, unknown> & { id: string; email: string }>("users").find((x) => x.email === "chef@genietrvx.dz")!;
    s.update("users", u.id, { ...u, active: false });
    expect(resolveSessionUser({ sub: u.id, sid: storeInstanceId(s) }, s, storeInstanceId(s))).toBeNull();
  });

  it("refuse un compte supprimé de cette même base", () => {
    const s = seeded();
    const sid = storeInstanceId(s);
    expect(resolveSessionUser({ sub: "deleted-id", sid, name: "X", email: "x@x.dz", role: "admin" }, s, sid)).toBeNull();
  });

  it("accepte un jeton signé par une autre instance (hébergement sans serveur)", () => {
    const s = seeded();
    const user = resolveSessionUser(
      { sub: "other-instance-user", sid: "another-instance", name: "Ali", email: "ali@genietrvx.dz", role: "manager" },
      s,
      storeInstanceId(s),
    );
    expect(user).toEqual({ id: "other-instance-user", name: "Ali", email: "ali@genietrvx.dz", role: "manager" });
  });

  it("refuse un jeton incomplet ou au rôle inconnu", () => {
    const s = seeded();
    expect(resolveSessionUser({ sub: "x", sid: "other", email: "a@b.dz", role: "superuser" }, s, storeInstanceId(s))).toBeNull();
    expect(resolveSessionUser({ sid: "other" }, s, storeInstanceId(s))).toBeNull();
  });
});

describe("données de démonstration", () => {
  it("ont les mêmes identifiants sur chaque instance", () => {
    const a = seeded();
    const b = seeded();
    const ids = (s: Store) => s.list<{ id: string }>("users").map((u) => u.id).sort();
    expect(ids(a)).toEqual(ids(b));
    expect(a.list<{ id: string }>("projects").map((p) => p.id).sort()).toEqual(b.list<{ id: string }>("projects").map((p) => p.id).sort());
  });

  it("gardent un identifiant d'instance propre à chaque base", () => {
    expect(storeInstanceId(seeded())).not.toBe(storeInstanceId(seeded()));
  });
});

describe("cookie et clé de session", () => {
  it("autorise l'aperçu intégré (iframe) en HTTPS et reste Lax en HTTP", () => {
    expect(sessionCookieOptions(true)).toMatchObject({ httpOnly: true, secure: true, sameSite: "none", partitioned: true, path: "/" });
    expect(sessionCookieOptions(false)).toMatchObject({ httpOnly: true, secure: false, sameSite: "lax", path: "/" });
    expect(sessionCookieOptions(false)).not.toHaveProperty("partitioned");
  });

  it("détecte les hébergements sans serveur", () => {
    expect(isEphemeralRuntime({ VERCEL: "1" })).toBe(true);
    expect(isEphemeralRuntime({ NETLIFY: "true" })).toBe(true);
    expect(isEphemeralRuntime({ AWS_LAMBDA_FUNCTION_NAME: "fn" })).toBe(true);
    expect(isEphemeralRuntime({})).toBe(false);
  });

  it("dérive une clé stable et identique sur toutes les instances", () => {
    const env = { ADMIN_PASSWORD: "S3cret!", ADMIN_EMAIL: "a@b.dz" };
    expect(deriveFallbackSecret(env)).toBe(deriveFallbackSecret({ ...env }));
    expect(deriveFallbackSecret(env)).not.toBe(deriveFallbackSecret({ ...env, ADMIN_PASSWORD: "autre" }));
    expect(deriveFallbackSecret(env).length).toBeGreaterThanOrEqual(32);
  });
});
