import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/server/auth";
import { isHttps, sessionCookieOptions } from "@/lib/server/session";

export async function POST(req: Request) {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(isHttps(req), 0));
  return res;
}
