import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getStore } from "@/lib/server/store";
import { ApiError, handler, readJson } from "@/lib/server/api";
import {
  SESSION_COOKIE,
  clearFailedLogins,
  isRateLimited,
  recordFailedLogin,
  sessionMaxAge,
  signSession,
} from "@/lib/server/auth";
import { logActivity } from "@/lib/server/collections";
import type { Role } from "@/lib/permissions";

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().min(3).max(120),
  password: z.string().min(1).max(200),
});

export const POST = handler(async (req: NextRequest) => {
  const { email, password } = bodySchema.parse(await readJson(req));
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const key = `${ip}:${email}`;
  if (isRateLimited(key)) throw new ApiError(429, "too_many_attempts");

  const store = getStore();
  const user = store
    .list<{ id: string; name: string; email: string; role: Role; active: boolean; passwordHash: string }>("users")
    .find((u) => u.email === email);

  const ok = !!user && user.active && (await bcrypt.compare(password, user.passwordHash));
  if (!user || !ok) {
    recordFailedLogin(key);
    throw new ApiError(401, "invalid_credentials");
  }
  clearFailedLogins(key);

  const session = { id: user.id, name: user.name, email: user.email, role: user.role };
  const token = await signSession(session);
  logActivity(store, session, "login", "users", { name: user.name });

  const res = NextResponse.json({ user: session });
  const secure = req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: sessionMaxAge,
  });
  return res;
});
