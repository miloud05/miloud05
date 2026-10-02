"use client";

import { useMemo, useState } from "react";
import { CheckCheck, FileText, Pencil, Plus, Printer, Trash } from "lucide-react";
import { Button, Card, EmptyState, Field, Input, Modal, Select, Table, Td, Th } from "@/components/ui";
import { StatusBadge } from "@/components/StatusBadge";
import { useFormErrors } from "@/components/crud/useFormErrors";
import { useApp } from "@/components/providers/AppProvider";
import { useCollection } from "@/lib/client/api";
import { computeSituation, previousQuantities } from "@/lib/calc/market";
import { todayIso } from "@/lib/calc/money";
import { ENUMS, type Market, type Situation } from "@/lib/schemas";

function SituationEditor({
  market,
  situations,
  situation,
  onClose,
}: {
  market: Market;
  situations: Situation[];
  situation: Situation | null;
  onClose: () => void;
}) {
  const { t, money, number, enumLabel, can, toast } = useApp();
  const { create, update } = useCollection("situations");
  const nextNumber = situation?.number ?? (situations.length ? Math.max(...situations.map((s) => s.number)) + 1 : 1);
  const previous = useMemo(() => previousQuantities(situations, market.id, nextNumber), [situations, market.id, nextNumber]);
  const [quantities, setQuantities] = useState<Record<string, number>>(situation?.quantities ?? { ...previous });
  const [meta, setMeta] = useState({
    date: situation?.date ?? todayIso(),
    periodFrom: situation?.periodFrom ?? "",
    periodTo: situation?.periodTo ?? todayIso(),
    penalties: situation?.penalties ?? 0,
    status: situation?.status ?? "draft",
    notes: situation?.notes ?? "",
  });
  const [busy, setBusy] = useState(false);
  const { handle } = useFormErrors();
  const writable = can("situations", "write");
  const result = computeSituation(market, quantities, previous, Number(meta.penalties) || 0);

  async function save() {
    setBusy(true);
    try {
      const body = { ...meta, marketId: market.id, number: nextNumber, quantities };
      if (situation) await update(situation.id, body);
      else await create(body);
      toast(t("common.saved"));
      onClose();
    } catch (err) {
      handle(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={t("markets.situation", { number: nextNumber })}
      footer={
        writable ? (
          <>
            <Button variant="secondary" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button loading={busy} onClick={save}>
              {t("common.save")}
            </Button>
          </>
        ) : undefined
      }
    >
      <fieldset disabled={!writable} className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <Field label={t("fields.date")}>
            <Input type="date" value={meta.date} onChange={(e) => setMeta({ ...meta, date: e.target.value })} />
          </Field>
          <Field label={t("fields.periodFrom")}>
            <Input type="date" value={meta.periodFrom} onChange={(e) => setMeta({ ...meta, periodFrom: e.target.value })} />
          </Field>
          <Field label={t("fields.periodTo")}>
            <Input type="date" value={meta.periodTo} onChange={(e) => setMeta({ ...meta, periodTo: e.target.value })} />
          </Field>
          <Field label={t("fields.penalties")}>
            <Input type="number" dir="ltr" value={meta.penalties} onChange={(e) => setMeta({ ...meta, penalties: Number(e.target.value) })} />
          </Field>
          <Field label={t("fields.status")}>
            <Select value={meta.status} onChange={(e) => setMeta({ ...meta, status: e.target.value })}>
              {ENUMS.situationStatus.map((s) => (
                <option key={s} value={s}>
                  {enumLabel("situationStatus", s)}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="scrollbar-thin relative overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-xs">
            <thead className="bg-surface-2 text-[10px] text-muted uppercase">
              <tr>
                <th className="px-2 py-2 text-start">{t("fields.code")}</th>
                <th className="min-w-56 px-2 py-2 text-start">{t("fields.designation")}</th>
                <th className="px-2 py-2">{t("fields.unit")}</th>
                <th className="px-2 py-2 text-end">{t("markets.contractQty")}</th>
                <th className="px-2 py-2 text-end">{t("markets.previousQty")}</th>
                <th className="w-32 px-2 py-2 text-end">{t("markets.cumulativeQty")}</th>
                <th className="px-2 py-2 text-end">{t("markets.currentQty")}</th>
                <th className="px-2 py-2 text-end">{t("markets.currentAmount")}</th>
                <th className="px-2 py-2 text-end">{t("markets.cumulativeAmount")}</th>
              </tr>
            </thead>
            <tbody>
              {result.lines.map((l) => (
                <tr key={l.itemId} className="border-t border-border">
                  <td className="px-2 py-1.5 font-mono">{l.code}</td>
                  <td className="px-2 py-1.5">{l.designation}</td>
                  <td className="px-2 py-1.5 text-center">{l.unit}</td>
                  <td className="num px-2 py-1.5 text-end">{number(l.contractQty)}</td>
                  <td className="num px-2 py-1.5 text-end text-muted">{number(l.previousQty)}</td>
                  <td className="px-2 py-1">
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        dir="ltr"
                        min={l.previousQty}
                        max={l.contractQty}
                        value={quantities[l.itemId] ?? 0}
                        onChange={(e) => setQuantities({ ...quantities, [l.itemId]: Number(e.target.value) })}
                        className="h-8 text-end text-xs"
                      />
                      <button
                        type="button"
                        title={t("markets.fillAll")}
                        onClick={() => setQuantities({ ...quantities, [l.itemId]: l.contractQty })}
                        className="rounded p-1 text-muted hover:text-primary"
                      >
                        <CheckCheck className="size-3.5" />
                      </button>
                    </div>
                  </td>
                  <td className="num px-2 py-1.5 text-end font-semibold">{number(l.currentQty)}</td>
                  <td className="num px-2 py-1.5 text-end">{money(l.currentAmount)}</td>
                  <td className="num px-2 py-1.5 text-end text-muted">{money(l.cumulativeAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="ms-auto w-full max-w-md rounded-xl border border-border text-sm">
          {[
            [t("markets.previousAmount"), result.previousHT],
            [t("markets.currentAmount"), result.currentHT],
            [t("markets.cumulativeAmount"), result.cumulativeHT],
            [t("markets.revisionAmount"), result.revision],
            [t("documents.tva", { rate: market.tvaRate }), result.tva],
            [t("documents.totalTTC"), result.currentTTC],
            [`− ${t("markets.guarantee")} (${market.guaranteeRate} %)`, result.guarantee],
            [`− ${t("markets.advanceRepayment")} (${market.advanceRate} %)`, result.advanceRepayment],
            [`− ${t("fields.penalties")}`, result.penalties],
          ].map(([label, v]) => (
            <div key={String(label)} className="flex justify-between border-b border-border px-4 py-2">
              <span className="text-muted">{label}</span>
              <span className="num">{money(Number(v))}</span>
            </div>
          ))}
          <div className="flex justify-between rounded-b-xl bg-primary-soft px-4 py-3 font-bold text-primary">
            <span>{t("markets.netToPay")}</span>
            <span className="num">{money(result.netToPay)}</span>
          </div>
        </div>
      </fieldset>
    </Modal>
  );
}

export function SituationsTab({ market, situations }: { market: Market; situations: Situation[] }) {
  const { t, money, date, can, toast, errorMessage } = useApp();
  const { remove } = useCollection("situations");
  const [editor, setEditor] = useState<{ situation: Situation | null } | null>(null);
  const writable = can("situations", "write");

  const rows = situations.map((s) => ({ s, r: computeSituation(market, s.quantities, previousQuantities(situations, market.id, s.number), s.penalties) }));

  async function destroy(s: Situation) {
    if (!confirm(t("common.confirmDelete"))) return;
    try {
      await remove(s.id);
      toast(t("common.deleted"));
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  }

  return (
    <Card
      title={t("markets.situations")}
      padded={false}
      actions={
        writable &&
        market.items.length > 0 && (
          <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setEditor({ situation: null })}>
            {t("markets.newSituation")}
          </Button>
        )
      }
    >
      {market.items.length === 0 ? (
        <EmptyState title={t("markets.noItems")} />
      ) : rows.length === 0 ? (
        <EmptyState icon={<FileText className="size-6" />} title={t("markets.noSituations")} />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>N°</Th>
              <Th>{t("fields.date")}</Th>
              <Th>{t("fields.period")}</Th>
              <Th align="end">{t("markets.currentAmount")}</Th>
              <Th align="end">{t("markets.cumulativeAmount")}</Th>
              <Th align="end">{t("markets.netToPay")}</Th>
              <Th align="end">%</Th>
              <Th>{t("fields.status")}</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ s, r }) => (
              <tr key={s.id} className="hover:bg-surface-2/60">
                <Td className="num font-semibold">{s.number}</Td>
                <Td className="num">{date(s.date)}</Td>
                <Td className="num text-xs text-muted">
                  {date(s.periodFrom)} → {date(s.periodTo)}
                </Td>
                <Td align="end" className="num">
                  {money(r.currentHT)}
                </Td>
                <Td align="end" className="num text-muted">
                  {money(r.cumulativeHT)}
                </Td>
                <Td align="end" className="num font-semibold text-primary">
                  {money(r.netToPay)}
                </Td>
                <Td align="end" className="num">
                  {Math.round(r.progress)}
                </Td>
                <Td>
                  <StatusBadge enumKey="situationStatus" value={s.status} />
                </Td>
                <Td align="end">
                  <div className="flex justify-end gap-1">
                    <a href={`/print/situation/${s.id}`} target="_blank" className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-muted hover:bg-surface-2 hover:text-text">
                      <Printer className="size-3.5" /> {t("markets.printSituation")}
                    </a>
                    <a href={`/print/attachment/${s.id}`} target="_blank" className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-muted hover:bg-surface-2 hover:text-text">
                      <Printer className="size-3.5" /> {t("markets.printAttachment")}
                    </a>
                    <button onClick={() => setEditor({ situation: s })} className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-text" aria-label={t("common.edit")}>
                      <Pencil className="size-4" />
                    </button>
                    {writable && (
                      <button onClick={() => destroy(s)} className="rounded-lg p-2 text-muted hover:bg-danger-soft hover:text-danger" aria-label={t("common.delete")}>
                        <Trash className="size-4" />
                      </button>
                    )}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {editor && <SituationEditor market={market} situations={situations} situation={editor.situation} onClose={() => setEditor(null)} />}
    </Card>
  );
}
