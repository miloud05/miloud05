"use client";

import { useMemo, useState } from "react";
import { ExternalLink, FileText } from "lucide-react";
import { Card, Input, PageHeader, ProgressBar, Select, Table, Td, Th } from "@/components/ui";
import { useApp } from "@/components/providers/AppProvider";
import { useCollection } from "@/lib/client/api";
import { useSettings } from "@/lib/client/settings";
import { invoiceFigures } from "@/lib/calc/documents";
import { round2, todayIso } from "@/lib/calc/money";

function DocLink({ href, label, disabled }: { href: string; label: string; disabled?: boolean }) {
  return (
    <a
      href={disabled ? undefined : href}
      target="_blank"
      aria-disabled={disabled}
      className={`flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3 text-sm font-medium transition ${
        disabled ? "pointer-events-none opacity-40" : "hover:border-primary hover:text-primary"
      }`}
    >
      <span className="flex items-center gap-2">
        <FileText className="size-4" /> {label}
      </span>
      <ExternalLink className="size-4 text-muted" />
    </a>
  );
}

export default function ReportsPage() {
  const { t, money, can } = useApp();
  const { settings } = useSettings();
  const { data: projects } = useCollection("projects");
  const { data: clients } = useCollection("clients");
  const { data: invoices } = useCollection("invoices", can("invoices"));
  const { data: expenses } = useCollection("expenses", can("expenses"));
  const { data: payslips } = useCollection("payslips", can("payslips"));
  const [month, setMonth] = useState(todayIso().slice(0, 7));
  const [projectId, setProjectId] = useState("");
  const [clientId, setClientId] = useState("");

  const profitability = useMemo(
    () =>
      projects
        .map((p) => {
          const revenue = round2(
            invoices
              .filter((i) => i.projectId === p.id && i.status === "issued")
              .reduce((a, i) => a + invoiceFigures(i, settings.invoicing).totals.totalHT, 0),
          );
          const exp = round2(expenses.filter((e) => e.projectId === p.id).reduce((a, e) => a + e.amount, 0));
          const labor = round2(payslips.filter((s) => s.projectId === p.id).reduce((a, s) => a + s.employerCost, 0));
          const costs = round2(exp + labor);
          const margin = round2(revenue - costs);
          return { p, revenue, exp, labor, costs, margin, rate: revenue ? (margin / revenue) * 100 : 0 };
        })
        .sort((a, b) => b.revenue - a.revenue),
    [projects, invoices, expenses, payslips, settings.invoicing],
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("reports.title")} subtitle={t("reports.subtitle")} />

      <Card title={t("reports.documents")}>
        <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
            {t("common.month")}
            <Input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
            {t("fields.project")}
            <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">{t("reports.choose")}</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
            {t("fields.client")}
            <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">{t("reports.choose")}</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </label>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <DocLink href={`/print/project/${projectId}`} label={t("reports.projectReport")} disabled={!projectId} />
          {can("invoices") && <DocLink href={`/print/client/${clientId}`} label={t("reports.clientStatement")} disabled={!clientId} />}
          {can("invoices") && <DocLink href="/print/invoices/all" label={t("reports.invoicesJournal")} />}
          {can("markets") && <DocLink href="/print/markets/all" label={t("reports.marketsSummary")} />}
          {can("expenses") && <DocLink href={`/print/expenses/${month}${projectId ? `?project=${projectId}` : ""}`} label={`${t("reports.expensesReport")} — ${month}`} />}
          {can("payslips") && <DocLink href={`/print/payroll/${month}${projectId ? `?project=${projectId}` : ""}`} label={`${t("reports.payrollLedger")} — ${month}`} />}
          {can("attendance") && <DocLink href={`/print/attendance/${month}${projectId ? `?project=${projectId}` : ""}`} label={`${t("reports.attendanceSheet")} — ${month}`} />}
          {can("employees") && <DocLink href="/print/employees/all" label={t("reports.employeesList")} />}
          {can("materials") && <DocLink href="/print/stock/all" label={t("reports.stockReport")} />}
          {can("equipment") && <DocLink href="/print/equipment/all" label={t("reports.equipmentList")} />}
        </div>
      </Card>

      {can("invoices") && can("expenses") && (
        <Card title={t("reports.profitability")} padded={false}>
          <Table>
            <thead>
              <tr>
                <Th>{t("fields.project")}</Th>
                <Th align="end">{t("reports.revenue")}</Th>
                <Th align="end">{t("nav.expenses")}</Th>
                <Th align="end">{t("reports.labor")}</Th>
                <Th align="end">{t("reports.margin")}</Th>
                <Th>{t("reports.marginRate")}</Th>
              </tr>
            </thead>
            <tbody>
              {profitability.map(({ p, revenue, exp, labor, margin, rate }) => (
                <tr key={p.id}>
                  <Td>
                    <p className="font-medium">{p.name}</p>
                    <p className="num font-mono text-xs text-muted">{p.code}</p>
                  </Td>
                  <Td align="end" className="num">
                    {money(revenue)}
                  </Td>
                  <Td align="end" className="num text-muted">
                    {money(exp)}
                  </Td>
                  <Td align="end" className="num text-muted">
                    {money(labor)}
                  </Td>
                  <Td align="end" className={`num font-semibold ${margin < 0 ? "text-danger" : "text-success"}`}>
                    {money(margin)}
                  </Td>
                  <Td>
                    <div className="min-w-28">
                      <span className="num text-xs">{revenue ? `${Math.round(rate)} %` : "—"}</span>
                      <ProgressBar value={Math.max(0, rate)} tone={rate < 0 ? "danger" : rate < 10 ? "warning" : "success"} className="mt-1" />
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}
