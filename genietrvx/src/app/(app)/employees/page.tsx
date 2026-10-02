"use client";

import { Printer, Users } from "lucide-react";
import { CrudPage } from "@/components/crud/CrudPage";
import { StatusBadge } from "@/components/StatusBadge";
import { ButtonLink, StatCard } from "@/components/ui";
import { useApp } from "@/components/providers/AppProvider";
import { useLookup } from "@/lib/client/lookup";
import { todayIso } from "@/lib/calc/money";

export default function EmployeesPage() {
  const { t, money, enumLabel } = useApp();
  const projects = useLookup("projects");

  return (
    <CrudPage
      collection="employees"
      title="employees.title"
      subtitle="employees.subtitle"
      newLabel="employees.new"
      modalSize="lg"
      emptyIcon={<Users className="size-6" />}
      defaultSort={{ key: "matricule", dir: "asc" }}
      defaults={() => ({
        category: "worker",
        contractType: "cdd",
        salaryType: "monthly",
        status: "active",
        hireDate: todayIso(),
        wilaya: 16,
        panier: 200,
        transport: 150,
      })}
      headerActions={
        <ButtonLink href="/print/employees/all" target="_blank" variant="secondary" icon={<Printer className="size-4" />}>
          <span className="hidden md:inline">{t("employees.printList")}</span>
        </ButtonLink>
      }
      searchText={(r) => `${r.matricule} ${r.firstName} ${r.lastName} ${r.position} ${r.nin}`}
      filters={[
        { name: "status", label: "fields.status", enumKey: "activeStatus" },
        { name: "category", label: "fields.category", enumKey: "employeeCategory" },
        { name: "projectId", label: "fields.project", options: projects.data.map((p) => ({ value: p.id, label: p.name })) },
      ]}
      summary={(rows) => {
        const active = rows.filter((r) => r.status === "active");
        return (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label={t("dashboard.workforce")} value={active.length} icon={<Users className="size-5" />} />
            {(["worker", "technician", "supervisor"] as const).map((c) => (
              <StatCard key={c} tone="info" label={enumLabel("employeeCategory", c)} value={active.filter((r) => r.category === c).length} />
            ))}
          </div>
        );
      }}
      columns={[
        { key: "matricule", label: "fields.matricule", render: (r) => <span className="num font-mono text-xs">{r.matricule}</span> },
        {
          key: "lastName",
          label: "fields.fullName",
          render: (r) => (
            <div>
              <p className="font-medium">
                {r.lastName} {r.firstName}
              </p>
              <p className="text-xs text-muted">{r.position}</p>
            </div>
          ),
        },
        { key: "contractType", label: "fields.contractType", render: (r) => enumLabel("contractType", r.contractType) },
        {
          key: "salary",
          label: "fields.salary",
          align: "end",
          sortValue: (r) => (r.salaryType === "daily" ? r.dailyRate * 22 : r.baseSalary),
          render: (r) => (
            <span className="num">
              {r.salaryType === "daily" ? `${money(r.dailyRate)} / j` : money(r.baseSalary)}
            </span>
          ),
        },
        { key: "projectId", label: "fields.project", render: (r) => projects.get(r.projectId)?.code ?? "—" },
        { key: "phone", label: "fields.phone", render: (r) => <span className="num">{r.phone || "—"}</span> },
        { key: "status", label: "fields.status", render: (r) => <StatusBadge enumKey="activeStatus" value={r.status} /> },
      ]}
      fields={[
        { name: "lastName", label: "fields.lastName", required: true },
        { name: "firstName", label: "fields.firstName", required: true },
        { name: "matricule", label: "fields.matricule", ltr: true, hint: "common.optional" },
        { name: "position", label: "fields.position" },
        { name: "category", label: "fields.category", type: "select", enumKey: "employeeCategory" },
        { name: "contractType", label: "fields.contractType", type: "select", enumKey: "contractType" },
        { name: "salaryType", label: "fields.salaryType", type: "select", enumKey: "salaryType" },
        { name: "baseSalary", label: "fields.baseSalary", type: "number", showIf: (v) => v.salaryType !== "daily" },
        { name: "dailyRate", label: "fields.dailyRate", type: "number", showIf: (v) => v.salaryType === "daily" },
        { name: "iepRate", label: "fields.iepRate", type: "number", min: 0, max: 100 },
        { name: "bonus", label: "fields.bonus", type: "number" },
        { name: "panier", label: "fields.panier", type: "number" },
        { name: "transport", label: "fields.transport", type: "number" },
        { name: "projectId", label: "fields.project", type: "ref", ref: "projects" },
        { name: "hireDate", label: "fields.hireDate", type: "date" },
        { name: "birthDate", label: "fields.birthDate", type: "date" },
        { name: "nin", label: "fields.nin", ltr: true },
        { name: "cnasNumber", label: "fields.cnasNumber", ltr: true },
        { name: "phone", label: "fields.phone", type: "tel" },
        { name: "wilaya", label: "fields.wilaya", type: "wilaya" },
        { name: "status", label: "fields.status", type: "select", enumKey: "activeStatus" },
        { name: "address", label: "fields.address", full: true },
      ]}
    />
  );
}
