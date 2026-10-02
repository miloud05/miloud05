"use client";

import { useApp } from "@/components/providers/AppProvider";
import { useCollection } from "@/lib/client/api";
import { useSettings } from "@/lib/client/settings";
import { computeDelay, computeDqeTotals, computeSituation, previousQuantities } from "@/lib/calc/market";
import { round2, todayIso } from "@/lib/calc/money";
import { amountInWordsFr } from "@/lib/calc/words";
import { CompanyHeader, InfoGrid, PrintFooter, PrintPage, Signatures } from "./PrintShell";
import { GateView, NotFound, gate } from "./states";

function useMarketData() {
  const { settings, ready } = useSettings();
  const situationsCol = useCollection("situations");
  const marketsCol = useCollection("markets");
  const clientsCol = useCollection("clients");
  const projectsCol = useCollection("projects");
  return {
    settings,
    state: gate(situationsCol, marketsCol, clientsCol, projectsCol, { ready, error: null }),
    situations: situationsCol.data,
    markets: marketsCol.data,
    clients: clientsCol.data,
    projects: projectsCol.data,
  };
}

export function SituationDoc({ id, attachment = false }: { id: string; attachment?: boolean }) {
  const { t, money, number, date } = useApp();
  const { settings, state, situations, markets, clients, projects } = useMarketData();
  if (state !== "ready") return <GateView state={state} />;
  const s = situations.find((x) => x.id === id);
  const market = s && markets.find((m) => m.id === s.marketId);
  if (!s || !market) return <NotFound />;
  const r = computeSituation(market, s.quantities, previousQuantities(situations, market.id, s.number), s.penalties);
  const totals = computeDqeTotals(market.items, market.tvaRate, market.amendments);
  const client = clients.find((c) => c.id === market.clientId);
  const project = projects.find((p) => p.id === market.projectId);

  return (
    <PrintPage landscape>
      <CompanyHeader
        settings={settings}
        title={attachment ? t("print.attachment", { number: s.number }) : t("print.situation", { number: s.number })}
        meta={
          <>
            <p className="num">
              {t("fields.date")} : {date(s.date)}
            </p>
            <p className="num">
              {t("print.period")} : {date(s.periodFrom)} → {date(s.periodTo)}
            </p>
          </>
        }
      />
      <InfoGrid
        rows={[
          [t("print.market"), `${market.reference} — ${market.object}`],
          [t("fields.client"), client?.name ?? "—"],
          ...(project ? [[t("fields.project"), `${project.code} — ${project.name}`] as [string, string]] : []),
          [t("markets.contractAmount"), `${money(totals.totalTTC)} TTC`],
        ]}
      />
      <table className="mb-4 text-[10px]">
        <thead>
          <tr>
            <th>{t("fields.code")}</th>
            <th>{t("fields.designation")}</th>
            <th className="text-center">{t("fields.unit")}</th>
            <th className="text-end">{t("markets.contractQty")}</th>
            {!attachment && <th className="text-end">{t("fields.unitPrice")}</th>}
            <th className="text-end">{t("markets.previousQty")}</th>
            <th className="text-end">{t("markets.currentQty")}</th>
            <th className="text-end">{t("markets.cumulativeQty")}</th>
            {!attachment && <th className="text-end">{t("markets.previousAmount")}</th>}
            {!attachment && <th className="text-end">{t("markets.currentAmount")}</th>}
            {!attachment && <th className="text-end">{t("markets.cumulativeAmount")}</th>}
          </tr>
        </thead>
        <tbody>
          {r.lines.map((l) => (
            <tr key={l.itemId}>
              <td className="num">{l.code}</td>
              <td>{l.designation}</td>
              <td className="text-center">{l.unit}</td>
              <td className="num text-end">{number(l.contractQty)}</td>
              {!attachment && <td className="num text-end">{money(l.unitPrice)}</td>}
              <td className="num text-end">{number(l.previousQty)}</td>
              <td className="num text-end font-semibold">{number(l.currentQty)}</td>
              <td className="num text-end">{number(l.cumulativeQty)}</td>
              {!attachment && <td className="num text-end">{money(l.previousAmount)}</td>}
              {!attachment && <td className="num text-end font-semibold">{money(l.currentAmount)}</td>}
              {!attachment && <td className="num text-end">{money(l.cumulativeAmount)}</td>}
            </tr>
          ))}
        </tbody>
        {!attachment && (
          <tfoot>
            <tr className="font-bold">
              <td colSpan={8} className="text-end">
                {t("common.total")} HT
              </td>
              <td className="num text-end">{money(r.previousHT)}</td>
              <td className="num text-end">{money(r.currentHT)}</td>
              <td className="num text-end">{money(r.cumulativeHT)}</td>
            </tr>
          </tfoot>
        )}
      </table>

      {!attachment && (
        <div className="flex items-start justify-between gap-8">
          <p className="max-w-[50%] text-[11px]">
            Arrêtée la présente situation à la somme de : <strong>{amountInWordsFr(r.netToPay)}</strong>.
            <br />
            <span className="text-slate-500">
              {t("markets.financialProgress")} : {number(r.progress, 2)} %
            </span>
          </p>
          <table className="!w-[42%]">
            <tbody>
              {[
                [t("markets.currentAmount"), r.currentHT],
                [t("markets.revisionAmount"), r.revision],
                [t("documents.tva", { rate: market.tvaRate }), r.tva],
                [t("documents.totalTTC"), r.currentTTC],
                [`− ${t("markets.guarantee")} ${market.guaranteeRate} %`, r.guarantee],
                [`− ${t("markets.advanceRepayment")} ${market.advanceRate} %`, r.advanceRepayment],
                [`− ${t("fields.penalties")}`, r.penalties],
              ].map(([k, v]) => (
                <tr key={String(k)}>
                  <td>{k}</td>
                  <td className="num text-end">{money(Number(v))}</td>
                </tr>
              ))}
              <tr className="bg-[#fff1e8] font-bold">
                <td>{t("markets.netToPay")}</td>
                <td className="num text-end">{money(r.netToPay)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <Signatures left={t("print.companySignature")} right={t("print.clientSignature")} />
      <PrintFooter settings={settings} />
    </PrintPage>
  );
}

export function OdsDoc({ id }: { id: string }) {
  const { t, date, enumLabel } = useApp();
  const { settings, ready } = useSettings();
  const odsCol = useCollection("ods");
  const marketsCol = useCollection("markets");
  const clientsCol = useCollection("clients");
  const state = gate(odsCol, marketsCol, clientsCol, { ready, error: null });
  if (state !== "ready") return <GateView state={state} />;
  const o = odsCol.data.find((x) => x.id === id);
  const market = o && marketsCol.data.find((m) => m.id === o.marketId);
  if (!o || !market) return <NotFound />;
  const client = clientsCol.data.find((c) => c.id === market.clientId);
  return (
    <PrintPage>
      <CompanyHeader settings={settings} title={t("print.ods", { number: o.number })} meta={<p className="num">{date(o.date)}</p>} />
      <InfoGrid
        rows={[
          [t("print.market"), `${market.reference} — ${market.object}`],
          [t("fields.client"), client?.name ?? "—"],
          [t("fields.type"), enumLabel("odsType", o.type)],
          [t("fields.subject"), o.subject],
        ]}
      />
      <div className="min-h-48 rounded border border-slate-300 p-4 text-[12px] whitespace-pre-line">{o.description || o.subject}</div>
      <Signatures left={t("print.clientSignature")} right={t("print.companySignature")} />
      <PrintFooter settings={settings} />
    </PrintPage>
  );
}

export function MarketsSummary() {
  const { t, money, date, enumLabel } = useApp();
  const { settings, state, situations, markets, clients } = useMarketData();
  if (state !== "ready") return <GateView state={state} />;
  const rows = markets.map((m) => {
    const totals = computeDqeTotals(m.items, m.tvaRate, m.amendments);
    const list = situations.filter((s) => s.marketId === m.id).sort((a, b) => a.number - b.number);
    const last = list[list.length - 1];
    const res = last ? computeSituation(m, last.quantities, previousQuantities(situations, m.id, last.number)) : null;
    const extra = m.amendments.reduce((a, x) => a + (x.extraDays || 0), 0);
    const delay = m.startDate
      ? computeDelay({
          startDate: m.startDate,
          durationDays: m.durationDays + extra,
          suspendedDays: m.suspendedDays,
          completionDate: m.completionDate || todayIso(),
          amountTTC: totals.totalTTC,
          penaltyRatePerMille: m.penaltyRatePerMille,
          penaltyCapPercent: m.penaltyCapPercent,
        })
      : null;
    return { m, totals, progress: res?.progress ?? 0, cumulative: res?.cumulativeHT ?? 0, delay };
  });
  return (
    <PrintPage landscape>
      <CompanyHeader settings={settings} title={t("reports.marketsSummary")} />
      <table>
        <thead>
          <tr>
            <th>{t("fields.reference")}</th>
            <th>{t("fields.object")}</th>
            <th>{t("fields.client")}</th>
            <th className="text-end">{t("markets.contractAmount")}</th>
            <th className="text-end">{t("markets.cumulativeAmount")}</th>
            <th className="text-end">%</th>
            <th>{t("markets.contractualEnd")}</th>
            <th className="text-end">{t("markets.estimatedPenalty")}</th>
            <th>{t("fields.status")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ m, totals, progress, cumulative, delay }) => (
            <tr key={m.id}>
              <td className="num">{m.reference}</td>
              <td>{m.object}</td>
              <td>{clients.find((c) => c.id === m.clientId)?.name ?? "—"}</td>
              <td className="num text-end">{money(totals.totalTTC)}</td>
              <td className="num text-end">{money(cumulative)}</td>
              <td className="num text-end">{Math.round(progress)}</td>
              <td className="num">{delay ? date(delay.contractualEnd) : "—"}</td>
              <td className="num text-end">{money(delay?.penalty ?? 0)}</td>
              <td>{enumLabel("marketStatus", m.status)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-bold">
            <td colSpan={3}>{t("common.total")}</td>
            <td className="num text-end">{money(round2(rows.reduce((a, r) => a + r.totals.totalTTC, 0)))}</td>
            <td className="num text-end">{money(round2(rows.reduce((a, r) => a + r.cumulative, 0)))}</td>
            <td colSpan={4} />
          </tr>
        </tfoot>
      </table>
      <PrintFooter settings={settings} />
    </PrintPage>
  );
}
