import { ZodError } from "zod";
import { NextResponse } from "next/server";
import { getCurrentUser, type SessionUser } from "./auth";
import { can, type Resource } from "@/lib/permissions";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export async function requireUser(resource?: Resource, mode: "read" | "write" = "read"): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new ApiError(401, "unauthorized");
  if (resource && !can(user.role, resource, mode)) throw new ApiError(403, "forbidden");
  return user;
}

/** Enveloppe un gestionnaire de route : erreurs normalisées en JSON. */
export function handler<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof ApiError) {
        return NextResponse.json({ error: err.message, details: err.details }, { status: err.status });
      }
      if (err instanceof ZodError) {
        return NextResponse.json(
          {
            error: "validation",
            details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
          },
          { status: 400 },
        );
      }
      console.error("[api]", err);
      return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
  };
}

/** Exige un corps JSON (protection CSRF complémentaire au cookie SameSite=Lax). */
export function requireJsonContent(req: Request) {
  if (!(req.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) {
    throw new ApiError(415, "invalid_json");
  }
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  requireJsonContent(req);
  try {
    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body as Record<string, unknown>;
  } catch {
    throw new ApiError(400, "invalid_json");
  }
}
