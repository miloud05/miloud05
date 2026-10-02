import { NextResponse } from "next/server";
import { handler, requireUser } from "@/lib/server/api";

export const GET = handler(async () => {
  const user = await requireUser();
  return NextResponse.json({ user });
});
