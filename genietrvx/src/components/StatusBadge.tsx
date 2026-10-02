"use client";

import { Badge, type Tone } from "@/components/ui";
import { useApp } from "@/components/providers/AppProvider";

const TONES: Record<string, Record<string, Tone>> = {
  projectStatus: { study: "info", ongoing: "primary", suspended: "warning", completed: "success", delivered: "success" },
  marketStatus: { draft: "neutral", ongoing: "primary", provisional: "info", final: "success", closed: "neutral" },
  situationStatus: { draft: "neutral", submitted: "info", approved: "warning", paid: "success" },
  quoteStatus: { draft: "neutral", sent: "info", accepted: "success", rejected: "danger" },
  invoiceStatus: { draft: "neutral", issued: "info", cancelled: "danger" },
  paymentStatus: { unpaid: "danger", partial: "warning", paid: "success" },
  activeStatus: { active: "success", inactive: "neutral" },
  attendanceStatus: { present: "success", half: "info", absent: "danger", leave: "primary", weather: "warning", sick: "warning" },
  payslipStatus: { draft: "neutral", validated: "info", paid: "success" },
  equipmentStatus: { available: "success", in_use: "primary", broken: "danger", maintenance: "warning" },
  movementType: { in: "success", out: "warning", adjustment: "info" },
  role: { admin: "danger", manager: "primary", accountant: "info", site_manager: "warning", viewer: "neutral" },
  subcontractStatus: { active: "primary", completed: "success", cancelled: "danger" },
  clientType: { public: "info", private: "primary", individual: "neutral" },
  marketKind: { public: "info", private: "primary" },
  odsType: { start: "success", stop: "danger", resume: "info", modification: "warning", other: "neutral" },
};

export function StatusBadge({ enumKey, value }: { enumKey: string; value: string | undefined }) {
  const { enumLabel } = useApp();
  if (!value) return <span className="text-muted">—</span>;
  return <Badge tone={TONES[enumKey]?.[value] ?? "neutral"}>{enumLabel(enumKey, value)}</Badge>;
}
