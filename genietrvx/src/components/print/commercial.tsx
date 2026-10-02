"use client";

import { useApp } from "@/components/providers/AppProvider";
import { useCollection } from "@/lib/client/api";
import { useSettings } from "@/lib/client/settings";
import { computeDocumentTotals, invoiceFigures, lineTotal, type DocumentTotals } from "@/lib/calc/documents";
import { round2 } from "@/lib/calc/money";
import { amountInWordsFr } from "@/lib/calc/words";
import { wilayaName } from "@/lib/wilayas";
import type { Client, Invoice, Quote } from "@/lib/schemas";
import { CompanyHeader, InfoGrid, PrintFooter, PrintPage, Signatures } from "./PrintShell";
import { GateView, NotFound, gate } from "./states";

function ClientBox({ client }: { client: Client | undefined }) {
  const { t, lang } = useApp();
  if (!client) return null;
  return (
    <div className="mb-5 ms-auto w-[46%] rounded border border-slate-300 p-3 text-[11px]">
      <p className="mb-1 text-[10px] text-slate-500 uppercase">{t("print.to")}</p>
      <p className="text-sm font-bold">{client.name}</p>
      {client.address && <p>{client.address}</p>}
      <p>{wilayaName(client.wilaya, lang)}</p>
      <p className="num">{[client.nif && `NIF : ${client.nif}`, client.rc && `RC : ${client.rc}`, client.ai && `AI : ${client.ai}`].filter(Boolean).join(" · ")}</p>
      {client.phone && <p className="num">Tél : {client.phone}</p>}
    </div>
  );
}

function LinesTable({ lines }: { lines: Quote["lines"] }) {
  const { t, money, number } = useApp();
  return (
    <table className="mb-4">
      <thead>
        <tr>
          <th className="w-8 text-center">N°</th>
          <th>{t("fields.designation")}</th>
          <th className="w-14 text-center">{t("fields.unit")}</th>
          <th className="w-20 text-end">{t("fields.quantity")}</th>
          <th className="w-28 text-end">{t("fields.unitPrice")}</th>
          <th className="w-32 text-end">{t("documents.lineTotal")}</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((l, i) => (
          <tr key={i}>
            <td className="num text-center">{i + 1}</td>
            <td>{l.designation}</td>
            <td className="text-center">{l.unit}</td>
            <td className="num text-end">{number(l.quantity)}</td>
            <td className="num text-end">{money(l.unitPrice)}</td>
            <td className="num text-end">{money(lineTotal(l))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Totals({ totals, tvaRate, discountRate }: { totals: DocumentTotals; tvaRate: number; discountRate: number }) {
  const { t, money } = useApp();
  const rows: Array<[string, number, boolean?]> = [[t("documents.subtotal"), totals.subtotal]];
  if (discountRate > 0) rows.push([`${t("documents.discount")} ${discountRate} %`, -totals.discount]);
  rows.push([t("documents.totalHT"), totals.totalHT], [t("documents.tva", { rate: tvaRate }), totals.tva], [t("documents.totalTTC"), totals.totalTTC]);
  if (totals.stamp > 0) rows.push([t("documents.stamp"), totals.stamp]);
  rows.push([t("documents.totalDue"), totals.totalDue, true]);
  return (
    <table className="ms-auto mb-4 !w-[46%]">
      <tbody>
        {rows.map(([label, v, strong]) => (
          <tr key={label} className={strong ? "bg-[#fff1e8] font-bold" : ""}>
            <td>{label}</td>
            <td className="num text-end">{money(v)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function QuoteDoc({ id }: { id: string }) {
  const { t, date } = useApp();
  const { settings, ready: sReady } = useSettings();
  const quotesCol = useCollection("quotes");
  const clientsCol = useCollection("clients");
  const quotes = quotesCol.data;
  const clients = clientsCol.data;
  const state = gate(quotesCol, clientsCol, { ready: sReady, error: null });
  if (state !== "ready") return <GateView state={state} />;
  const q = quotes.find((x) => x.id === id);
  if (!q) return <NotFound />;
  const totals = computeDocumentTotals(q.lines, { discountRate: q.discountRate, tvaRate: q.tvaRate });
  return (
    <PrintPage>
      <CompanyHeader
        settings={settings}
        title={t("print.quote")}
        meta={
          <>
            <p className="num font-semibold">N° {q.number}</p>
            <p className="num">
              {t("fields.date")} : {date(q.date)}
            </p>
            {q.validUntil && (
              <p className="num">
                {t("fields.validUntil")} : {date(q.validUntil)}
              </p>
            )}
          </>
        }
      />
      <ClientBox client={clients.find((c) => c.id === q.clientId)} />
      {q.projectName && <InfoGrid rows={[[t("fields.object"), q.projectName]]} />}
      <LinesTable lines={q.lines} />
      <Totals totals={totals} tvaRate={q.tvaRate} discountRate={q.discountRate} />
      <p className="text-[11px]">
        Arrêté le présent devis à la somme de : <strong className="first-letter:uppercase">{amountInWordsFr(totals.totalDue)}</strong>.
      </p>
      {q.notes && <p className="mt-3 text-[11px] whitespace-pre-line text-slate-600">{q.notes}</p>}
      <Signatures left={t("print.clientSignature")} right={t("print.companySignature")} />
      <PrintFooter settings={settings} />
    </PrintPage>
  );
}

export function InvoiceDoc({ id }: { id: string }) {
  const { t, date, enumLabel, money } = useApp();
  const { settings, ready: sReady } = useSettings();
  const invoicesCol = useCollection("invoices");
  const clientsCol = useCollection("clients");
  const projectsCol = useCollection("projects");
  const [invoices, clients, projects] = [invoicesCol.data, clientsCol.data, projectsCol.data];
  const state = gate(invoicesCol, clientsCol, projectsCol, { ready: sReady, error: null });
  if (state !== "ready") return <GateView state={state} />;
  const inv = invoices.find((x) => x.id === id);
  if (!inv) return <NotFound />;
  const { totals, balance } = invoiceFigures(inv, settings.invoicing);
  const project = projects.find((p) => p.id === inv.projectId);
  return (
    <PrintPage>
      <CompanyHeader
        settings={settings}
        title={t("print.invoice")}
        meta={
          <>
            <p className="num font-semibold">N° {inv.number}</p>
            <p className="num">
              {t("fields.date")} : {date(inv.date)}
            </p>
            {inv.dueDate && (
              <p className="num">
                {t("fields.dueDate")} : {date(inv.dueDate)}
              </p>
            )}
          </>
        }
      />
      <ClientBox client={clients.find((c) => c.id === inv.clientId)} />
      <InfoGrid
        rows={[
          ...(project ? [[t("fields.project"), `${project.code} — ${project.name}`] as [string, string]] : []),
          [t("fields.paymentMode"), enumLabel("paymentMode", inv.paymentMode)],
        ]}
      />
      <LinesTable lines={inv.lines} />
      <Totals totals={totals} tvaRate={inv.tvaRate} discountRate={inv.discountRate} />
      <p className="text-[11px]">
        {t("invoices.inWords")} <strong>{amountInWordsFr(totals.totalDue)}</strong>.
      </p>
      {balance.paid > 0 && (
        <p className="mt-2 text-[11px]">
          {t("fields.paid")} : <span className="num font-semibold">{money(balance.paid)}</span> · {t("fields.remaining")} :{" "}
          <span className="num font-semibold">{money(balance.remaining)}</span>
        </p>
      )}
      {inv.notes && <p className="mt-3 text-[11px] whitespace-pre-line text-slate-600">{inv.notes}</p>}
      <Signatures left={t("print.clientSignature")} right={t("print.companySignature")} />
      <PrintFooter settings={settings} />
    </PrintPage>
  );
}

export function InvoicesJournal({ clientId }: { clientId?: string }) {
  const { t, date, money } = useApp();
  const { settings, ready: sReady } = useSettings();
  const invoicesCol = useCollection("invoices");
  const clientsCol = useCollection("clients");
  const [invoices, clients] = [invoicesCol.data, clientsCol.data];
  const state = gate(invoicesCol, clientsCol, { ready: sReady, error: null });
  if (state !== "ready") return <GateView state={state} />;
  const client = clientId ? clients.find((c) => c.id === clientId) : undefined;
  if (clientId && !client) return <NotFound />;
  const rows: Array<{ inv: Invoice; f: ReturnType<typeof invoiceFigures> }> = invoices
    .filter((i) => i.status !== "draft" && i.status !== "cancelled" && (!clientId || i.clientId === clientId))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((inv) => ({ inv, f: invoiceFigures(inv, settings.invoicing) }));
  const sum = (pick: (r: (typeof rows)[number]) => number) => round2(rows.reduce((a, r) => a + pick(r), 0));
  return (
    <PrintPage landscape>
      <CompanyHeader settings={settings} title={client ? t("reports.clientStatement") : t("reports.invoicesJournal")} meta={client && <p className="font-semibold">{client.name}</p>} />
      <table>
        <thead>
          <tr>
            <th>{t("fields.number")}</th>
            <th>{t("fields.date")}</th>
            {!client && <th>{t("fields.client")}</th>}
            <th className="text-end">{t("fields.totalHT")}</th>
            <th className="text-end">{t("fields.tva")}</th>
            <th className="text-end">{t("documents.stamp")}</th>
            <th className="text-end">{t("invoices.totalDue")}</th>
            <th className="text-end">{t("fields.paid")}</th>
            <th className="text-end">{t("fields.remaining")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ inv, f }) => (
            <tr key={inv.id}>
              <td className="num">{inv.number}</td>
              <td className="num">{date(inv.date)}</td>
              {!client && <td>{clients.find((c) => c.id === inv.clientId)?.name ?? "—"}</td>}
              <td className="num text-end">{money(f.totals.totalHT)}</td>
              <td className="num text-end">{money(f.totals.tva)}</td>
              <td className="num text-end">{money(f.totals.stamp)}</td>
              <td className="num text-end">{money(f.totals.totalDue)}</td>
              <td className="num text-end">{money(f.balance.paid)}</td>
              <td className="num text-end">{money(f.balance.remaining)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-bold">
            <td colSpan={client ? 2 : 3}>{t("common.total")}</td>
            <td className="num text-end">{money(sum((r) => r.f.totals.totalHT))}</td>
            <td className="num text-end">{money(sum((r) => r.f.totals.tva))}</td>
            <td className="num text-end">{money(sum((r) => r.f.totals.stamp))}</td>
            <td className="num text-end">{money(sum((r) => r.f.totals.totalDue))}</td>
            <td className="num text-end">{money(sum((r) => r.f.balance.paid))}</td>
            <td className="num text-end">{money(sum((r) => r.f.balance.remaining))}</td>
          </tr>
        </tfoot>
      </table>
      <PrintFooter settings={settings} />
    </PrintPage>
  );
}
