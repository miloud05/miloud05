"use client";

import { useApp } from "@/components/providers/AppProvider";
import { useCollection } from "@/lib/client/api";
import { useSettings } from "@/lib/client/settings";
import { daysBetween, round2, todayIso } from "@/lib/calc/money";
import { currentStock } from "@/lib/calc/stock";
import { wilayaName } from "@/lib/wilayas";
import { can } from "@/lib/permissions";
import { CompanyHeader, InfoGrid, PrintFooter, PrintPage, Signatures } from "./PrintShell";
import { GateView, NotFound, gate } from "./states";

export function ProjectReport({ id }: { id: string }) {
  const { t, money, date, lang, enumLabel, user } = useApp();
  const { settings, ready } = useSettings();
  const projCol = useCollection("projects");
  const clientsCol = useCollection("clients");
  const tasksCol = useCollection("tasks");
  const showExpenses = can(user?.role, "expenses", "read");
  const expCol = useCollection("expenses", showExpenses);
  const reportsCol = useCollection("dailyReports");
  const state = gate(projCol, clientsCol, tasksCol, reportsCol, showExpenses ? expCol : { ready: true, error: null }, { ready, error: null });
  if (state !== "ready") return <GateView state={state} />;
  const p = projCol.data.find((x) => x.id === id);
  if (!p) return <NotFound />;
  const tasks = tasksCol.data.filter((x) => x.projectId === id).sort((a, b) => a.order - b.order);
  const expenses = expCol.data.filter((x) => x.projectId === id);
  const spent = round2(expenses.reduce((a, e) => a + e.amount, 0));
  const byCat = new Map<string, number>();
  expenses.forEach((e) => byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount));
  const reports = reportsCol.data.filter((r) => r.projectId === id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  const remaining = p.endDate ? daysBetween(todayIso(), p.endDate) : null;

  return (
    <PrintPage>
      <CompanyHeader settings={settings} title={t("projects.printReport")} meta={<p className="num font-semibold">{p.code}</p>} />
      <h2 className="mb-3 text-base font-bold">{p.name}</h2>
      <div className="grid grid-cols-2 gap-4">
        <InfoGrid
          rows={[
            [t("fields.client"), clientsCol.data.find((c) => c.id === p.clientId)?.name ?? "—"],
            [t("fields.wilaya"), `${p.commune ? `${p.commune}, ` : ""}${wilayaName(p.wilaya, lang)}`],
            [t("fields.manager"), p.manager || "—"],
            [t("fields.status"), enumLabel("projectStatus", p.status)],
          ]}
        />
        <InfoGrid
          rows={[
            [t("fields.startDate"), date(p.startDate)],
            [t("fields.endDate"), `${date(p.endDate)}${remaining !== null && remaining < 0 && p.status === "ongoing" ? ` (${t("projects.overdueDays", { days: -remaining })})` : ""}`],
            [t("fields.progress"), `${p.progress} %`],
            [t("fields.budget"), money(p.budget)],
          ]}
        />
      </div>

      <h3 className="mt-4 mb-2 font-bold">{t("projects.gantt")}</h3>
      <table className="mb-4">
        <thead>
          <tr>
            <th>{t("fields.taskName")}</th>
            <th>{t("fields.startDate")}</th>
            <th>{t("fields.endDate")}</th>
            <th>{t("fields.responsible")}</th>
            <th className="w-40">{t("fields.progress")}</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((tk) => (
            <tr key={tk.id}>
              <td>{tk.name}</td>
              <td className="num">{date(tk.startDate)}</td>
              <td className="num">{date(tk.endDate)}</td>
              <td>{tk.responsible}</td>
              <td>
                <div className="flex items-center gap-2">
                  <div className="h-2 flex-1 rounded bg-slate-200">
                    <div className="h-2 rounded bg-[#e8590c]" style={{ width: `${tk.progress}%`, printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }} />
                  </div>
                  <span className="num w-8 text-end">{tk.progress}%</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showExpenses && (
        <>
          <h3 className="mb-2 font-bold">{t("projects.budgetTab")}</h3>
          <table className="mb-4">
            <tbody>
              {[...byCat.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([cat, amount]) => (
                  <tr key={cat}>
                    <td>{enumLabel("expenseCategory", cat)}</td>
                    <td className="num text-end">{money(amount)}</td>
                    <td className="num w-20 text-end">{spent ? Math.round((amount / spent) * 100) : 0} %</td>
                  </tr>
                ))}
              <tr className="font-bold">
                <td>{t("common.total")}</td>
                <td className="num text-end">{money(spent)}</td>
                <td className="num text-end">{p.budget ? Math.round((spent / p.budget) * 100) : 0} %</td>
              </tr>
            </tbody>
          </table>
        </>
      )}

      {reports.length > 0 && (
        <>
          <h3 className="mb-2 font-bold">{t("nav.dailyReports")}</h3>
          <table>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id}>
                  <td className="num w-24">{date(r.date)}</td>
                  <td className="w-24">{enumLabel("weather", r.weather)}</td>
                  <td className="num w-14 text-center">{r.workforce}</td>
                  <td>
                    {r.worksDone}
                    {r.incidents && <span className="block text-red-700">⚠ {r.incidents}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      <PrintFooter settings={settings} />
    </PrintPage>
  );
}

export function StockReport() {
  const { t, money, number, enumLabel } = useApp();
  const { settings, ready } = useSettings();
  const matCol = useCollection("materials");
  const movCol = useCollection("stockMovements");
  const state = gate(matCol, movCol, { ready, error: null });
  if (state !== "ready") return <GateView state={state} />;
  const rows = matCol.data
    .map((m) => ({ m, qty: currentStock(m, movCol.data) }))
    .sort((a, b) => a.m.code.localeCompare(b.m.code));
  const total = round2(rows.reduce((a, r) => a + Math.max(0, r.qty) * r.m.unitPrice, 0));
  return (
    <PrintPage>
      <CompanyHeader settings={settings} title={t("materials.printStock")} />
      <table>
        <thead>
          <tr>
            <th>{t("fields.code")}</th>
            <th>{t("fields.material")}</th>
            <th>{t("fields.category")}</th>
            <th className="text-end">{t("fields.stock")}</th>
            <th className="text-end">{t("fields.minStock")}</th>
            <th className="text-end">{t("fields.unitPrice")}</th>
            <th className="text-end">{t("fields.stockValue")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ m, qty }) => (
            <tr key={m.id} className={qty <= m.minStock ? "text-red-700" : ""}>
              <td className="num">{m.code}</td>
              <td>{m.name}</td>
              <td>{enumLabel("materialCategory", m.category)}</td>
              <td className="num text-end font-semibold">
                {number(qty)} {m.unit}
              </td>
              <td className="num text-end">{number(m.minStock)}</td>
              <td className="num text-end">{money(m.unitPrice)}</td>
              <td className="num text-end">{money(Math.max(0, qty) * m.unitPrice)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-bold">
            <td colSpan={6}>{t("dashboard.stockValue")}</td>
            <td className="num text-end">{money(total)}</td>
          </tr>
        </tfoot>
      </table>
      <Signatures left={t("fields.location")} right={t("print.companySignature")} />
      <PrintFooter settings={settings} />
    </PrintPage>
  );
}

export function EquipmentList() {
  const { t, money, date, enumLabel } = useApp();
  const { settings, ready } = useSettings();
  const eqCol = useCollection("equipment");
  const projCol = useCollection("projects");
  const state = gate(eqCol, projCol, { ready, error: null });
  if (state !== "ready") return <GateView state={state} />;
  const rows = [...eqCol.data].sort((a, b) => a.code.localeCompare(b.code));
  return (
    <PrintPage landscape>
      <CompanyHeader settings={settings} title={t("equipment.printList")} />
      <table>
        <thead>
          <tr>
            <th>{t("fields.code")}</th>
            <th>{t("fields.name")}</th>
            <th>{t("fields.brand")}</th>
            <th>{t("fields.plate")}</th>
            <th>{t("fields.ownership")}</th>
            <th>{t("fields.project")}</th>
            <th className="text-end">{t("fields.hoursCounter")}</th>
            <th>{t("fields.nextMaintenance")}</th>
            <th>{t("fields.insuranceExpiry")}</th>
            <th className="text-end">{t("fields.purchaseValue")}</th>
            <th>{t("fields.status")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.id}>
              <td className="num">{e.code}</td>
              <td>{e.name}</td>
              <td>{[e.brand, e.model].filter(Boolean).join(" ")}</td>
              <td className="num">{e.plate}</td>
              <td>{enumLabel("ownership", e.ownership)}</td>
              <td>{projCol.data.find((p) => p.id === e.projectId)?.code ?? "—"}</td>
              <td className="num text-end">{e.hoursCounter}</td>
              <td className="num">{date(e.nextMaintenance)}</td>
              <td className="num">{date(e.insuranceExpiry)}</td>
              <td className="num text-end">{e.purchaseValue ? money(e.purchaseValue) : "—"}</td>
              <td>{enumLabel("equipmentStatus", e.status)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <PrintFooter settings={settings} />
    </PrintPage>
  );
}

export function ExpensesReport({ period, projectId }: { period: string; projectId: string }) {
  const { t, money, date, enumLabel, lang } = useApp();
  const { settings, ready } = useSettings();
  const expCol = useCollection("expenses");
  const projCol = useCollection("projects");
  const state = gate(expCol, projCol, { ready, error: null });
  if (state !== "ready") return <GateView state={state} />;
  const rows = expCol.data
    .filter((e) => (period === "all" || e.date.startsWith(period)) && (!projectId || e.projectId === projectId))
    .sort((a, b) => a.date.localeCompare(b.date));
  const total = round2(rows.reduce((a, e) => a + e.amount, 0));
  const project = projCol.data.find((p) => p.id === projectId);
  const title =
    period === "all"
      ? t("reports.expensesReport")
      : `${t("reports.expensesReport")} — ${new Intl.DateTimeFormat(lang === "ar" ? "ar-DZ" : "fr-FR", { month: "long", year: "numeric", numberingSystem: "latn" }).format(new Date(`${period}-01T00:00:00`))}`;
  return (
    <PrintPage>
      <CompanyHeader settings={settings} title={title} meta={project && <p>{project.code} — {project.name}</p>} />
      <table>
        <thead>
          <tr>
            <th>{t("fields.date")}</th>
            <th>{t("fields.description")}</th>
            <th>{t("fields.category")}</th>
            <th>{t("fields.project")}</th>
            <th>{t("fields.reference")}</th>
            <th className="text-end">{t("fields.amount")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.id}>
              <td className="num">{date(e.date)}</td>
              <td>{e.description}</td>
              <td>{enumLabel("expenseCategory", e.category)}</td>
              <td>{projCol.data.find((p) => p.id === e.projectId)?.code ?? "—"}</td>
              <td className="num">{e.reference}</td>
              <td className="num text-end">{money(e.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-bold">
            <td colSpan={5}>
              {t("common.total")} ({rows.length})
            </td>
            <td className="num text-end">{money(total)}</td>
          </tr>
        </tfoot>
      </table>
      <PrintFooter settings={settings} />
    </PrintPage>
  );
}

export function DailyReportDoc({ id }: { id: string }) {
  const { t, date, enumLabel } = useApp();
  const { settings, ready } = useSettings();
  const repCol = useCollection("dailyReports");
  const projCol = useCollection("projects");
  const state = gate(repCol, projCol, { ready, error: null });
  if (state !== "ready") return <GateView state={state} />;
  const r = repCol.data.find((x) => x.id === id);
  if (!r) return <NotFound />;
  const p = projCol.data.find((x) => x.id === r.projectId);
  return (
    <PrintPage>
      <CompanyHeader settings={settings} title={t("nav.dailyReports")} meta={<p className="num font-semibold">{date(r.date)}</p>} />
      <InfoGrid
        rows={[
          [t("fields.project"), p ? `${p.code} — ${p.name}` : "—"],
          [t("fields.weather"), enumLabel("weather", r.weather)],
          [t("fields.workforce"), String(r.workforce)],
          [t("fields.equipmentCount"), String(r.equipmentCount)],
          [t("fields.author"), r.author],
        ]}
      />
      {[
        [t("fields.worksDone"), r.worksDone],
        [t("fields.incidents"), r.incidents],
        [t("fields.observations"), r.observations],
      ].map(([label, text]) => (
        <div key={label} className="mb-4">
          <h3 className="mb-1 font-bold">{label}</h3>
          <div className="min-h-16 rounded border border-slate-300 p-3 whitespace-pre-line">{text || "—"}</div>
        </div>
      ))}
      <Signatures left={t("fields.author")} right={t("fields.manager")} />
      <PrintFooter settings={settings} />
    </PrintPage>
  );
}

export function MovementDoc({ id }: { id: string }) {
  const { t, money, number, date, enumLabel } = useApp();
  const { settings, ready } = useSettings();
  const movCol = useCollection("stockMovements");
  const matCol = useCollection("materials");
  const projCol = useCollection("projects");
  const supCol = useCollection("suppliers");
  const state = gate(movCol, matCol, projCol, supCol, { ready, error: null });
  if (state !== "ready") return <GateView state={state} />;
  const m = movCol.data.find((x) => x.id === id);
  const mat = m && matCol.data.find((x) => x.id === m.materialId);
  if (!m || !mat) return <NotFound />;
  const p = projCol.data.find((x) => x.id === m.projectId);
  const s = supCol.data.find((x) => x.id === m.supplierId);
  const title = m.type === "in" ? "BON D'ENTRÉE" : m.type === "out" ? "BON DE SORTIE" : "BON D'AJUSTEMENT";
  return (
    <PrintPage>
      <CompanyHeader
        settings={settings}
        title={title}
        meta={
          <>
            <p className="num font-semibold">{m.reference || m.id.slice(0, 8).toUpperCase()}</p>
            <p className="num">{date(m.date)}</p>
          </>
        }
      />
      <InfoGrid
        rows={[
          [t("fields.type"), enumLabel("movementType", m.type)],
          ...(p ? [[t("fields.project"), `${p.code} — ${p.name}`] as [string, string]] : []),
          ...(s ? [[t("fields.supplier"), s.name] as [string, string]] : []),
        ]}
      />
      <table>
        <thead>
          <tr>
            <th>{t("fields.code")}</th>
            <th>{t("fields.material")}</th>
            <th className="text-end">{t("fields.quantity")}</th>
            <th className="text-end">{t("fields.unitPrice")}</th>
            <th className="text-end">{t("fields.amount")}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="num">{mat.code}</td>
            <td>{mat.name}</td>
            <td className="num text-end">
              {number(Math.abs(m.quantity))} {mat.unit}
            </td>
            <td className="num text-end">{money(m.unitPrice)}</td>
            <td className="num text-end font-semibold">{money(Math.abs(m.quantity) * m.unitPrice)}</td>
          </tr>
        </tbody>
      </table>
      {m.notes && <p className="mt-3 text-[11px] text-slate-600">{m.notes}</p>}
      <Signatures left={m.type === "out" ? t("fields.responsible") : t("fields.supplier")} right={t("fields.location")} />
      <PrintFooter settings={settings} />
    </PrintPage>
  );
}
