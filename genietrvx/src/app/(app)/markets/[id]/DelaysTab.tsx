"use client";

import { useState } from "react";
import { Plus, Trash } from "lucide-react";
import { Badge, Button, Card, Field, Input, ProgressBar } from "@/components/ui";
import { useApp } from "@/components/providers/AppProvider";
import { useCollection } from "@/lib/client/api";
import { computePriceRevision } from "@/lib/calc/market";
import type { Market } from "@/lib/schemas";

interface IndexRow {
  name: string;
  weight: number;
  baseIndex: number;
  currentIndex: number;
}

export function DelaysTab({
  market,
  delay,
  totalHT,
}: {
  market: Market;
  delay: { contractualEnd: string; lateDays: number; penalty: number; timeConsumed: number } | null;
  totalHT: number;
}) {
  const { t, money, date, number, can, toast, errorMessage } = useApp();
  const { update } = useCollection("markets");
  const [fixedPart, setFixedPart] = useState(0.15);
  const [indexes, setIndexes] = useState<IndexRow[]>([
    { name: "Liants hydrauliques (LH)", weight: 0.25, baseIndex: 100, currentIndex: 100 },
    { name: "Aciers (FR)", weight: 0.3, baseIndex: 100, currentIndex: 100 },
    { name: "Agrégats (AG)", weight: 0.15, baseIndex: 100, currentIndex: 100 },
    { name: "Main d'œuvre (S)", weight: 0.15, baseIndex: 100, currentIndex: 100 },
  ]);
  const [busy, setBusy] = useState(false);
  const revision = computePriceRevision(totalHT, fixedPart, indexes);
  const extraDays = market.amendments.reduce((a, x) => a + (x.extraDays || 0), 0);

  async function apply() {
    setBusy(true);
    try {
      await update(market.id, { revisionCoefficient: Number(revision.coefficient.toFixed(4)) });
      toast(t("common.saved"));
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card title={t("markets.delays")}>
        {!delay ? (
          <p className="text-sm text-muted">{t("fields.odsDate")} : —</p>
        ) : (
          <div className="flex flex-col gap-5 text-sm">
            <dl className="grid grid-cols-2 gap-4">
              {[
                [t("fields.odsDate"), date(market.startDate)],
                [t("fields.durationDays"), `${market.durationDays} + ${extraDays} (${t("markets.amendments")})`],
                [t("fields.suspendedDays"), String(market.suspendedDays)],
                [t("markets.contractualEnd"), date(delay.contractualEnd)],
                [t("fields.completionDate"), date(market.completionDate) ],
                [t("markets.lateDays"), String(delay.lateDays)],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-muted">{k}</dt>
                  <dd className="num mt-0.5 font-medium">{v}</dd>
                </div>
              ))}
            </dl>
            <div>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-muted">{t("markets.timeConsumed")}</span>
                <span className="num font-semibold">{number(delay.timeConsumed, 1)} %</span>
              </div>
              <ProgressBar value={delay.timeConsumed} tone={delay.lateDays > 0 ? "danger" : delay.timeConsumed > 85 ? "warning" : "success"} />
            </div>
            <div className="flex items-center justify-between rounded-xl bg-danger-soft px-4 py-3">
              <span className="font-medium text-danger">{t("markets.estimatedPenalty")}</span>
              <span className="num font-bold text-danger">{money(delay.penalty)}</span>
            </div>
            <p className="text-xs text-muted">
              {t("fields.penaltyRate")} : {market.penaltyRatePerMille} ‰ · {t("fields.penaltyCap")} : {market.penaltyCapPercent} %
            </p>
          </div>
        )}
      </Card>

      <Card
        title={t("markets.revision")}
        actions={
          can("markets", "write") && (
            <Button size="sm" onClick={apply} loading={busy} disabled={!revision.weightsValid}>
              {t("markets.applyCoefficient")}
            </Button>
          )
        }
      >
        <p className="mb-4 rounded-lg bg-surface-2 px-3 py-2 font-mono text-xs" dir="ltr">
          P = P0 × (a + Σ bᵢ × Iᵢ / I0ᵢ)
        </p>
        <Field label={t("markets.fixedPart")} className="mb-4 max-w-40">
          <Input type="number" dir="ltr" step="0.01" value={fixedPart} onChange={(e) => setFixedPart(Number(e.target.value))} />
        </Field>
        <div className="scrollbar-thin relative overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-[10px] text-muted uppercase">
              <tr>
                <th className="py-1 text-start">{t("markets.indexName")}</th>
                <th className="py-1 text-end">{t("markets.weight")}</th>
                <th className="py-1 text-end">{t("markets.baseIndex")}</th>
                <th className="py-1 text-end">{t("markets.currentIndex")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {indexes.map((ix, i) => {
                const set = (patch: Partial<IndexRow>) => setIndexes(indexes.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                return (
                  <tr key={i}>
                    <td className="py-1 pe-2">
                      <Input value={ix.name} onChange={(e) => set({ name: e.target.value })} className="h-8 text-xs" />
                    </td>
                    {(["weight", "baseIndex", "currentIndex"] as const).map((k) => (
                      <td key={k} className="w-24 px-1 py-1">
                        <Input type="number" dir="ltr" step="0.01" value={ix[k]} onChange={(e) => set({ [k]: Number(e.target.value) })} className="h-8 text-end text-xs" />
                      </td>
                    ))}
                    <td>
                      <button onClick={() => setIndexes(indexes.filter((_, j) => j !== i))} className="rounded p-1.5 text-muted hover:text-danger" aria-label={t("common.removeLine")}>
                        <Trash className="size-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Button size="sm" variant="ghost" className="mt-2" icon={<Plus className="size-4" />} onClick={() => setIndexes([...indexes, { name: "", weight: 0, baseIndex: 100, currentIndex: 100 }])}>
          {t("markets.addIndex")}
        </Button>
        {!revision.weightsValid && <p className="mt-3 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">{t("markets.weightsInvalid")}</p>}
        <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
          <div className="rounded-xl bg-surface-2 p-3">
            <p className="text-xs text-muted">{t("markets.coefficient")}</p>
            <p className="num font-bold">{revision.coefficient.toFixed(4)}</p>
          </div>
          <div className="rounded-xl bg-surface-2 p-3">
            <p className="text-xs text-muted">{t("markets.revisedAmount")}</p>
            <p className="num font-bold">{money(revision.revisedAmount)}</p>
          </div>
          <div className="rounded-xl bg-primary-soft p-3">
            <p className="text-xs text-muted">{t("markets.difference")}</p>
            <p className="num font-bold text-primary">{money(revision.difference)}</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted">
          {t("fields.revisionCoefficient")} : <Badge>{market.revisionCoefficient}</Badge>
        </p>
      </Card>
    </div>
  );
}
