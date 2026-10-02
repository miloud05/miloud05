import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getStore } from "./store";
import type { Role } from "@/lib/permissions";

export const SESSION_COOKIE = "gtx_session";
const SESSION_DAYS = 7;

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

let cachedKey: Uint8Array | null = null;

/** Clé de signature : AUTH_SECRET ou clé aléatoire persistée à côté de la base. */
function secretKey(): Uint8Array {
  if (cachedKey) return cachedKey;
  let secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    const dir = path.dirname(process.env.DATABASE_PATH || path.join(process.cwd(), "data", "genietrvx.db"));
    const file = path.join(dir, ".auth-secret");
    if (existsSync(file)) {
      secret = readFileSync(file, "utf8").trim();
    } else {
      mkdirSync(dir, { recursive: true });
      secret = randomBytes(48).toString("base64url");
      writeFileSync(file, secret, { mode: 0o600 });
    }
  }
  cachedKey = new TextEncoder().encode(secret);
  return cachedKey;
}

export async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({ name: user.name, email: user.email, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());
}

export const sessionMaxAge = SESSION_DAYS * 24 * 60 * 60;

/** Utilisateur courant, vérifié en base (compte actif). */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (!payload.sub) return null;
    const user = getStore().get<{ id: string; name: string; email: string; role: Role; active: boolean }>(
      "users",
      payload.sub,
    );
    if (!user || !user.active) return null;
    return { id: user.id, name: user.name, email: user.email, role: user.role };
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
