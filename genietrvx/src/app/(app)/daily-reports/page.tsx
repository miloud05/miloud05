"use client";

import { NotebookPen, Printer } from "lucide-react";
import { CrudPage } from "@/components/crud/CrudPage";
import { Badge } from "@/components/ui";
import { useApp } from "@/components/providers/AppProvider";
import { useLookup } from "@/lib/client/lookup";
import { todayIso } from "@/lib/calc/money";

export default function DailyReportsPage() {
  const { t, date, enumLabel, user } = useApp();
  const projects = useLookup("projects");

  return (
    <CrudPage
      collection="dailyReports"
      title="dailyReports.title"
      subtitle="dailyReports.subtitle"
      newLabel="dailyReports.new"
      modalSize="lg"
      emptyIcon={<NotebookPen className="size-6" />}
      defaultSort={{ key: "date", dir: "desc" }}
      defaults={() => ({ date: todayIso(), weather: "sunny", author: user?.name ?? "" })}
      searchText={(r) => `${r.worksDone} ${r.incidents} ${r.observations} ${projects.label(r.projectId)}`}
      filters={[{ name: "projectId", label: "fields.project", options: projects.data.map((p) => ({ value: p.id, label: p.name })) }]}
      columns={[
        { key: "date", label: "fields.date", render: (r) => <span className="num">{date(r.date)}</span> },
        { key: "projectId", label: "fields.project", render: (r) => projects.get(r.projectId)?.code ?? "—" },
        { key: "weather", label: "fields.weather", render: (r) => <Badge tone={r.weather === "rainy" ? "info" : "neutral"}>{enumLabel("weather", r.weather)}</Badge> },
        { key: "workforce", label: "fields.workforce", align: "center", render: (r) => <span className="num">{r.workforce}</span> },
        { key: "worksDone", label: "fields.worksDone", className: "max-w-md", render: (r) => <p className="line-clamp-2 text-sm">{r.worksDone}</p> },
        { key: "incidents", label: "fields.incidents", render: (r) => (r.incidents ? <Badge tone="danger">{r.incidents.slice(0, 40)}</Badge> : "—") },
        { key: "author", label: "fields.author" },
      ]}
      rowActions={(r) => (
        <a href={`/print/daily-report/${r.id}`} target="_blank" className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-text" title={t("common.print")}>
          <Printer className="size-4" />
        </a>
      )}
      fields={[
        { name: "date", label: "fields.date", type: "date", required: true },
        { name: "projectId", label: "fields.project", type: "ref", ref: "projects", required: true },
        { name: "weather", label: "fields.weather", type: "select", enumKey: "weather" },
        { name: "workforce", label: "fields.workforce", type: "number", step: "1" },
        { name: "equipmentCount", label: "fields.equipmentCount", type: "number", step: "1" },
        { name: "author", label: "fields.author" },
        { name: "worksDone", label: "fields.worksDone", type: "textarea", required: true },
        { name: "incidents", label: "fields.incidents", type: "textarea" },
        { name: "observations", label: "fields.observations", type: "textarea" },
      ]}
    />
  );
}
