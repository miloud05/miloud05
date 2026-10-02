"use client";

import { useMemo, useState } from "react";
import { ChartGantt, Plus } from "lucide-react";
import { Button, Card, EmptyState, PageHeader, Select, Skeleton } from "@/components/ui";
import { Gantt } from "@/components/Gantt";
import { TaskDialog } from "@/components/TaskDialog";
import { useApp } from "@/components/providers/AppProvider";
import { useCollection } from "@/lib/client/api";
import type { Task } from "@/lib/schemas";

export default function PlanningPage() {
  const { t, can } = useApp();
  const { data: tasks, ready } = useCollection("tasks");
  const { data: projects } = useCollection("projects");
  const [projectId, setProjectId] = useState("");
  const [dialog, setDialog] = useState<{ task: Task | null } | null>(null);

  const rows = useMemo(() => {
    const code = new Map(projects.map((p) => [p.id, p.code || p.name]));
    const order = new Map(projects.map((p, i) => [p.id, i]));
    return tasks
      .filter((tk) => !projectId || tk.projectId === projectId)
      .sort((a, b) => (order.get(a.projectId) ?? 0) - (order.get(b.projectId) ?? 0) || a.order - b.order || a.startDate.localeCompare(b.startDate))
      .map((task) => ({ task, group: code.get(task.projectId) }));
  }, [tasks, projects, projectId]);

  return (
    <div>
      <PageHeader
        title={t("nav.planning")}
        subtitle={t("projects.subtitle")}
        actions={
          <>
            <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-64" aria-label={t("fields.project")}>
              <option value="">{t("projects.allProjects")}</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </Select>
            {can("tasks", "write") && (
              <Button icon={<Plus className="size-4" />} onClick={() => setDialog({ task: null })}>
                {t("projects.addTask")}
              </Button>
            )}
          </>
        }
      />
      <Card>
        {!ready ? (
          <Skeleton className="h-80" />
        ) : rows.length === 0 ? (
          <EmptyState icon={<ChartGantt className="size-6" />} title={t("projects.noTasks")} />
        ) : (
          <Gantt rows={rows} onSelect={(task) => setDialog({ task })} initialZoom={projectId ? "week" : "month"} />
        )}
      </Card>
      {dialog && <TaskDialog task={dialog.task} projectId={projectId} showProject onClose={() => setDialog(null)} />}
    </div>
  );
}
