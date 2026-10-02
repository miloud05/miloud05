import { NextResponse } from "next/server";
import { ApiError, handler, requireUser } from "@/lib/server/api";
import { readSpreadsheet } from "@/lib/server/spreadsheet";
import { rowsToDqeItems } from "@/lib/calc/dqe-import";

export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024;

/** Analyse un fichier Excel (.xlsx) ou CSV et renvoie les articles de DQE détectés (aucune écriture). */
export const POST = handler(async (req: Request) => {
  await requireUser("markets", "write");
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new ApiError(400, "unsupported_file");
  }
  const file = form.get("file");
  if (!(file instanceof File)) throw new ApiError(400, "unsupported_file");
  if (file.size > MAX_BYTES) throw new ApiError(413, "file_too_large");
  let rows: string[][];
  try {
    rows = readSpreadsheet(file.name, new Uint8Array(await file.arrayBuffer()));
  } catch {
    throw new ApiError(400, "unsupported_file");
  }
  const { items, headerRow } = rowsToDqeItems(rows);
  return NextResponse.json({ items, headerRow, rows: rows.length, fileName: file.name });
});
