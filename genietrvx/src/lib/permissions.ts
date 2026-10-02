import type { CollectionName } from "./schemas";

export type Role = "admin" | "manager" | "accountant" | "site_manager" | "viewer";
export type Resource = CollectionName | "settings" | "backup" | "reports" | "estimation";
export type Access = "none" | "read" | "write";

const ALL: Resource[] = [
  "clients", "suppliers", "subcontractors", "subcontracts", "projects", "tasks", "markets", "situations", "ods",
  "quotes", "invoices", "employees", "attendance", "payslips", "materials", "stockMovements", "equipment",
  "expenses", "dailyReports", "users", "settings", "backup", "reports", "estimation",
];

function build(defaultAccess: Access, overrides: Partial<Record<Resource, Access>>): Record<Resource, Access> {
  return Object.fromEntries(ALL.map((r) => [r, overrides[r] ?? defaultAccess])) as Record<Resource, Access>;
}

export const PERMISSIONS: Record<Role, Record<Resource, Access>> = {
  admin: build("write", {}),
  manager: build("write", { users: "none", backup: "none", settings: "read" }),
  accountant: build("read", {
    clients: "write",
    suppliers: "write",
    subcontractors: "write",
    subcontracts: "write",
    quotes: "write",
    invoices: "write",
    situations: "write",
    expenses: "write",
    payslips: "write",
    attendance: "read",
    estimation: "write",
    users: "none",
    backup: "none",
  }),
  site_manager: build("read", {
    tasks: "write",
    attendance: "write",
    dailyReports: "write",
    stockMovements: "write",
    expenses: "write",
    equipment: "write",
    estimation: "write",
    quotes: "none",
    invoices: "none",
    payslips: "none",
    users: "none",
    backup: "none",
  }),
  viewer: build("read", { users: "none", payslips: "none", backup: "none" }),
};

export function can(role: string | undefined, resource: Resource, mode: "read" | "write"): boolean {
  const access = PERMISSIONS[role as Role]?.[resource] ?? "none";
  return mode === "read" ? access !== "none" : access === "write";
}
