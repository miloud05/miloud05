import { createHash } from "node:crypto";
import type { Store } from "./db";
import type { Role } from "@/lib/permissions";
import { ENUMS } from "@/lib/schemas";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface SessionClaims {
  sub?: string;
  sid?: unknown;
  name?: unknown;
  email?: unknown;
  role?: unknown;
}

/**
 * Utilisateur d'une session dont la signature a déjà été vérifiée.
 * - Compte présent en base : il doit être actif (désactivation immédiate).
 * - Compte absent d'une base qui a émis le jeton (`sid` identique) : il a été supprimé → refus.
 * - Jeton émis par une autre instance (hébergement sans serveur, stockage éphémère) :
 *   on se fie aux informations signées du jeton.
 */
export function resolveSessionUser(claims: SessionClaims, store: Store, instanceId: string): SessionUser | null {
  if (!claims.sub) return null;
  const user = store.get<{ id: string; name: string; email: string; role: Role; active: boolean }>("users", claims.sub);
  if (user) return user.active === false ? null : { id: user.id, name: user.name, email: user.email, role: user.role };
  if (claims.sid === instanceId) return null;
  const { name, email, role } = claims;
  if (typeof email !== "string" || typeof role !== "string" || !(ENUMS.role as readonly string[]).includes(role)) return null;
  return { id: claims.sub, name: typeof name === "string" ? name : email, email, role: role as Role };
}

/**
 * Cookie de session. En HTTPS : SameSite=None + Partitioned pour fonctionner aussi dans les
 * aperçus intégrés (iframe : StackBlitz, CodeSandbox, IDX…) ; les requêtes d'écriture restent
 * protégées par l'exigence d'un corps JSON. En HTTP (localhost) : SameSite=Lax.
 */
export function sessionCookieOptions(secure: boolean, maxAge?: number) {
  const base = { httpOnly: true, path: "/", ...(maxAge !== undefined ? { maxAge } : {}) };
  return secure
    ? { ...base, secure: true, sameSite: "none" as const, partitioned: true }
    : { ...base, secure: false, sameSite: "lax" as const };
}

type Env = Record<string, string | undefined>;

/** Hébergements « sans serveur » : plusieurs instances, disque local non partagé. */
export function isEphemeralRuntime(env: Env = process.env): boolean {
  return Boolean(env.VERCEL || env.NETLIFY || env.AWS_LAMBDA_FUNCTION_NAME || env.LAMBDA_TASK_ROOT || env.K_SERVICE);
}

/**
 * Clé de session identique sur toutes les instances quand AUTH_SECRET n'est pas défini et que le
 * disque n'est pas partagé. Dérivée des identifiants administrateur : elle n'est pas plus
 * prévisible que le mot de passe administrateur lui-même. Définir AUTH_SECRET reste recommandé.
 */
export function deriveFallbackSecret(env: Env = process.env): string {
  return createHash("sha256")
    .update(["genietrvx-session", env.ADMIN_EMAIL || "admin@genietrvx.dz", env.ADMIN_PASSWORD || "Demo@2026", env.VERCEL_PROJECT_ID || ""].join("|"))
    .digest("base64url");
}

/** Requête servie en HTTPS (directement ou derrière un proxy). */
export function isHttps(req: Request): boolean {
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  return proto === "https" || new URL(req.url).protocol === "https:";
}
