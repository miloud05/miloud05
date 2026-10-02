"use client";

import { Printer, Wallet } from "lucide-react";
import { CrudPage } from "@/components/crud/CrudPage";
import { Badge, ButtonLink, StatCard } from "@/components/ui";
import { useApp } from "@/components/providers/AppProvider";
import { useLookup } from "@/lib/client/lookup";
import { round2, todayIso } from "@/lib/calc/money";

export default function ExpensesPage() {
  const { t, money, date, enumLabel } = useApp();
  const projects = useLookup("projects");
  const suppliers = useLookup("suppliers");
  const month = todayIso().slice(0, 7);

  return (
    <CrudPage
      collection="expenses"
      title="expenses.title"
      subtitle="expenses.subtitle"
      newLabel="expenses.new"
      emptyIcon={<Wallet className="size-6" />}
      defaultSort={{ key: "date", dir: "desc" }}
      defaults={() => ({ date: todayIso(), category: "materials", paymentMode: "cash" })}
      headerActions={
        <ButtonLink href="/print/expenses/all" target="_blank" variant="secondary" icon={<Printer className="size-4" />}>
          <span className="hidden md:inline">{t("reports.expensesReport")}</span>
        </ButtonLink>
      }
      searchText={(r) => `${r.description} ${r.reference} ${projects.label(r.projectId)} ${suppliers.label(r.supplierId)}`}
      filters={[
        { name: "category", label: "fields.category", enumKey: "expenseCategory" },
        { name: "projectId", label: "fields.project", options: projects.data.map((p) => ({ value: p.id, label: p.name })) },
        {
          name: "month",
          label: "common.month",
          options: [...new Set([month, ...Array.from({ length: 11 }, (_, i) => {
            const d = new Date();
            d.setDate(1);
            d.setMonth(d.getMonth() - i - 1);
            return d.toISOString().slice(0, 7);
          })])].map((m) => ({ value: m, label: m })),
          match: (r, v) => r.date.startsWith(v),
        },
      ]}
      summary={(rows) => {
        const total = round2(rows.reduce((a, r) => a + r.amount, 0));
        const thisMonth = round2(rows.filter((r) => r.date.startsWith(month)).reduce((a, r) => a + r.amount, 0));
        const byCat = new Map<string, number>();
        rows.forEach((r) => byCat.set(r.category, (byCat.get(r.category) ?? 0) + r.amount));
        const top = [...byCat.entries()].sort((a, b) => b[1] - a[1])[0];
        return (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label={t("common.total")} value={money(total)} icon={<Wallet className="size-5" />} />
            <StatCard label={t("dashboard.expensesMonth")} value={money(thisMonth)} tone="warning" />
            <StatCard label={t("dashboard.expensesByCategory")} value={top ? enumLabel("expenseCategory", top[0]) : "—"} hint={top ? money(top[1]) : undefined} tone="info" />
          </div>
        );
      }}
      footer={(rows) => (
        <tr className="bg-surface-2 font-semibold">
          <td className="px-4 py-3" colSpan={4}>
            {t("common.total")}
          </td>
          <td className="num px-4 py-3 text-end">{money(rows.reduce((a, r) => a + r.amount, 0))}</td>
          <td colSpan={3} />
        </tr>
      )}
      columns={[
        { key: "date", label: "fields.date", render: (r) => <span className="num">{date(r.date)}</span> },
        { key: "description", label: "fields.description", render: (r) => <span className="font-medium">{r.description}</span> },
        { key: "category", label: "fields.category", render: (r) => <Badge>{enumLabel("expenseCategory", r.category)}</Badge> },
        { key: "projectId", label: "fields.project", render: (r) => projects.get(r.projectId)?.code ?? "—", sortValue: (r) => projects.label(r.projectId) },
        { key: "amount", label: "fields.amount", align: "end", render: (r) => <span className="num font-semibold">{money(r.amount)}</span> },
        { key: "supplierId", label: "fields.supplier", render: (r) => suppliers.get(r.supplierId)?.name ?? "—" },
        { key: "paymentMode", label: "fields.paymentMode", render: (r) => enumLabel("paymentMode", r.paymentMode) },
        { key: "reference", label: "fields.reference" },
      ]}
      fields={[
        { name: "description", label: "fields.description", required: true, full: true },
        { name: "date", label: "fields.date", type: "date", required: true },
        { name: "amount", label: "fields.amount", type: "number", required: true },
        { name: "category", label: "fields.category", type: "select", enumKey: "expenseCategory" },
        { name: "projectId", label: "fields.project", type: "ref", ref: "projects" },
        { name: "supplierId", label: "fields.supplier", type: "ref", ref: "suppliers" },
        { name: "paymentMode", label: "fields.paymentMode", type: "select", enumKey: "paymentMode" },
        { name: "reference", label: "fields.reference", ltr: true },
      ]}
    />
  );
}
