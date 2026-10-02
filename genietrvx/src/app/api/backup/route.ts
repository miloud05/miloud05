import { NextResponse } from "next/server";
import { z } from "zod";
import { getStore } from "@/lib/server/store";
import { ApiError, handler, requireJsonContent, requireUser } from "@/lib/server/api";

export const dynamic = "force-dynamic";

const backupSchema = z.object({
  app: z.literal("genietrvx"),
  version: z.number(),
  records: z.array(
    z.object({
      collection: z.string().min(1).max(64),
      id: z.string().min(1).max(64),
      data: z.record(z.string(), z.unknown()),
      createdAt: z.string(),
      updatedAt: z.string(),
    }),
  ),
});

export const GET = handler(async () => {
  await requireUser("backup", "write");
  const body = JSON.stringify({ app: "genietrvx", version: 1, exportedAt: new Date().toISOString(), records: getStore().dump() });
  return new Response(body, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="genietrvx-backup-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
});

export const POST = handler(async (req: Request) => {
  const user = await requireUser("backup", "write");
  requireJsonContent(req);
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new ApiError(400, "invalid_json");
  }
  const backup = backupSchema.parse(json);
  const admins = backup.records.filter(
    (r) => r.collection === "users" && r.data.role === "admin" && r.data.active !== false && typeof r.data.passwordHash === "string",
  );
  if (admins.length === 0) throw new ApiError(400, "backup_without_admin");
  getStore().restore(backup.records);
  return NextResponse.json({ ok: true, restored: backup.records.length, by: user.email });
});
