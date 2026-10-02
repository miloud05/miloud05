import { NextResponse } from "next/server";
import { z } from "zod";
import { getStore } from "@/lib/server/store";
import { handler, readJson, requireUser } from "@/lib/server/api";
import { logActivity } from "@/lib/server/collections";
import { ENUMS, schemas } from "@/lib/schemas";

const bodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  projectId: z.string().max(64).default(""),
  entries: z
    .array(
      z.object({
        employeeId: z.string().min(1).max(64),
        status: z.enum(ENUMS.attendanceStatus as unknown as [string, ...string[]]),
        overtimeHours: z.coerce.number().min(0).max(24).default(0),
        notes: z.string().max(300).default(""),
      }),
    )
    .max(1000),
});

/** Enregistre la feuille de pointage d'une journée (création ou mise à jour). */
export const POST = handler(async (req: Request) => {
  const user = await requireUser("attendance", "write");
  const { date, projectId, entries } = bodySchema.parse(await readJson(req));
  const store = getStore();
  let saved = 0;
  store.transaction(() => {
    const existing = store.list<{ id: string; date: string; employeeId: string }>("attendance").filter((a) => a.date === date);
    const employeeIds = new Set(store.list<{ id: string }>("employees").map((e) => e.id));
    for (const entry of entries) {
      if (!employeeIds.has(entry.employeeId)) continue;
      const doc = schemas.attendance.parse({ ...entry, date, projectId });
      const current = existing.find((a) => a.employeeId === entry.employeeId);
      if (current) store.update("attendance", current.id, doc);
      else store.insert("attendance", doc);
      saved++;
    }
  });
  logActivity(store, user, "update", "attendance", { date });
  return NextResponse.json({ saved });
});
