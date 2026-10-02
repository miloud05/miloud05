"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ScrollText, Upload } from "lucide-react";
import { CrudPage } from "@/components/crud/CrudPage";
import { StatusBadge } from "@/components/StatusBadge";
import { Button, ProgressBar, StatCard } from "@/components/ui";
import { ImportMarketDialog } from "@/components/DqeImport";
import { useApp } from "@/components/providers/AppProvider";
import { useCollection } from "@/lib/client/api";
import { useLookup } from "@/lib/client/lookup";
import { computeDqeTotals, computeSituation, previousQuantities } from "@/lib/calc/market";
import { round2, todayIso } from "@/lib/calc/money";
import type { Market } from "@/lib/schemas";

export default function MarketsPage() {
  const { t, money, date, can } = useApp();
  const router = useRouter();
  const [importing, setImporting] = useState(false);
  const clients = useLookup("clients");
  const projects = useLookup("projects");
  const { data: situations } = useCollection("situations");

  const progressOf = (m: Market) => {
    const last = situations.filter((s) => s.marketId === m.id).sort((a, b) => b.number - a.number)[0];
    if (!last) return 0;
    return computeSituation(m, last.quantities, previousQuantities(situations, m.id, last.number)).progress;
  };
  const totalOf = (m: Market) => computeDqeTotals(m.items, m.tvaRate, m.amendments).totalTTC;

  return (
    <>
      <CrudPage
        collection="markets"
        headerActions={
          can("markets", "write") && (
            <Button variant="secondary" icon={<Upload className="size-4" />} onClick={() => setImporting(true)}>
              {t("markets.import")}
            </Button>
          )
        }
        title="markets.title"
        subtitle="markets.subtitle"
        newLabel="markets.new"
        modalSize="lg"
        emptyIcon={<ScrollText className="size-6" />}
        defaults={() => ({
          kind: "public",
          status: "ongoing",
          tvaRate: 19,
          guaranteeRate: 5,
          advanceRate: 15,
          penaltyRatePerMille: 1,
          penaltyCapPercent: 10,
          revisionCoefficient: 1,
          signDate: todayIso(),
          items: [],
        })}
        rowHref={(r) => `/markets/${r.id}`}
        afterCreate={(doc) => router.push(`/markets/${doc.id}`)}
        searchText={(r) => `${r.reference} ${r.object} ${clients.label(r.clientId)} ${projects.label(r.projectId)}`}
        filters={[
          { name: "status", label: "fields.status", enumKey: "marketStatus" },
          { name: "kind", label: "fields.kind", enumKey: "marketKind" },
        ]}
        summary={(rows) => {
          const active = rows.filter((r) => r.status !== "closed");
          return (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard label={t("dashboard.marketsCount", { count: active.length })} value={active.length} icon={<ScrollText className="size-5" />} />
              <StatCard label={t("dashboard.portfolio")} value={money(round2(active.reduce((a, m) => a + totalOf(m), 0)))} tone="success" />
              <StatCard
                label={t("markets.financialProgress")}
                value={`${active.length ? Math.round(active.reduce((a, m) => a + progressOf(m), 0) / active.length) : 0} %`}
                tone="info"
              />
            </div>
          );
        }}
        columns={[
          { key: "reference", label: "fields.reference", render: (r) => <span className="num font-mono text-xs">{r.reference || "—"}</span> },
          {
            key: "object",
            label: "fields.object",
            className: "min-w-72",
            render: (r) => (
              <div>
                <p className="line-clamp-2 font-medium">{r.object}</p>
                <p className="text-xs text-muted">
                  {clients.label(r.clientId)} · {projects.get(r.projectId)?.code ?? "—"}
                </p>
              </div>
            ),
          },
          { key: "kind", label: "fields.kind", render: (r) => <StatusBadge enumKey="marketKind" value={r.kind} /> },
          { key: "amount", label: "markets.contractAmount", align: "end", sortValue: totalOf, render: (r) => <span className="num font-semibold">{money(totalOf(r))}</span> },
          {
            key: "progress",
            label: "markets.financialProgress",
            sortValue: progressOf,
            render: (r) => {
              const p = progressOf(r);
              return (
                <div className="min-w-28">
                  <span className="num text-xs font-semibold">{Math.round(p)} %</span>
                  <ProgressBar value={p} className="mt-1" tone="info" />
                </div>
              );
            },
          },
          { key: "startDate", label: "fields.odsDate", render: (r) => <span className="num">{date(r.startDate)}</span> },
          { key: "status", label: "fields.status", render: (r) => <StatusBadge enumKey="marketStatus" value={r.status} /> },
        ]}
        fields={[
          { name: "object", label: "fields.object", required: true, full: true },
          { name: "reference", label: "fields.reference", ltr: true },
          { name: "kind", label: "fields.kind", type: "select", enumKey: "marketKind" },
          { name: "clientId", label: "fields.client", type: "ref", ref: "clients" },
          { name: "projectId", label: "fields.project", type: "ref", ref: "projects" },
          { name: "procedure", label: "fields.procedure", full: true },
          { name: "signDate", label: "fields.signDate", type: "date" },
          { name: "startDate", label: "fields.odsDate", type: "date" },
          { name: "durationDays", label: "fields.durationDays", type: "number", step: "1" },
          { name: "status", label: "fields.status", type: "select", enumKey: "marketStatus" },
          { name: "tvaRate", label: "fields.tvaRate", type: "number" },
          { name: "guaranteeRate", label: "fields.guaranteeRate", type: "number" },
          { name: "advanceRate", label: "fields.advanceRate", type: "number" },
          { name: "penaltyRatePerMille", label: "fields.penaltyRate", type: "number" },
        ]}
      />
      <ImportMarketDialog open={importing} onClose={() => setImporting(false)} />
    </>
  );
}
