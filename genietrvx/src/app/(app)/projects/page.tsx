"use client";

import { useRouter } from "next/navigation";
import { HardHat, TriangleAlert } from "lucide-react";
import { CrudPage } from "@/components/crud/CrudPage";
import { StatusBadge } from "@/components/StatusBadge";
import { ProgressBar, StatCard } from "@/components/ui";
import { useApp } from "@/components/providers/AppProvider";
import { useLookup } from "@/lib/client/lookup";
import { useCollection } from "@/lib/client/api";
import { round2, todayIso } from "@/lib/calc/money";
import { wilayaName } from "@/lib/wilayas";

export default function ProjectsPage() {
  const { t, money, date, lang, can } = useApp();
  const router = useRouter();
  const clients = useLookup("clients");
  const { data: expenses } = useCollection("expenses", can("expenses"));
  const today = todayIso();
  const spent = (id: string) => round2(expenses.filter((e) => e.projectId === id).reduce((a, e) => a + e.amount, 0));

  return (
    <CrudPage
      collection="projects"
      title="projects.title"
      subtitle="projects.subtitle"
      newLabel="projects.new"
      modalSize="lg"
      emptyIcon={<HardHat className="size-6" />}
      defaultSort={{ key: "code", dir: "desc" }}
      defaults={() => ({ status: "ongoing", wilaya: 16, startDate: today, progress: 0 })}
      rowHref={(r) => `/projects/${r.id}`}
      afterCreate={(doc) => router.push(`/projects/${doc.id}`)}
      searchText={(r) => `${r.code} ${r.name} ${r.commune} ${clients.label(r.clientId)} ${r.manager}`}
      filters={[
        { name: "status", label: "fields.status", enumKey: "projectStatus" },
        { name: "clientId", label: "fields.client", options: clients.data.map((c) => ({ value: c.id, label: c.name })) },
      ]}
      summary={(rows) => {
        const ongoing = rows.filter((r) => r.status === "ongoing");
        const late = ongoing.filter((r) => r.endDate && r.endDate < today).length;
        return (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label={t("dashboard.activeProjects")} value={ongoing.length} icon={<HardHat className="size-5" />} />
            <StatCard label={t("dashboard.avgProgress")} value={`${ongoing.length ? Math.round(ongoing.reduce((a, r) => a + r.progress, 0) / ongoing.length) : 0} %`} tone="info" />
            <StatCard label={t("dashboard.budget")} value={money(ongoing.reduce((a, r) => a + r.budget, 0))} tone="success" />
            <StatCard label={t("dashboard.lateProjects", { count: late })} value={late} tone={late ? "danger" : "neutral"} icon={<TriangleAlert className="size-5" />} />
          </div>
        );
      }}
      columns={[
        { key: "code", label: "fields.code", render: (r) => <span className="num font-mono text-xs">{r.code}</span> },
        {
          key: "name",
          label: "fields.project",
          className: "min-w-64",
          render: (r) => (
            <div>
              <p className="font-medium text-text">{r.name}</p>
              <p className="text-xs text-muted">
                {clients.label(r.clientId)} · {r.commune ? `${r.commune}, ` : ""}
                {wilayaName(r.wilaya, lang)}
              </p>
            </div>
          ),
        },
        {
          key: "progress",
          label: "fields.progress",
          render: (r) => (
            <div className="min-w-28">
              <span className="num text-xs font-semibold">{r.progress} %</span>
              <ProgressBar value={r.progress} className="mt-1" tone={r.progress >= 100 ? "success" : "primary"} />
            </div>
          ),
        },
        {
          key: "budget",
          label: "fields.budget",
          align: "end",
          render: (r) => (
            <div>
              <p className="num">{money(r.budget)}</p>
              {can("expenses") && <p className="num text-xs text-muted">{t("dashboard.spent")} : {money(spent(r.id))}</p>}
            </div>
          ),
        },
        {
          key: "endDate",
          label: "fields.endDate",
          render: (r) => (
            <span className={`num ${r.status === "ongoing" && r.endDate && r.endDate < today ? "font-semibold text-danger" : ""}`}>{date(r.endDate)}</span>
          ),
        },
        { key: "status", label: "fields.status", render: (r) => <StatusBadge enumKey="projectStatus" value={r.status} /> },
      ]}
      fields={[
        { name: "name", label: "fields.name", required: true, full: true },
        { name: "code", label: "fields.code", ltr: true, hint: "common.optional" },
        { name: "clientId", label: "fields.client", type: "ref", ref: "clients" },
        { name: "wilaya", label: "fields.wilaya", type: "wilaya" },
        { name: "commune", label: "fields.commune" },
        { name: "address", label: "fields.address", full: true },
        { name: "startDate", label: "fields.startDate", type: "date" },
        { name: "endDate", label: "fields.endDate", type: "date" },
        { name: "budget", label: "fields.budget", type: "number" },
        { name: "manager", label: "fields.manager" },
        { name: "status", label: "fields.status", type: "select", enumKey: "projectStatus" },
        { name: "progress", label: "fields.progress", type: "number", min: 0, max: 100 },
        { name: "description", label: "fields.description", type: "textarea" },
      ]}
    />
  );
}
