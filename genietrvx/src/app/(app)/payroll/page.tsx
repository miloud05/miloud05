"use client";

import { useMemo, useState } from "react";
import { Banknote, CheckCheck, FileText, Printer, RefreshCw, Wallet } from "lucide-react";
import { Button, ButtonLink, Card, EmptyState, Input, PageHeader, Select, Skeleton, StatCard, Table, Td, Th } from "@/components/ui";
import { StatusBadge } from "@/components/StatusBadge";
import { useApp } from "@/components/providers/AppProvider";
import { api, invalidate, useCollection } from "@/lib/client/api";
import { useLookup } from "@/lib/client/lookup";
import { useSettings } from "@/lib/client/settings";
import { round2, todayIso } from "@/lib/calc/money";

export default function PayrollPage() {
  const { t, money, number, can, toast, errorMessage } = useApp();
  const payslips = useCollection("payslips");
  const employees = useLookup("employees");
  const { data: projects } = useCollection("projects");
  const { settings } = useSettings();
  const [period, setPeriod] = useState(todayIso().slice(0, 7));
  const [projectId, setProjectId] = useState("");
  const [busy, setBusy] = useState(false);
  const writable = can("payslips", "write");

  const rows = useMemo(
    () =>
      payslips.data
        .filter((p) => p.period === period && (!projectId || p.projectId === projectId))
        .sort((a, b) => employees.label(a.employeeId).localeCompare(employees.label(b.employeeId))),
    [payslips.data, period, projectId, employees],
  );

  const sum = (k: keyof (typeof rows)[number]) => round2(rows.reduce((a, r) => a + (Number(r[k]) || 0), 0));

  async function generate() {
    setBusy(true);
    try {
      const res = await api<{ created: number; updated: number; skipped: number }>("/api/payroll/generate", {
        method: "POST",
        body: { period, projectId },
      });
      invalidate("payslips");
      toast(t("payroll.generated", res));
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(status: "validated" | "paid") {
    setBusy(true);
    try {
      const targets = rows.filter((r) => (status === "validated" ? r.status === "draft" : r.status !== "paid"));
      for (const r of targets) await api(`/api/data/payslips/${r.id}`, { method: "PUT", body: { status } });
      invalidate("payslips");
      toast(t("common.saved"));
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={t("payroll.title")}
        subtitle={t("payroll.subtitle")}
        actions={
          <>
            <ButtonLink href={`/print/payroll/${period}${projectId ? `?project=${projectId}` : ""}`} target="_blank" variant="secondary" icon={<FileText className="size-4" />}>
              {t("payroll.ledger")}
            </ButtonLink>
            {writable && (
              <Button icon={<RefreshCw className="size-4" />} loading={busy} onClick={generate}>
                {t("payroll.generate")}
              </Button>
            )}
          </>
        }
      />

      <Card className="mb-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
            {t("payroll.period")}
            <Input type="month" value={period} onChange={(e) => e.target.value && setPeriod(e.target.value)} className="w-48" />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
            {t("fields.project")}
            <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="md:w-72">
              <option value="">{t("projects.allProjects")}</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </Select>
          </label>
          <p className="flex-1 text-xs text-muted md:text-end">{t("payroll.regenerateHint")}</p>
        </div>
      </Card>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t("payroll.gross")} value={money(sum("gross"))} icon={<Banknote className="size-5" />} hint={`${rows.length} ${t("nav.employees").toLowerCase()}`} />
        <StatCard label={`${t("payroll.cnas")} + ${t("payroll.irg")}`} value={money(sum("cnasEmployee") + sum("irg"))} tone="warning" hint={`IRG : ${money(sum("irg"))}`} />
        <StatCard label={t("payroll.net")} value={money(sum("net"))} tone="success" icon={<Wallet className="size-5" />} />
        <StatCard label={t("payroll.employerCost")} value={money(sum("employerCost"))} tone="info" hint={`CNAS ${settings.payroll.cnasEmployerRate} % : ${money(sum("cnasEmployer"))}`} />
      </div>

      <Card
        title={`${t("payroll.title")} — ${period}`}
        padded={false}
        actions={
          writable &&
          rows.length > 0 && (
            <>
              <Button size="sm" variant="secondary" icon={<CheckCheck className="size-4" />} onClick={() => setStatus("validated")} disabled={busy}>
                {t("payroll.validate")}
              </Button>
              <Button size="sm" variant="success" onClick={() => setStatus("paid")} disabled={busy}>
                {t("payroll.markPaid")}
              </Button>
            </>
          )
        }
      >
        {!payslips.ready ? (
          <div className="p-5">
            <Skeleton className="h-48" />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState icon={<Banknote className="size-6" />} title={t("payroll.noPayslips")} />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{t("fields.employee")}</Th>
                <Th align="center">{t("payroll.workedDays")}</Th>
                <Th align="end">{t("payroll.base")}</Th>
                <Th align="end">{t("payroll.overtime")}</Th>
                <Th align="end">{t("payroll.gross")}</Th>
                <Th align="end">{t("payroll.cnasEmployee")}</Th>
                <Th align="end">{t("payroll.irg")}</Th>
                <Th align="end">{t("payroll.net")}</Th>
                <Th>{t("fields.status")}</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-surface-2/60">
                  <Td>
                    <p className="font-medium">{employees.label(r.employeeId)}</p>
                    <p className="text-xs text-muted">{employees.get(r.employeeId)?.position}</p>
                  </Td>
                  <Td align="center" className="num">
                    {number(r.workedDays, 1)}
                  </Td>
                  <Td align="end" className="num">
                    {money(r.base)}
                  </Td>
                  <Td align="end" className="num text-muted">
                    {money(r.overtime)}
                  </Td>
                  <Td align="end" className="num font-medium">
                    {money(r.gross)}
                  </Td>
                  <Td align="end" className="num text-muted">
                    {money(r.cnasEmployee)}
                  </Td>
                  <Td align="end" className="num text-muted">
                    {money(r.irg)}
                  </Td>
                  <Td align="end" className="num font-semibold text-success">
                    {money(r.net)}
                  </Td>
                  <Td>
                    <StatusBadge enumKey="payslipStatus" value={r.status} />
                  </Td>
                  <Td align="end">
                    <a href={`/print/payslip/${r.id}`} target="_blank" className="inline-flex rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-text" title={t("payroll.payslip")}>
                      <Printer className="size-4" />
                    </a>
                  </Td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-surface-2 font-semibold">
                <td className="px-4 py-3">{t("payroll.totals")}</td>
                <td />
                <td className="num px-4 py-3 text-end">{money(sum("base"))}</td>
                <td className="num px-4 py-3 text-end">{money(sum("overtime"))}</td>
                <td className="num px-4 py-3 text-end">{money(sum("gross"))}</td>
                <td className="num px-4 py-3 text-end">{money(sum("cnasEmployee"))}</td>
                <td className="num px-4 py-3 text-end">{money(sum("irg"))}</td>
                <td className="num px-4 py-3 text-end text-success">{money(sum("net"))}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </Table>
        )}
      </Card>
    </div>
  );
}
