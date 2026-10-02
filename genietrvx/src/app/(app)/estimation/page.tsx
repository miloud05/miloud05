"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Calculator, Clock, FileText, Sparkles, Users } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button, Card, Field, Input, PageHeader, Select, StatCard } from "@/components/ui";
import { useApp } from "@/components/providers/AppProvider";
import { useCollection } from "@/lib/client/api";
import { useSettings } from "@/lib/client/settings";
import { COST_PER_M2, estimateProject, type BuildingType, type Standing } from "@/lib/calc/estimate";
import { addDays, todayIso } from "@/lib/calc/money";
import { WILAYAS } from "@/lib/wilayas";

export default function EstimationPage() {
  const { t, money, number, lang, can, toast, errorMessage } = useApp();
  const router = useRouter();
  const quotes = useCollection("quotes", can("quotes"));
  const { data: clients } = useCollection("clients");
  const { settings } = useSettings();
  const [input, setInput] = useState({ buildingType: "villa" as BuildingType, standing: "standard" as Standing, surface: 250, floors: 2, wilaya: 16 });
  const [clientId, setClientId] = useState("");
  const [busy, setBusy] = useState(false);

  const result = useMemo(() => {
    try {
      return estimateProject({ ...input, tvaRate: settings.invoicing.tvaRate });
    } catch {
      return null;
    }
  }, [input, settings.invoicing.tvaRate]);

  async function createQuote() {
    if (!result) return;
    setBusy(true);
    try {
      const title = `${t(`estimation.types.${input.buildingType}`)} — ${number(input.surface, 0)} m² — ${t(`estimation.standings.${input.standing}`)}`;
      const doc = await quotes.create({
        clientId,
        projectName: title,
        date: todayIso(),
        validUntil: addDays(todayIso(), settings.invoicing.quoteValidityDays),
        tvaRate: settings.invoicing.tvaRate,
        discountRate: 0,
        status: "draft",
        lines: result.lots.map((l) => ({
          designation: t(`estimation.lotNames.${l.key}`),
          unit: "m2",
          quantity: input.surface,
          unitPrice: Math.round((l.amount / input.surface) * 100) / 100,
        })),
        notes: `${t("estimation.duration")} : ${result.durationMonths} ${t("common.months")}. ${t("estimation.disclaimer")}`,
      });
      toast(t("estimation.quoteCreated", { number: doc.number }));
      router.push(`/quotes/${doc.id}`);
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  const chartData = result?.lots.map((l) => ({ name: t(`estimation.lotNames.${l.key}`), amount: l.amount })) ?? [];

  return (
    <div>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Sparkles className="size-6 text-primary" /> {t("estimation.title")}
          </span>
        }
        subtitle={t("estimation.subtitle")}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_1fr]">
        <Card title={t("estimation.run")}>
          <div className="flex flex-col gap-4">
            <Field label={t("estimation.buildingType")} htmlFor="buildingType">
              <Select id="buildingType" value={input.buildingType} onChange={(e) => setInput({ ...input, buildingType: e.target.value as BuildingType })}>
                {(Object.keys(COST_PER_M2) as BuildingType[]).map((k) => (
                  <option key={k} value={k}>
                    {t(`estimation.types.${k}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("estimation.standing")} htmlFor="standing">
              <Select id="standing" value={input.standing} onChange={(e) => setInput({ ...input, standing: e.target.value as Standing })}>
                {(["economic", "standard", "luxury"] as Standing[]).map((k) => (
                  <option key={k} value={k}>
                    {t(`estimation.standings.${k}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("estimation.surface")} htmlFor="surface">
                <Input id="surface" type="number" dir="ltr" min={1} value={input.surface} onChange={(e) => setInput({ ...input, surface: Number(e.target.value) })} />
              </Field>
              <Field label={t("estimation.floors")} htmlFor="floors">
                <Input id="floors" type="number" dir="ltr" min={1} max={40} value={input.floors} onChange={(e) => setInput({ ...input, floors: Number(e.target.value) })} />
              </Field>
            </div>
            <Field label={t("fields.wilaya")} htmlFor="wilaya">
              <Select id="wilaya" value={input.wilaya} onChange={(e) => setInput({ ...input, wilaya: Number(e.target.value) })}>
                {WILAYAS.map((w) => (
                  <option key={w.code} value={w.code}>
                    {String(w.code).padStart(2, "0")} - {lang === "ar" ? w.ar : w.fr}
                  </option>
                ))}
              </Select>
            </Field>
            {can("quotes", "write") && (
              <>
                <Field label={t("fields.client")} htmlFor="clientId">
                  <Select id="clientId" value={clientId} onChange={(e) => setClientId(e.target.value)}>
                    <option value="">{t("common.select")}</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Button icon={<FileText className="size-4" />} loading={busy} onClick={createQuote} disabled={!result}>
                  {t("estimation.createQuote")}
                </Button>
              </>
            )}
            <p className="text-xs text-muted">{t("estimation.disclaimer")}</p>
          </div>
        </Card>

        {result ? (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard label={t("fields.totalHT")} value={money(result.totalHT)} icon={<Calculator className="size-5" />} hint={t("estimation.range", { low: money(result.low), high: money(result.high) })} />
              <StatCard label={t("estimation.costPerM2")} value={money(result.costPerM2)} tone="info" hint={`${t("estimation.zone")} : ${t(`estimation.zones.${result.zone}`)}`} />
              <StatCard label={t("estimation.duration")} value={`${result.durationMonths} ${t("common.months")}`} tone="warning" icon={<Clock className="size-5" />} />
              <StatCard label={t("estimation.workforce")} value={result.workforce} tone="success" icon={<Users className="size-5" />} />
            </div>

            <Card title={t("estimation.lots")}>
              <div className="h-80" dir="ltr">
                <ResponsiveContainer>
                  <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <XAxis type="number" tickFormatter={(v) => `${Math.round(Number(v) / 1e6)} M`} tick={{ fontSize: 11, fill: "var(--muted)" }} />
                    <YAxis type="category" dataKey="name" width={190} tick={{ fontSize: 11, fill: "var(--muted)" }} />
                    <Tooltip formatter={(v) => money(Number(v))} contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12 }} />
                    <Bar dataKey="amount" fill="#e8590c" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {result.lots.map((l) => (
                      <tr key={l.key} className="border-t border-border">
                        <td className="py-2">{t(`estimation.lotNames.${l.key}`)}</td>
                        <td className="num py-2 text-end text-muted">{l.percent} %</td>
                        <td className="num py-2 text-end font-medium">{money(l.amount)}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-border font-semibold">
                      <td className="py-2">{t("fields.totalHT")}</td>
                      <td />
                      <td className="num py-2 text-end">{money(result.totalHT)}</td>
                    </tr>
                    <tr>
                      <td className="py-1 text-muted">{t("documents.tva", { rate: settings.invoicing.tvaRate })}</td>
                      <td />
                      <td className="num py-1 text-end text-muted">{money(result.tva)}</td>
                    </tr>
                    <tr className="font-bold text-primary">
                      <td className="py-2">{t("fields.totalTTC")}</td>
                      <td />
                      <td className="num py-2 text-end">{money(result.totalTTC)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>

            <Card title={t("estimation.materials")}>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {result.materials.map((m) => (
                  <div key={m.key} className="rounded-xl border border-border p-4">
                    <p className="text-xs text-muted">{t(`estimation.materialNames.${m.key}`)}</p>
                    <p className="num mt-1 text-lg font-bold">
                      {number(m.quantity, m.unit === "t" ? 1 : 0)} <span className="text-sm font-medium text-muted">{m.unit}</span>
                    </p>
                    {m.amount > 0 && <p className="num text-xs text-muted">≈ {money(m.amount)}</p>}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        ) : (
          <Card>
            <p className="text-sm text-muted">{t("estimation.surface")} &gt; 0</p>
          </Card>
        )}
      </div>
    </div>
  );
}
