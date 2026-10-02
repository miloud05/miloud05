import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getStore, storeInstanceId } from "./store";
import { dataDirectory, usingTemporaryStorage } from "./db";
import { deriveFallbackSecret, isEphemeralRuntime, resolveSessionUser, type SessionUser } from "./session";

export const SESSION_COOKIE = "gtx_session";
const SESSION_DAYS = 7;

export type { SessionUser } from "./session";

let cachedKey: Uint8Array | null = null;
let warnedFallback = false;

/**
 * Clé de signature des sessions :
 * 1. AUTH_SECRET si défini ;
 * 2. hébergement sans serveur / disque temporaire : clé dérivée, identique sur toutes les instances ;
 * 3. sinon clé aléatoire persistée à côté de la base.
 */
function secretKey(): Uint8Array {
  if (cachedKey) return cachedKey;
  let secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    if (isEphemeralRuntime() || usingTemporaryStorage()) {
      secret = deriveFallbackSecret();
      if (!warnedFallback) {
        warnedFallback = true;
        console.warn("[genietrvx] Hébergement sans disque persistant : définissez AUTH_SECRET et utilisez un serveur avec stockage durable pour conserver les données.");
      }
    } else {
      const dir = dataDirectory();
      const file = path.join(dir, ".auth-secret");
      if (existsSync(file)) {
        secret = readFileSync(file, "utf8").trim();
      } else {
        mkdirSync(dir, { recursive: true });
        secret = randomBytes(48).toString("base64url");
        writeFileSync(file, secret, { mode: 0o600 });
      }
    }
  }
  cachedKey = new TextEncoder().encode(secret);
  return cachedKey;
}

export async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({ name: user.name, email: user.email, role: user.role, sid: storeInstanceId() })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());
}

export const sessionMaxAge = SESSION_DAYS * 24 * 60 * 60;

/** Utilisateur courant : jeton signé valide, compte actif (voir resolveSessionUser). */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    const store = getStore();
    return resolveSessionUser(payload, store, storeInstanceId(store));
  } catch {
    return null;
  }
}

/* Limitation simple des tentatives de connexion (mémoire du processus). */
const attempts = new Map<string, { count: number; until: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

export function isRateLimited(key: string): boolean {
  const entry = attempts.get(key);
  return !!entry && entry.until > Date.now() && entry.count >= MAX_ATTEMPTS;
}

export function recordFailedLogin(key: string) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.until < now) attempts.set(key, { count: 1, until: now + WINDOW_MS });
  else entry.count++;
}

export function clearFailedLogins(key: string) {
  attempts.delete(key);
}
