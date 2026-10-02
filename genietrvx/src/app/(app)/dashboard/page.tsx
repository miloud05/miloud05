"use client";

import Link from "next/link";
import { useEffect } from "react";
import {
  Activity,
  Banknote,
  CircleAlert,
  CircleCheck,
  HardHat,
  Landmark,
  Package,
  Receipt,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import { Area, AreaChart, Bar, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge, Card, PageHeader, ProgressBar, Skeleton, StatCard } from "@/components/ui";
import { useApp } from "@/components/providers/AppProvider";
import { useApi } from "@/lib/client/api";
import { todayIso } from "@/lib/calc/money";
import { wilayaName } from "@/lib/wilayas";

interface Stats {
  projects: {
    total: number;
    active: number;
    completed: number;
    late: number;
    avgProgress: number;
    budget: number;
    list: Array<{ id: string; name: string; code: string; progress: number; budget: number; spent: number; endDate: string; wilaya: number }>;
  };
  finance?: { invoiced: number; collected: number; outstanding: number; overdueAmount: number; overdueCount: number };
  series: Array<{ month: string; revenue: number; collected: number; expenses: number }>;
  expenses?: { month: number; total: number; byCategory: Array<{ category: string; amount: number }> };
  markets?: { count: number; portfolio: number };
  workforce: { active: number; presentToday: number; recordedToday: number; payrollPeriod?: string | null; payrollMass?: number };
  stock?: { items: number; value: number; low: Array<{ id: string; name: string; stock: number; min: number; unit: string }> };
  equipment?: { total: number; inUse: number; available: number; down: number };
  alerts: Array<{ type: string; severity: "danger" | "warning" | "info"; label: string; date?: string; href: string }>;
  activity: Array<{ id: string; userName: string; action: string; collection: string; label: string; at: string }>;
}

const NAV_KEY: Record<string, string> = { tasks: "planning", situations: "markets", ods: "markets", payslips: "payroll" };

const COLORS = ["#e8590c", "#2563eb", "#15803d", "#9333ea", "#0891b2", "#b45309", "#db2777", "#64748b"];

function compact(v: number) {
  if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(1)} Md`;
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1)} M`;
  if (Math.abs(v) >= 1e3) return `${Math.round(v / 1e3)} k`;
  return String(Math.round(v));
}

export default function DashboardPage() {
  const { t, money, date, user, enumLabel, lang } = useApp();
  const { data, error, reload } = useApi<Stats>("/api/stats");
  useEffect(() => {
    void reload();
  }, [reload]);

  if (error) return <Card><p className="text-sm text-danger">{t("common.error")}</p></Card>;
  if (!data) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-12 w-96" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  const monthLabel = (m: string) =>
    new Intl.DateTimeFormat(lang === "ar" ? "ar-DZ" : "fr-FR", { month: "short", numberingSystem: "latn" }).format(new Date(`${m}-01T00:00:00`));
  const tooltipStyle = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--text)" };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("dashboard.welcome", { name: user?.name.split(" ")[0] ?? "" })} subtitle={t("dashboard.subtitle", { date: date(todayIso()) })} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          href="/projects"
          label={t("dashboard.activeProjects")}
          value={data.projects.active}
          icon={<HardHat className="size-5" />}
          hint={`${t("dashboard.avgProgress")} : ${data.projects.avgProgress} % · ${t("dashboard.lateProjects", { count: data.projects.late })}`}
        />
        {data.markets && (
          <StatCard href="/markets" label={t("dashboard.portfolio")} value={money(data.markets.portfolio)} tone="info" icon={<Landmark className="size-5" />} hint={t("dashboard.marketsCount", { count: data.markets.count })} />
        )}
        {data.finance && (
          <StatCard
            href="/invoices"
            label={t("dashboard.invoiced")}
            value={money(data.finance.invoiced)}
            tone="success"
            icon={<Receipt className="size-5" />}
            hint={`${t("dashboard.collected")} : ${money(data.finance.collected)}`}
          />
        )}
        {data.finance && (
          <StatCard
            href="/invoices"
            label={t("dashboard.outstanding")}
            value={money(data.finance.outstanding)}
            tone={data.finance.overdueCount ? "danger" : "warning"}
            icon={<Banknote className="size-5" />}
            hint={t("dashboard.overdue", { count: data.finance.overdueCount })}
          />
        )}
        {data.expenses && (
          <StatCard href="/expenses" label={t("dashboard.expensesMonth")} value={money(data.expenses.month)} tone="warning" icon={<Wallet className="size-5" />} hint={t("dashboard.expensesTotal", { amount: money(data.expenses.total) })} />
        )}
        <StatCard
          href="/attendance"
          label={t("dashboard.workforce")}
          value={data.workforce.active}
          tone="primary"
          icon={<Users className="size-5" />}
          hint={
            data.workforce.payrollMass !== undefined && data.workforce.payrollPeriod
              ? `${t("dashboard.payrollMass", { period: data.workforce.payrollPeriod })} : ${money(data.workforce.payrollMass)}`
              : t("dashboard.presentToday", { count: data.workforce.presentToday })
          }
        />
        {data.stock && (
          <StatCard
            href="/materials"
            label={t("dashboard.stockValue")}
            value={money(data.stock.value)}
            tone={data.stock.low.length ? "danger" : "success"}
            icon={<Package className="size-5" />}
            hint={t("dashboard.lowStock", { count: data.stock.low.length })}
          />
        )}
        {data.equipment && (
          <StatCard
            href="/equipment"
            label={t("dashboard.equipment")}
            value={data.equipment.total}
            tone="neutral"
            icon={<Truck className="size-5" />}
            hint={t("dashboard.equipmentDetail", { inUse: data.equipment.inUse, down: data.equipment.down })}
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card title={t("dashboard.revenueVsExpenses")} className="xl:col-span-2">
          <div className="h-80" dir="ltr">
            <ResponsiveContainer>
              <ComposedChart data={data.series} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={compact} tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} width={50} />
                <Tooltip formatter={(v) => money(Number(v))} labelFormatter={(l) => monthLabel(String(l))} contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="revenue" name={t("dashboard.revenue")} fill="#e8590c" radius={[6, 6, 0, 0]} maxBarSize={28} />
                <Bar dataKey="expenses" name={t("dashboard.expenses")} fill="#94a3b8" radius={[6, 6, 0, 0]} maxBarSize={28} />
                <Line dataKey="collected" name={t("dashboard.collected")} stroke="#15803d" strokeWidth={2.5} dot={false} type="monotone" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title={t("dashboard.expensesByCategory")}>
          {data.expenses && data.expenses.byCategory.length ? (
            <>
              <div className="h-52" dir="ltr">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={data.expenses.byCategory} dataKey="amount" nameKey="category" innerRadius={55} outerRadius={85} paddingAngle={2}>
                      {data.expenses.byCategory.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => money(Number(v))} labelFormatter={(l) => enumLabel("expenseCategory", String(l))} contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-3 flex flex-col gap-1.5 text-sm">
                {data.expenses.byCategory.slice(0, 6).map((c, i) => (
                  <li key={c.category} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <span className="size-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                      {enumLabel("expenseCategory", c.category)}
                    </span>
                    <span className="num text-muted">{money(c.amount)}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-muted">{t("common.empty")}</p>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card title={t("dashboard.projectsProgress")} className="xl:col-span-2" padded={false}>
          {data.projects.list.length === 0 ? (
            <p className="p-5 text-sm text-muted">{t("common.empty")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {data.projects.list.map((p) => {
                const used = p.budget ? (p.spent / p.budget) * 100 : 0;
                return (
                  <li key={p.id}>
                    <Link href={`/projects/${p.id}`} className="grid gap-3 px-5 py-4 hover:bg-surface-2 md:grid-cols-[1fr_220px]">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{p.name}</p>
                        <p className="text-xs text-muted">
                          <span className="num font-mono">{p.code}</span> · {wilayaName(p.wilaya, lang)} · {t("fields.endDate")} : <span className="num">{date(p.endDate)}</span>
                        </p>
                      </div>
                      <div className="flex flex-col gap-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted">{t("fields.progress")}</span>
                          <span className="num font-semibold">{p.progress} %</span>
                        </div>
                        <ProgressBar value={p.progress} />
                        <div className="flex justify-between">
                          <span className="text-muted">{t("projects.budgetUsed")}</span>
                          <span className={`num ${used > p.progress + 10 ? "text-danger" : "text-muted"}`}>{Math.round(used)} %</span>
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title={`${t("dashboard.alerts")} (${data.alerts.length})`} padded={false}>
          {data.alerts.length === 0 ? (
            <div className="flex items-center gap-3 p-5 text-sm text-success">
              <CircleCheck className="size-5" /> {t("dashboard.noAlerts")}
            </div>
          ) : (
            <ul className="scrollbar-thin max-h-[420px] divide-y divide-border overflow-y-auto">
              {data.alerts.map((a, i) => (
                <li key={i}>
                  <Link href={a.href} className="flex items-start gap-3 px-5 py-3 hover:bg-surface-2">
                    <CircleAlert className={`mt-0.5 size-4 shrink-0 ${a.severity === "danger" ? "text-danger" : "text-warning"}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold">{t(`dashboard.alertTypes.${a.type}`)}</p>
                      <p className="truncate text-sm text-muted">{a.label}</p>
                    </div>
                    {a.date && (
                      <Badge tone={a.severity === "danger" ? "danger" : "warning"}>
                        <span className="num">{date(a.date)}</span>
                      </Badge>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card title={t("dashboard.collected")} className="xl:col-span-2">
          <div className="h-56" dir="ltr">
            <ResponsiveContainer>
              <AreaChart data={data.series}>
                <defs>
                  <linearGradient id="gtxArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#15803d" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#15803d" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={compact} tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} width={50} />
                <Tooltip formatter={(v) => money(Number(v))} labelFormatter={(l) => monthLabel(String(l))} contentStyle={tooltipStyle} />
                <Area dataKey="collected" name={t("dashboard.collected")} stroke="#15803d" fill="url(#gtxArea)" strokeWidth={2} type="monotone" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title={t("dashboard.activity")} padded={false}>
          {data.activity.length === 0 ? (
            <p className="p-5 text-sm text-muted">{t("dashboard.noActivity")}</p>
          ) : (
            <ul className="scrollbar-thin max-h-72 divide-y divide-border overflow-y-auto">
              {data.activity.map((a) => (
                <li key={a.id} className="flex items-start gap-3 px-5 py-3 text-sm">
                  <Activity className="mt-0.5 size-4 shrink-0 text-muted" />
                  <div className="min-w-0">
                    <p className="truncate">
                      <span className="font-medium">{a.userName}</span> {t(`dashboard.actions.${a.action}`)}{" "}
                      {a.action !== "login" && <span className="text-muted">· {t(`nav.${NAV_KEY[a.collection] ?? a.collection}`)}</span>}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {a.label} · <span className="num">{new Date(a.at).toLocaleString(lang === "ar" ? "ar-DZ" : "fr-FR", { numberingSystem: "latn" })}</span>
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
