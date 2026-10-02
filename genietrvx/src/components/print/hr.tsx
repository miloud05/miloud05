"use client";

import { useApp } from "@/components/providers/AppProvider";
import { useCollection } from "@/lib/client/api";
import { useSettings } from "@/lib/client/settings";
import { addDays, round2 } from "@/lib/calc/money";
import { amountInWordsFr } from "@/lib/calc/words";
import type { Payslip } from "@/lib/schemas";
import { CompanyHeader, InfoGrid, PrintFooter, PrintPage, Signatures } from "./PrintShell";
import { GateView, NotFound, gate } from "./states";

function monthName(period: string, lang: string) {
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-DZ" : "fr-FR", { month: "long", year: "numeric", numberingSystem: "latn" }).format(
    new Date(`${period}-01T00:00:00`),
  );
}

export function PayslipDoc({ id }: { id: string }) {
  const { t, money, number, date, lang, enumLabel } = useApp();
  const { settings, ready } = useSettings();
  const slipsCol = useCollection("payslips");
  const empCol = useCollection("employees");
  const projCol = useCollection("projects");
  const state = gate(slipsCol, empCol, projCol, { ready, error: null });
  if (state !== "ready") return <GateView state={state} />;
  const p = slipsCol.data.find((x) => x.id === id);
  const e = p && empCol.data.find((x) => x.id === p.employeeId);
  if (!p || !e) return <NotFound />;
  const rates = settings.payroll;
  const project = projCol.data.find((x) => x.id === p.projectId);

  const gains: Array<[string, string, number]> = [
    [t("payroll.base"), e.salaryType === "daily" ? `${number(p.workedDays, 1)} j × ${money(e.dailyRate)}` : `${number(p.workedDays, 1)} j`, p.base],
    [t("payroll.iep"), `${e.iepRate} %`, p.iep],
    [t("payroll.bonus"), "", p.bonus],
    [t("payroll.overtime"), `${number(p.overtimeHours, 1)} h × ${100 + rates.overtimeRate} %`, p.overtime],
  ];

  return (
    <PrintPage>
      <CompanyHeader settings={settings} title={t("print.payslip")} meta={<p className="font-semibold capitalize">{monthName(p.period, lang)}</p>} />
      <div className="mb-4 grid grid-cols-2 gap-4 text-[11px]">
        <InfoGrid
          rows={[
            [t("fields.fullName"), `${e.lastName} ${e.firstName}`],
            [t("fields.matricule"), e.matricule],
            [t("fields.position"), e.position],
            [t("fields.contractType"), enumLabel("contractType", e.contractType)],
          ]}
        />
        <InfoGrid
          rows={[
            [t("fields.cnasNumber"), e.cnasNumber || "—"],
            [t("fields.nin"), e.nin || "—"],
            [t("fields.hireDate"), date(e.hireDate)],
            [t("fields.project"), project ? `${project.code}` : "—"],
          ]}
        />
      </div>
      <table className="mb-4">
        <thead>
          <tr>
            <th>{t("fields.designation")}</th>
            <th className="w-40">Base</th>
            <th className="w-32 text-end">Gains</th>
            <th className="w-32 text-end">Retenues</th>
          </tr>
        </thead>
        <tbody>
          {gains.map(([label, base, v]) => (
            <tr key={label}>
              <td>{label}</td>
              <td className="num">{base}</td>
              <td className="num text-end">{v ? money(v) : ""}</td>
              <td />
            </tr>
          ))}
          <tr className="bg-slate-50 font-semibold">
            <td>{t("payroll.gross")}</td>
            <td />
            <td className="num text-end">{money(p.gross)}</td>
            <td />
          </tr>
          <tr>
            <td>{t("payroll.cnasEmployee")}</td>
            <td className="num">{rates.cnasEmployeeRate} %</td>
            <td />
            <td className="num text-end">{money(p.cnasEmployee)}</td>
          </tr>
          {p.cacobatphWorker > 0 && (
            <tr>
              <td>{t("payroll.cacobatphWorker")}</td>
              <td className="num">{rates.cacobatphWorkerRate} %</td>
              <td />
              <td className="num text-end">{money(p.cacobatphWorker)}</td>
            </tr>
          )}
          <tr>
            <td>{t("payroll.indemnities")}</td>
            <td className="num">{number(p.workedDays, 1)} j</td>
            <td className="num text-end">{money(p.indemnities)}</td>
            <td />
          </tr>
          <tr className="bg-slate-50 font-semibold">
            <td>{t("payroll.taxable")}</td>
            <td />
            <td className="num text-end">{money(p.taxable)}</td>
            <td />
          </tr>
          <tr>
            <td>{t("payroll.irg")}</td>
            <td className="num">LF 2022</td>
            <td />
            <td className="num text-end">{money(p.irg)}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr className="bg-[#fff1e8] text-sm font-bold">
            <td colSpan={2}>{t("payroll.net")}</td>
            <td colSpan={2} className="num text-end">
              {money(p.net)}
            </td>
          </tr>
        </tfoot>
      </table>
      <p className="text-[11px]">
        Net à payer en lettres : <strong>{amountInWordsFr(p.net)}</strong>.
      </p>
      <table className="mt-4 text-[10px]">
        <tbody>
          <tr>
            <td>{t("payroll.cnasEmployer")} ({rates.cnasEmployerRate} %)</td>
            <td className="num text-end">{money(p.cnasEmployer)}</td>
            <td>{t("payroll.cacobatphEmployer")} ({rates.cacobatphEmployerRate} %)</td>
            <td className="num text-end">{money(p.cacobatphEmployer)}</td>
            <td>{t("payroll.employerCost")}</td>
            <td className="num text-end font-semibold">{money(p.employerCost)}</td>
          </tr>
        </tbody>
      </table>
      <Signatures left={t("print.employerSignature")} right={t("print.employeeSignature")} />
      <PrintFooter settings={settings} />
    </PrintPage>
  );
}

export function PayrollLedger({ period, projectId }: { period: string; projectId: string }) {
  const { t, money, number, lang } = useApp();
  const { settings, ready } = useSettings();
  const slipsCol = useCollection("payslips");
  const empCol = useCollection("employees");
  const state = gate(slipsCol, empCol, { ready, error: null });
  if (state !== "ready") return <GateView state={state} />;
  const name = (id: string) => {
    const e = empCol.data.find((x) => x.id === id);
    return e ? `${e.lastName} ${e.firstName}` : "—";
  };
  const rows = slipsCol.data
    .filter((s) => s.period === period && (!projectId || s.projectId === projectId))
    .sort((a, b) => name(a.employeeId).localeCompare(name(b.employeeId)));
  const sum = (k: keyof Payslip) => round2(rows.reduce((a, r) => a + (Number(r[k]) || 0), 0));
  const cols: Array<[string, keyof Payslip]> = [
    [t("payroll.base"), "base"],
    [t("payroll.overtime"), "overtime"],
    [t("payroll.gross"), "gross"],
    [t("payroll.cnasEmployee"), "cnasEmployee"],
    [t("payroll.taxable"), "taxable"],
    [t("payroll.irg"), "irg"],
    [t("payroll.net"), "net"],
    [t("payroll.cnasEmployer"), "cnasEmployer"],
    [t("payroll.employerCost"), "employerCost"],
  ];
  return (
    <PrintPage landscape>
      <CompanyHeader settings={settings} title={t("payroll.ledger")} meta={<p className="font-semibold capitalize">{monthName(period, lang)}</p>} />
      <table className="text-[10px]">
        <thead>
          <tr>
            <th>{t("fields.matricule")}</th>
            <th>{t("fields.fullName")}</th>
            <th className="text-end">{t("payroll.workedDays")}</th>
            {cols.map(([label]) => (
              <th key={label} className="text-end">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="num">{empCol.data.find((x) => x.id === r.employeeId)?.matricule}</td>
              <td>{name(r.employeeId)}</td>
              <td className="num text-end">{number(r.workedDays, 1)}</td>
              {cols.map(([label, k]) => (
                <td key={label} className="num text-end">
                  {money(Number(r[k]))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-bold">
            <td colSpan={3}>
              {t("common.total")} ({rows.length})
            </td>
            {cols.map(([label, k]) => (
              <td key={label} className="num text-end">
                {money(sum(k))}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
      <PrintFooter settings={settings} />
    </PrintPage>
  );
}

const CODES: Record<string, string> = { present: "P", half: "½", absent: "A", leave: "C", weather: "I", sick: "M" };

export function AttendanceSheet({ period, projectId }: { period: string; projectId: string }) {
  const { t, lang, enumLabel } = useApp();
  const { settings, ready } = useSettings();
  const attCol = useCollection("attendance");
  const empCol = useCollection("employees");
  const projCol = useCollection("projects");
  const state = gate(attCol, empCol, projCol, { ready, error: null });
  if (state !== "ready") return <GateView state={state} />;
  const start = `${period}-01`;
  const days: string[] = [];
  for (let d = start; d.startsWith(period); d = addDays(d, 1)) days.push(d);
  const records = attCol.data.filter((a) => a.date.startsWith(period));
  const staff = empCol.data
    .filter((e) => (!projectId || e.projectId === projectId) && (e.status === "active" || records.some((r) => r.employeeId === e.id)))
    .sort((a, b) => a.lastName.localeCompare(b.lastName));
  const project = projCol.data.find((p) => p.id === projectId);

  return (
    <PrintPage landscape>
      <CompanyHeader
        settings={settings}
        title={t("attendance.printSheet")}
        meta={
          <>
            <p className="font-semibold capitalize">{monthName(period, lang)}</p>
            {project && <p>{project.code} — {project.name}</p>}
          </>
        }
      />
      <table className="text-[9px]">
        <thead>
          <tr>
            <th>{t("fields.fullName")}</th>
            {days.map((d) => {
              const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
              return (
                <th key={d} className={`!px-0.5 text-center ${dow === 5 || dow === 6 ? "!bg-slate-300" : ""}`}>
                  {Number(d.slice(8))}
                </th>
              );
            })}
            <th className="text-center">P</th>
            <th className="text-center">A</th>
            <th className="text-center">HS</th>
          </tr>
        </thead>
        <tbody>
          {staff.map((e) => {
            const mine = records.filter((r) => r.employeeId === e.id);
            return (
              <tr key={e.id}>
                <td className="whitespace-nowrap">
                  {e.lastName} {e.firstName}
                </td>
                {days.map((d) => {
                  const r = mine.find((x) => x.date === d);
                  return (
                    <td key={d} className="!px-0.5 text-center">
                      {r ? CODES[r.status] : ""}
                    </td>
                  );
                })}
                <td className="num text-center font-semibold">{mine.filter((r) => r.status === "present").length + mine.filter((r) => r.status === "half").length / 2}</td>
                <td className="num text-center">{mine.filter((r) => r.status === "absent" || r.status === "sick").length}</td>
                <td className="num text-center">{mine.reduce((a, r) => a + r.overtimeHours, 0)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-3 text-[10px] text-slate-500">
        {Object.entries(CODES)
          .map(([k, c]) => `${c} = ${enumLabel("attendanceStatus", k)}`)
          .join(" · ")}{" "}
        · HS = {t("fields.overtimeHours")}
      </p>
      <Signatures left={t("nav.attendance")} right={t("print.employerSignature")} />
      <PrintFooter settings={settings} />
    </PrintPage>
  );
}

export function EmployeesList() {
  const { t, money, date, enumLabel } = useApp();
  const { settings, ready } = useSettings();
  const empCol = useCollection("employees");
  const projCol = useCollection("projects");
  const state = gate(empCol, projCol, { ready, error: null });
  if (state !== "ready") return <GateView state={state} />;
  const rows = empCol.data.filter((e) => e.status === "active").sort((a, b) => a.matricule.localeCompare(b.matricule));
  return (
    <PrintPage landscape>
      <CompanyHeader settings={settings} title={t("employees.printList")} meta={<p>{rows.length} {t("nav.employees").toLowerCase()}</p>} />
      <table>
        <thead>
          <tr>
            <th>{t("fields.matricule")}</th>
            <th>{t("fields.fullName")}</th>
            <th>{t("fields.position")}</th>
            <th>{t("fields.contractType")}</th>
            <th>{t("fields.hireDate")}</th>
            <th>{t("fields.cnasNumber")}</th>
            <th>{t("fields.project")}</th>
            <th className="text-end">{t("fields.salary")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.id}>
              <td className="num">{e.matricule}</td>
              <td>
                {e.lastName} {e.firstName}
              </td>
              <td>{e.position}</td>
              <td>{enumLabel("contractType", e.contractType)}</td>
              <td className="num">{date(e.hireDate)}</td>
              <td className="num">{e.cnasNumber}</td>
              <td>{projCol.data.find((p) => p.id === e.projectId)?.code ?? "—"}</td>
              <td className="num text-end">{e.salaryType === "daily" ? `${money(e.dailyRate)} / j` : money(e.baseSalary)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <PrintFooter settings={settings} />
    </PrintPage>
  );
}
