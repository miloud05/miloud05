import { NextResponse } from "next/server";
import { getStore } from "@/lib/server/store";
import { ApiError, handler, readJson, requireUser } from "@/lib/server/api";
import { createDoc, publicDoc } from "@/lib/server/collections";
import { isCollection } from "@/lib/schemas";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ collection: string }> };

export const GET = handler(async (_req: Request, ctx: Ctx) => {
  const { collection } = await ctx.params;
  if (!isCollection(collection)) throw new ApiError(404, "unknown_collection");
  await requireUser(collection, "read");
  const items = getStore().list(collection).map((d) => publicDoc(collection, d));
  return NextResponse.json({ items });
});

export const POST = handler(async (req: Request, ctx: Ctx) => {
  const { collection } = await ctx.params;
  if (!isCollection(collection)) throw new ApiError(404, "unknown_collection");
  const user = await requireUser(collection, "write");
  const doc = createDoc(getStore(), collection, await readJson(req), user);
  return NextResponse.json({ item: doc }, { status: 201 });
});
