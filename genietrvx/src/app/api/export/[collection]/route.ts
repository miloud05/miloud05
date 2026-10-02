import { getStore } from "@/lib/server/store";
import { ApiError, handler, requireUser } from "@/lib/server/api";
import { publicDoc } from "@/lib/server/collections";
import { isCollection } from "@/lib/schemas";

export const dynamic = "force-dynamic";

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Export CSV (séparateur « ; », BOM UTF-8) ouvrable directement dans Excel. */
export const GET = handler(async (_req: Request, ctx: { params: Promise<{ collection: string }> }) => {
  const { collection } = await ctx.params;
  if (!isCollection(collection)) throw new ApiError(404, "unknown_collection");
  await requireUser(collection, "read");
  const docs = getStore().list(collection).map((d) => publicDoc(collection, d));
  const keys = [...new Set(docs.flatMap((d) => Object.keys(d)))];
  const lines = [keys.join(";"), ...docs.map((d) => keys.map((k) => csvCell((d as Record<string, unknown>)[k])).join(";"))];
  return new Response(`﻿${lines.join("\r\n")}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="genietrvx-${collection}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
});
