import { NextResponse } from "next/server";
import { z } from "zod";
import { getSettings, getStore } from "@/lib/server/store";
import { handler, readJson, requireUser } from "@/lib/server/api";
import { generatePayslips } from "@/lib/server/payroll-service";
import { logActivity } from "@/lib/server/collections";

const bodySchema = z.object({
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  projectId: z.string().max(64).optional().default(""),
});

export const POST = handler(async (req: Request) => {
  const user = await requireUser("payslips", "write");
  const { period, projectId } = bodySchema.parse(await readJson(req));
  const store = getStore();
  const result = generatePayslips(store, period, getSettings(store).payroll, { projectId: projectId || undefined });
  logActivity(store, user, "generate", "payslips", { period });
  return NextResponse.json(result);
});
