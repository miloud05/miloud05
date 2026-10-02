"use client";

import { UserCog } from "lucide-react";
import { CrudPage } from "@/components/crud/CrudPage";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge, Card, EmptyState } from "@/components/ui";
import { useApp } from "@/components/providers/AppProvider";
import { PERMISSIONS, type Role } from "@/lib/permissions";

const RESOURCES = ["projects", "markets", "invoices", "expenses", "employees", "payslips", "attendance", "materials", "equipment", "settings"] as const;

export default function UsersPage() {
  const { t, can, date, enumLabel } = useApp();
  if (!can("users")) return <EmptyState title={t("common.noAccess")} />;

  return (
    <div className="flex flex-col gap-8">
      <CrudPage
        collection="users"
        title="users.title"
        subtitle="users.subtitle"
        newLabel="users.new"
        emptyIcon={<UserCog className="size-6" />}
        defaults={() => ({ role: "viewer", active: true })}
        toForm={(r) => ({ name: r.name, email: r.email, role: r.role, active: r.active, password: "" })}
        filters={[{ name: "role", label: "fields.role", enumKey: "role" }]}
        columns={[
          { key: "name", label: "fields.name", render: (r) => <span className="font-medium">{r.name}</span> },
          { key: "email", label: "fields.email", render: (r) => <span dir="ltr">{r.email}</span> },
          { key: "role", label: "fields.role", render: (r) => <StatusBadge enumKey="role" value={r.role} /> },
          { key: "active", label: "fields.active", render: (r) => <Badge tone={r.active ? "success" : "neutral"}>{r.active ? t("common.yes") : t("common.no")}</Badge> },
          { key: "createdAt", label: "fields.createdAt", render: (r) => <span className="num">{date(r.createdAt)}</span> },
        ]}
        fields={[
          { name: "name", label: "fields.name", required: true },
          { name: "email", label: "fields.email", type: "email", required: true },
          { name: "role", label: "fields.role", type: "select", enumKey: "role" },
          { name: "password", label: "fields.password", type: "password", hint: "fields.passwordHint" },
          { name: "active", label: "fields.active", type: "checkbox" },
        ]}
      />

      <Card title={t("fields.role")} padded={false}>
        <div className="scrollbar-thin relative overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="border-b border-border bg-surface-2 px-4 py-2 text-start text-xs text-muted" />
                {(Object.keys(PERMISSIONS) as Role[]).map((r) => (
                  <th key={r} className="border-b border-border bg-surface-2 px-4 py-2 text-center text-xs text-muted">
                    {enumLabel("role", r)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RESOURCES.map((res) => (
                <tr key={res}>
                  <td className="border-b border-border px-4 py-2 font-medium">{t(`nav.${res === "payslips" ? "payroll" : res}`)}</td>
                  {(Object.keys(PERMISSIONS) as Role[]).map((r) => {
                    const a = PERMISSIONS[r][res];
                    return (
                      <td key={r} className="border-b border-border px-4 py-2 text-center">
                        <Badge tone={a === "write" ? "success" : a === "read" ? "info" : "neutral"}>
                          {a === "write" ? t("common.edit") : a === "read" ? t("common.view") : "—"}
                        </Badge>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
