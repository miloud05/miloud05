"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, CalendarClock, Gauge, MapPin, Plus, Printer, RefreshCw, User, Wallet } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Badge, Button, ButtonLink, Card, EmptyState, PageHeader, ProgressBar, Skeleton, StatCard, Table, Tabs, Td, Th } from "@/components/ui";
import { StatusBadge } from "@/components/StatusBadge";
import { Gantt, weightedProgress } from "@/components/Gantt";
import { TaskDialog } from "@/components/TaskDialog";
import { useApp } from "@/components/providers/AppProvider";
import { useCollection } from "@/lib/client/api";
import { useLookup } from "@/lib/client/lookup";
import { daysBetween, round2, todayIso } from "@/lib/calc/money";
import { computeDqeTotals } from "@/lib/calc/market";
import { wilayaName } from "@/lib/wilayas";
import type { Task } from "@/lib/schemas";

const COLORS = ["#e8590c", "#2563eb", "#15803d", "#9333ea", "#0891b2", "#b45309", "#db2777", "#64748b"];

type Tab = "overview" | "gantt" | "budget" | "team" | "journal";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t, money, date, lang, can, enumLabel, toast, errorMessage, number } = useApp();
  const projects = useCollection("projects");
  const clients = useLookup("clients");
  const { data: allTasks } = useCollection("tasks");
  const { data: expenses } = useCollection("expenses", can("expenses"));
  const { data: employees } = useCollection("employees", can("employees"));
  const { data: equipment } = useCollection("equipment", can("equipment"));
  const { data: reports } = useCollection("dailyReports", can("dailyReports"));
  const { data: markets } = useCollection("markets", can("markets"));
  const [tab, setTab] = useState<Tab>("overview");
  const [taskDialog, setTaskDialog] = useState<{ task: Task | null } | null>(null);
  const [syncing, setSyncing] = useState(false);

  const project = projects.data.find((p) => p.id === id);
  const tasks = useMemo(
    () => allTasks.filter((tk) => tk.projectId === id).sort((a, b) => a.order - b.order || a.startDate.localeCompare(b.startDate)),
    [allTasks, id],
  );
  const projectExpenses = useMemo(() => expenses.filter((e) => e.projectId === id), [expenses, id]);
  const spent = round2(projectExpenses.reduce((a, e) => a + e.amount, 0));
  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    projectExpenses.forEach((e) => m.set(e.category, (m.get(e.category) ?? 0) + e.amount));
    return [...m.entries()].map(([category, amount]) => ({ category, amount: round2(amount) })).sort((a, b) => b.amount - a.amount);
  }, [projectExpenses]);

  if (!projects.ready) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (!project) return <EmptyState title={t("common.notFound")} action={<ButtonLink href="/projects" variant="secondary">{t("common.back")}</ButtonLink>} />;

  const today = todayIso();
  const remaining = project.endDate ? daysBetween(today, project.endDate) : null;
  const budgetUsed = project.budget > 0 ? (spent / project.budget) * 100 : 0;
  const team = employees.filter((e) => e.projectId === id && e.status === "active");
  const machines = equipment.filter((e) => e.projectId === id);
  const projectReports = reports.filter((r) => r.projectId === id).sort((a, b) => b.date.localeCompare(a.date));
  const projectMarkets = markets.filter((m) => m.projectId === id);

  async function syncProgress() {
    setSyncing(true);
    try {
      const progress = weightedProgress(tasks);
      await projects.update(id, { progress });
      toast(t("projects.progressSynced", { progress }));
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div>
      <PageHeader
        back={
          <Link href="/projects" className="no-print mb-2 inline-flex items-center gap-1 text-xs text-muted hover:text-primary">
            <ArrowLeft className="size-3.5 rtl:rotate-180" /> {t("projects.allProjects")}
          </Link>
        }
        title={
          <span className="flex flex-wrap items-center gap-3">
            {project.name} <StatusBadge enumKey="projectStatus" value={project.status} />
          </span>
        }
        subtitle={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="num font-mono">{project.code}</span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" />
              {project.commune ? `${project.commune}, ` : ""}
              {wilayaName(project.wilaya, lang)}
            </span>
            <span>{clients.label(project.clientId)}</span>
          </span>
        }
        actions={
          <ButtonLink href={`/print/project/${project.id}`} target="_blank" variant="secondary" icon={<Printer className="size-4" />}>
            {t("projects.printReport")}
          </ButtonLink>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t("fields.progress")} value={`${project.progress} %`} icon={<Gauge className="size-5" />} hint={t("projects.tasksCount", { count: tasks.length })} />
        <StatCard
          label={t("projects.budgetUsed")}
          value={`${number(budgetUsed, 1)} %`}
          tone={budgetUsed > project.progress + 10 ? "danger" : "success"}
          icon={<Wallet className="size-5" />}
          hint={can("expenses") ? t("projects.spentVsBudget", { spent: money(spent), budget: money(project.budget) }) : undefined}
        />
        <StatCard
          label={t("fields.endDate")}
          value={date(project.endDate)}
          tone={remaining !== null && remaining < 0 && project.status === "ongoing" ? "danger" : "info"}
          icon={<CalendarClock className="size-5" />}
          hint={
            remaining === null
              ? undefined
              : remaining >= 0
                ? t("projects.remainingDays", { days: remaining })
                : t("projects.overdueDays", { days: -remaining })
          }
        />
        <StatCard label={t("fields.manager")} value={project.manager || "—"} tone="neutral" icon={<User className="size-5" />} hint={t("projects.assignedEmployees") + ` : ${team.length}`} />
      </div>

      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "overview", label: t("projects.overview") },
          { id: "gantt", label: t("projects.gantt"), count: tasks.length },
          ...(can("expenses") ? [{ id: "budget" as Tab, label: t("projects.budgetTab"), count: projectExpenses.length }] : []),
          { id: "team", label: t("projects.team"), count: team.length + machines.length },
          { id: "journal", label: t("projects.reports"), count: projectReports.length },
        ]}
      />

      {tab === "overview" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card title={t("common.details")} className="lg:col-span-2">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
              {[
                [t("fields.client"), clients.label(project.clientId)],
                [t("fields.startDate"), date(project.startDate)],
                [t("fields.endDate"), date(project.endDate)],
                [t("fields.budget"), money(project.budget)],
                [t("fields.address"), project.address || "—"],
                [t("fields.manager"), project.manager || "—"],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-muted">{k}</dt>
                  <dd className="mt-0.5 font-medium">{v}</dd>
                </div>
              ))}
            </dl>
            {project.description && <p className="mt-5 border-t border-border pt-4 text-sm whitespace-pre-line text-muted">{project.description}</p>}
            <div className="mt-6">
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-muted">{t("fields.progress")}</span>
                <span className="num font-semibold">{project.progress} %</span>
              </div>
              <ProgressBar value={project.progress} />
            </div>
          </Card>
          <Card title={t("projects.markets")}>
            {projectMarkets.length === 0 ? (
              <p className="text-sm text-muted">{t("common.empty")}</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {projectMarkets.map((m) => (
                  <li key={m.id}>
                    <Link href={`/markets/${m.id}`} className="block rounded-xl border border-border p-3 hover:border-primary">
                      <p className="num font-mono text-xs text-muted">{m.reference}</p>
                      <p className="line-clamp-2 text-sm font-medium">{m.object}</p>
                      <p className="num mt-1 text-sm font-semibold text-primary">{money(computeDqeTotals(m.items, m.tvaRate, m.amendments).totalTTC)}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {tab === "gantt" && (
        <Card
          title={t("projects.gantt")}
          actions={
            can("tasks", "write") && (
              <>
                {can("projects", "write") && (
                  <Button size="sm" variant="secondary" icon={<RefreshCw className="size-4" />} loading={syncing} onClick={syncProgress} disabled={!tasks.length}>
                    {t("projects.syncProgress")}
                  </Button>
                )}
                <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setTaskDialog({ task: null })}>
                  {t("projects.addTask")}
                </Button>
              </>
            )
          }
        >
          {tasks.length === 0 ? (
            <EmptyState title={t("projects.noTasks")} />
          ) : (
            <Gantt rows={tasks.map((task) => ({ task }))} onSelect={(task) => setTaskDialog({ task })} />
          )}
        </Card>
      )}

      {tab === "budget" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card title={t("projects.expensesByCategory")}>
            {byCategory.length === 0 ? (
              <p className="text-sm text-muted">{t("common.empty")}</p>
            ) : (
              <>
                <div className="h-56">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={byCategory} dataKey="amount" nameKey="category" innerRadius={50} outerRadius={85} paddingAngle={2}>
                        {byCategory.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => money(Number(v))} labelFormatter={(l) => enumLabel("expenseCategory", String(l))} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="mt-2 flex flex-col gap-1.5 text-sm">
                  {byCategory.map((c, i) => (
                    <li key={c.category} className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <span className="size-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                        {enumLabel("expenseCategory", c.category)}
                      </span>
                      <span className="num font-medium">{money(c.amount)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>
          <Card title={t("nav.expenses")} padded={false} className="lg:col-span-2">
            <Table>
              <thead>
                <tr>
                  <Th>{t("fields.date")}</Th>
                  <Th>{t("fields.description")}</Th>
                  <Th>{t("fields.category")}</Th>
                  <Th align="end">{t("fields.amount")}</Th>
                </tr>
              </thead>
              <tbody>
                {projectExpenses
                  .slice()
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((e) => (
                    <tr key={e.id}>
                      <Td className="num">{date(e.date)}</Td>
                      <Td>{e.description}</Td>
                      <Td>
                        <Badge>{enumLabel("expenseCategory", e.category)}</Badge>
                      </Td>
                      <Td align="end" className="num font-medium">
                        {money(e.amount)}
                      </Td>
                    </tr>
                  ))}
              </tbody>
              <tfoot>
                <tr className="bg-surface-2 font-semibold">
                  <td className="px-4 py-3" colSpan={3}>
                    {t("common.total")}
                  </td>
                  <td className="num px-4 py-3 text-end">{money(spent)}</td>
                </tr>
              </tfoot>
            </Table>
          </Card>
        </div>
      )}

      {tab === "team" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card title={t("projects.assignedEmployees")} padded={false}>
            {team.length === 0 ? (
              <p className="p-5 text-sm text-muted">{t("common.empty")}</p>
            ) : (
              <Table>
                <tbody>
                  {team.map((e) => (
                    <tr key={e.id}>
                      <Td className="num font-mono text-xs">{e.matricule}</Td>
                      <Td className="font-medium">
                        {e.lastName} {e.firstName}
                      </Td>
                      <Td className="text-muted">{e.position}</Td>
                      <Td>{enumLabel("contractType", e.contractType)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
          <Card title={t("projects.assignedEquipment")} padded={false}>
            {machines.length === 0 ? (
              <p className="p-5 text-sm text-muted">{t("common.empty")}</p>
            ) : (
              <Table>
                <tbody>
                  {machines.map((e) => (
                    <tr key={e.id}>
                      <Td className="num font-mono text-xs">{e.code}</Td>
                      <Td className="font-medium">{e.name}</Td>
                      <Td>
                        <StatusBadge enumKey="equipmentStatus" value={e.status} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>
      )}

      {tab === "journal" && (
        <Card title={t("projects.reports")} actions={<ButtonLink href="/daily-reports" size="sm" variant="secondary">{t("nav.dailyReports")}</ButtonLink>}>
          {projectReports.length === 0 ? (
            <p className="text-sm text-muted">{t("common.empty")}</p>
          ) : (
            <ol className="relative flex flex-col gap-5 border-s-2 border-border ps-5">
              {projectReports.map((r) => (
                <li key={r.id} className="relative">
                  <span className="absolute -start-[27px] top-1 size-3 rounded-full border-2 border-surface bg-primary" />
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span className="num font-semibold text-text">{date(r.date)}</span>
                    <Badge>{enumLabel("weather", r.weather)}</Badge>
                    <span>
                      {t("fields.workforce")} : <span className="num">{r.workforce}</span>
                    </span>
                    <span>· {r.author}</span>
                  </div>
                  <p className="mt-1.5 text-sm whitespace-pre-line">{r.worksDone}</p>
                  {r.incidents && <p className="mt-1 rounded-lg bg-danger-soft px-3 py-1.5 text-xs text-danger">{r.incidents}</p>}
                </li>
              ))}
            </ol>
          )}
        </Card>
      )}

      {taskDialog && <TaskDialog task={taskDialog.task} projectId={id} onClose={() => setTaskDialog(null)} />}
    </div>
  );
}
