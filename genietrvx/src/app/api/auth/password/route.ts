import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getStore } from "@/lib/server/store";
import { ApiError, handler, readJson, requireUser } from "@/lib/server/api";

const bodySchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6).max(100),
});

export const POST = handler(async (req: Request) => {
  const user = await requireUser();
  const { currentPassword, newPassword } = bodySchema.parse(await readJson(req));
  const store = getStore();
  const doc = store.get<Record<string, unknown> & { passwordHash: string }>("users", user.id);
  if (!doc) throw new ApiError(404, "not_found");
  if (!(await bcrypt.compare(currentPassword, doc.passwordHash))) throw new ApiError(400, "wrong_password");
  store.update("users", user.id, { ...doc, passwordHash: await bcrypt.hash(newPassword, 10) });
  return NextResponse.json({ ok: true });
});
