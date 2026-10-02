import { NextResponse } from "next/server";
import { getStore } from "@/lib/server/store";
import { handler, requireUser } from "@/lib/server/api";

export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  await requireUser("settings", "read");
  return NextResponse.json({ items: getStore().list("activity").slice(0, 200) });
});
