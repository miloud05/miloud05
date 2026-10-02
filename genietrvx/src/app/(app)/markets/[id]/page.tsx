"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, CalendarClock, Gauge, Landmark, Scale } from "lucide-react";
import { ButtonLink, EmptyState, PageHeader, Skeleton, StatCard, Tabs } from "@/components/ui";
import { StatusBadge } from "@/components/StatusBadge";
import { useApp } from "@/components/providers/AppProvider";
import { useCollection } from "@/lib/client/api";
import { useLookup } from "@/lib/client/lookup";
import { computeDelay, computeDqeTotals, computeSituation, previousQuantities } from "@/lib/calc/market";
import { todayIso } from "@/lib/calc/money";
import { GeneralTab } from "./GeneralTab";
import { DqeTab } from "./DqeTab";
import { SituationsTab } from "./SituationsTab";
import { OdsTab } from "./OdsTab";
import { ContractTab } from "./ContractTab";
import { DelaysTab } from "./DelaysTab";

type Tab = "general" | "dqe" | "situations" | "ods" | "contract" | "delays";

export default function MarketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t, money, number, date } = useApp();
  const markets = useCollection("markets");
  const { data: allSituations } = useCollection("situations");
  const { data: allOds } = useCollection("ods");
  const clients = useLookup("clients");
  const [tab, setTab] = useState<Tab>("general");

  const market = markets.data.find((m) => m.id === id);
  const situations = useMemo(() => allSituations.filter((s) => s.marketId === id).sort((a, b) => a.number - b.number), [allSituations, id]);
  const ods = useMemo(() => allOds.filter((o) => o.marketId === id), [allOds, id]);

  if (!markets.ready) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-96" />
        <Skeleton className="h-28" />
        <Skeleton className="h-72" />
      </div>
    );
  }
  if (!market) return <EmptyState title={t("common.notFound")} action={<ButtonLink href="/markets" variant="secondary">{t("common.back")}</ButtonLink>} />;

  const totals = computeDqeTotals(market.items, market.tvaRate, market.amendments);
  const last = situations[situations.length - 1];
  const progress = last ? computeSituation(market, last.quantities, previousQuantities(situations, market.id, last.number)).progress : 0;
  const extraDays = market.amendments.reduce((a, x) => a + (x.extraDays || 0), 0);
  const delay = market.startDate
    ? computeDelay({
        startDate: market.startDate,
        durationDays: market.durationDays + extraDays,
        suspendedDays: market.suspendedDays,
        completionDate: market.completionDate || todayIso(),
        amountTTC: totals.totalTTC,
        penaltyRatePerMille: market.penaltyRatePerMille,
        penaltyCapPercent: market.penaltyCapPercent,
      })
    : null;

  return (
    <div>
      <PageHeader
        back={
          <Link href="/markets" className="no-print mb-2 inline-flex items-center gap-1 text-xs text-muted hover:text-primary">
            <ArrowLeft className="size-3.5 rtl:rotate-180" /> {t("markets.title")}
          </Link>
        }
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="line-clamp-2 whitespace-normal">{market.object}</span>
            <StatusBadge enumKey="marketStatus" value={market.status} />
          </span>
        }
        subtitle={
          <span className="flex flex-wrap gap-x-4">
            <span className="num font-mono">{market.reference}</span>
            <span>{clients.label(market.clientId)}</span>
          </span>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t("markets.contractAmount")} value={money(totals.totalTTC)} icon={<Landmark className="size-5" />} hint={`HT : ${money(totals.totalHT)}`} />
        <StatCard label={t("markets.financialProgress")} value={`${number(progress, 1)} %`} tone="info" icon={<Gauge className="size-5" />} hint={t("markets.situations") + ` : ${situations.length}`} />
        <StatCard
          label={t("markets.contractualEnd")}
          value={delay ? date(delay.contractualEnd) : "—"}
          tone={delay && delay.lateDays > 0 ? "danger" : "success"}
          icon={<CalendarClock className="size-5" />}
          hint={delay ? `${t("markets.timeConsumed")} : ${Math.round(delay.timeConsumed)} %` : undefined}
        />
        <StatCard
          label={t("markets.estimatedPenalty")}
          value={money(delay?.penalty ?? 0)}
          tone={delay && delay.penalty > 0 ? "danger" : "neutral"}
          icon={<Scale className="size-5" />}
          hint={delay ? `${t("markets.lateDays")} : ${delay.lateDays}` : undefined}
        />
      </div>

      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "general", label: t("markets.general") },
          { id: "dqe", label: t("markets.dqe"), count: market.items.length },
          { id: "situations", label: t("markets.situations"), count: situations.length },
          { id: "ods", label: t("markets.ods"), count: ods.length },
          { id: "contract", label: `${t("markets.amendments")} & ${t("markets.bonds")}` },
          { id: "delays", label: `${t("markets.delays")} · ${t("markets.revision")}` },
        ]}
      />

      {tab === "general" && <GeneralTab market={market} />}
      {tab === "dqe" && <DqeTab market={market} />}
      {tab === "situations" && <SituationsTab market={market} situations={situations} />}
      {tab === "ods" && <OdsTab market={market} ods={ods} />}
      {tab === "contract" && <ContractTab market={market} />}
      {tab === "delays" && <DelaysTab market={market} delay={delay} totalHT={totals.totalHT} />}
    </div>
  );
}
