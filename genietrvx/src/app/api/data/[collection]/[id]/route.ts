import { NextResponse } from "next/server";
import { getStore } from "@/lib/server/store";
import { ApiError, handler, readJson, requireUser } from "@/lib/server/api";
import { deleteDoc, publicDoc, updateDoc } from "@/lib/server/collections";
import { isCollection } from "@/lib/schemas";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ collection: string; id: string }> };

export const GET = handler(async (_req: Request, ctx: Ctx) => {
  const { collection, id } = await ctx.params;
  if (!isCollection(collection)) throw new ApiError(404, "unknown_collection");
  await requireUser(collection, "read");
  const doc = getStore().get(collection, id);
  if (!doc) throw new ApiError(404, "not_found");
  return NextResponse.json({ item: publicDoc(collection, doc) });
});

export const PUT = handler(async (req: Request, ctx: Ctx) => {
  const { collection, id } = await ctx.params;
  if (!isCollection(collection)) throw new ApiError(404, "unknown_collection");
  const user = await requireUser(collection, "write");
  const doc = updateDoc(getStore(), collection, id, await readJson(req), user);
  return NextResponse.json({ item: doc });
});

export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  const { collection, id } = await ctx.params;
  if (!isCollection(collection)) throw new ApiError(404, "unknown_collection");
  const user = await requireUser(collection, "write");
  deleteDoc(getStore(), collection, id, user);
  return NextResponse.json({ ok: true });
});
