import { NextResponse } from "next/server";
import { getSettings, getStore, saveSettings } from "@/lib/server/store";
import { handler, readJson, requireUser } from "@/lib/server/api";
import { logActivity } from "@/lib/server/collections";

export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  await requireUser();
  return NextResponse.json({ settings: getSettings() });
});

export const PUT = handler(async (req: Request) => {
  const user = await requireUser("settings", "write");
  const current = getSettings();
  const body = await readJson(req);
  const merged = {
    company: { ...current.company, ...(body.company as object) },
    payroll: { ...current.payroll, ...(body.payroll as object) },
    invoicing: { ...current.invoicing, ...(body.invoicing as object) },
  };
  const settings = saveSettings(merged);
  logActivity(getStore(), user, "update", "settings", { name: settings.company.name });
  return NextResponse.json({ settings });
});
