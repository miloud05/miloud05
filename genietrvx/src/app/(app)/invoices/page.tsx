"use client";

import { useRouter } from "next/navigation";
import { Printer, Receipt } from "lucide-react";
import { CrudPage } from "@/components/crud/CrudPage";
import { StatusBadge } from "@/components/StatusBadge";
import { StatCard } from "@/components/ui";
import { useApp } from "@/components/providers/AppProvider";
import { useLookup } from "@/lib/client/lookup";
import { useSettings } from "@/lib/client/settings";
import { invoiceFigures } from "@/lib/calc/documents";
import { addDays, round2, todayIso } from "@/lib/calc/money";
import type { Invoice } from "@/lib/schemas";

export default function InvoicesPage() {
  const { t, money, date } = useApp();
  const router = useRouter();
  const clients = useLookup("clients");
  const projects = useLookup("projects");
  const { settings } = useSettings();
  const today = todayIso();
  const fig = (r: Invoice) => invoiceFigures(r, settings.invoicing);

  return (
    <CrudPage
      collection="invoices"
      title="invoices.title"
      subtitle="invoices.subtitle"
      newLabel="invoices.new"
      emptyIcon={<Receipt className="size-6" />}
      defaultSort={{ key: "number", dir: "desc" }}
      defaults={() => ({
        date: today,
        dueDate: addDays(today, settings.invoicing.paymentTermsDays),
        tvaRate: settings.invoicing.tvaRate,
        status: "issued",
        paymentMode: "transfer",
        lines: [],
        payments: [],
      })}
      rowHref={(r) => `/invoices/${r.id}`}
      afterCreate={(doc) => router.push(`/invoices/${doc.id}`)}
      searchText={(r) => `${r.number} ${clients.label(r.clientId)} ${projects.label(r.projectId)}`}
      filters={[
        { name: "status", label: "fields.status", enumKey: "invoiceStatus" },
        {
          name: "payment",
          label: "invoices.paymentStatus",
          options: (["unpaid", "partial", "paid"] as const).map((s) => ({ value: s, label: t(`enums.paymentStatus.${s}`) })),
          match: (r, v) => fig(r).balance.status === v,
        },
        { name: "clientId", label: "fields.client", options: clients.data.map((c) => ({ value: c.id, label: c.name })) },
      ]}
      summary={(rows) => {
        const valid = rows.filter((r) => r.status === "issued");
        const total = round2(valid.reduce((a, r) => a + fig(r).totals.totalDue, 0));
        const paid = round2(valid.reduce((a, r) => a + fig(r).balance.paid, 0));
        const overdue = valid.filter((r) => fig(r).balance.remaining > 0 && r.dueDate && r.dueDate < today);
        return (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label={t("dashboard.invoiced")} value={money(total)} icon={<Receipt className="size-5" />} />
            <StatCard label={t("dashboard.collected")} value={money(paid)} tone="success" />
            <StatCard label={t("dashboard.outstanding")} value={money(total - paid)} tone="warning" />
            <StatCard
              label={t("dashboard.overdue", { count: overdue.length })}
              value={money(round2(overdue.reduce((a, r) => a + fig(r).balance.remaining, 0)))}
              tone={overdue.length ? "danger" : "neutral"}
            />
          </div>
        );
      }}
      columns={[
        { key: "number", label: "fields.number", render: (r) => <span className="num font-mono text-xs font-semibold">{r.number}</span> },
        { key: "clientId", label: "fields.client", render: (r) => clients.label(r.clientId), sortValue: (r) => clients.label(r.clientId) },
        { key: "projectId", label: "fields.project", render: (r) => projects.get(r.projectId)?.code ?? "—" },
        { key: "date", label: "fields.date", render: (r) => <span className="num">{date(r.date)}</span> },
        {
          key: "dueDate",
          label: "fields.dueDate",
          render: (r) => (
            <span className={`num ${fig(r).balance.remaining > 0 && r.dueDate && r.dueDate < today && r.status === "issued" ? "font-semibold text-danger" : ""}`}>
              {date(r.dueDate)}
            </span>
          ),
        },
        { key: "total", label: "invoices.totalDue", align: "end", sortValue: (r) => fig(r).totals.totalDue, render: (r) => <span className="num font-semibold">{money(fig(r).totals.totalDue)}</span> },
        { key: "remaining", label: "fields.remaining", align: "end", sortValue: (r) => fig(r).balance.remaining, render: (r) => <span className="num">{money(fig(r).balance.remaining)}</span> },
        {
          key: "status",
          label: "invoices.paymentStatus",
          render: (r) => (r.status === "issued" ? <StatusBadge enumKey="paymentStatus" value={fig(r).balance.status} /> : <StatusBadge enumKey="invoiceStatus" value={r.status} />),
        },
      ]}
      rowActions={(r) => (
        <a href={`/print/invoice/${r.id}`} target="_blank" className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-text" title={t("common.print")}>
          <Printer className="size-4" />
        </a>
      )}
      fields={[
        { name: "clientId", label: "fields.client", type: "ref", ref: "clients", full: true },
        { name: "projectId", label: "fields.project", type: "ref", ref: "projects", full: true },
        { name: "date", label: "fields.date", type: "date", required: true },
        { name: "dueDate", label: "fields.dueDate", type: "date" },
        { name: "paymentMode", label: "fields.paymentMode", type: "select", enumKey: "paymentMode" },
        { name: "status", label: "fields.status", type: "select", enumKey: "invoiceStatus" },
      ]}
    />
  );
}
