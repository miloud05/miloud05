"use client";

import { useState } from "react";
import { ClipboardPaste, Plus, Save, Trash } from "lucide-react";
import { Button, Card, EmptyState, Input, Modal, Textarea } from "@/components/ui";
import { useApp } from "@/components/providers/AppProvider";
import { useCollection } from "@/lib/client/api";
import { computeDqeTotals, type DqeItem } from "@/lib/calc/market";
import { newId, parsePastedItems } from "@/lib/calc/paste";
import { round2 } from "@/lib/calc/money";
import type { Market } from "@/lib/schemas";

export function DqeTab({ market }: { market: Market }) {
  const { t, money, can, toast, errorMessage } = useApp();
  const { update } = useCollection("markets");
  const [items, setItems] = useState<DqeItem[]>(market.items);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [paste, setPaste] = useState<string | null>(null);
  const writable = can("markets", "write");
  const totals = computeDqeTotals(items, market.tvaRate, market.amendments);

  function change(i: number, patch: Partial<DqeItem>) {
    setItems((prev) => prev.map((it, j) => (j === i ? { ...it, ...patch } : it)));
    setDirty(true);
  }

  async function save() {
    setBusy(true);
    try {
      await update(market.id, { items });
      setDirty(false);
      toast(t("common.saved"));
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  function importPasted() {
    const parsed = parsePastedItems(paste ?? "");
    setItems((prev) => [...prev, ...parsed]);
    setDirty(true);
    setPaste(null);
    toast(t("markets.importDone", { count: parsed.length }), "info");
  }

  return (
    <Card
      title={t("markets.dqe")}
      padded={false}
      actions={
        writable && (
          <>
            <Button size="sm" variant="secondary" icon={<ClipboardPaste className="size-4" />} onClick={() => setPaste("")}>
              {t("markets.importItems")}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              icon={<Plus className="size-4" />}
              onClick={() => {
                setItems([...items, { id: newId(), code: "", designation: "", unit: "u", quantity: 0, unitPrice: 0 }]);
                setDirty(true);
              }}
            >
              {t("markets.addItem")}
            </Button>
            <Button size="sm" icon={<Save className="size-4" />} loading={busy} disabled={!dirty} onClick={save}>
              {t("common.save")}
            </Button>
          </>
        )
      }
    >
      {items.length === 0 ? (
        <EmptyState title={t("markets.noItems")} />
      ) : (
        <div className="scrollbar-thin relative overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-2 text-[11px] text-muted uppercase">
                <th className="w-20 px-3 py-2 text-start">{t("fields.code")}</th>
                <th className="min-w-72 px-3 py-2 text-start">{t("fields.designation")}</th>
                <th className="w-20 px-3 py-2 text-start">{t("fields.unit")}</th>
                <th className="w-28 px-3 py-2 text-end">{t("fields.quantity")}</th>
                <th className="w-36 px-3 py-2 text-end">{t("fields.unitPrice")}</th>
                <th className="w-40 px-3 py-2 text-end">{t("documents.lineTotal")}</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={it.id} className="border-t border-border">
                  {writable ? (
                    <>
                      <td className="px-2 py-1.5">
                        <Input value={it.code} onChange={(e) => change(i, { code: e.target.value })} className="h-9" dir="ltr" />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input value={it.designation} onChange={(e) => change(i, { designation: e.target.value })} className="h-9" />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input value={it.unit} onChange={(e) => change(i, { unit: e.target.value })} className="h-9" />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input type="number" dir="ltr" value={it.quantity} onChange={(e) => change(i, { quantity: Number(e.target.value) })} className="h-9 text-end" />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input type="number" dir="ltr" value={it.unitPrice} onChange={(e) => change(i, { unitPrice: Number(e.target.value) })} className="h-9 text-end" />
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-2 font-mono text-xs">{it.code}</td>
                      <td className="px-3 py-2">{it.designation}</td>
                      <td className="px-3 py-2">{it.unit}</td>
                      <td className="num px-3 py-2 text-end">{it.quantity}</td>
                      <td className="num px-3 py-2 text-end">{money(it.unitPrice)}</td>
                    </>
                  )}
                  <td className="num px-3 py-2 text-end font-medium">{money(round2(it.quantity * it.unitPrice))}</td>
                  <td className="px-1">
                    {writable && (
                      <button
                        onClick={() => {
                          setItems(items.filter((_, j) => j !== i));
                          setDirty(true);
                        }}
                        className="rounded-lg p-2 text-muted hover:text-danger"
                        aria-label={t("common.removeLine")}
                      >
                        <Trash className="size-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="text-sm">
              {[
                [t("markets.baseAmount"), totals.baseHT],
                [t("markets.amendmentsAmount"), totals.amendmentsHT],
                [t("documents.totalHT"), totals.totalHT],
                [t("documents.tva", { rate: market.tvaRate }), totals.tva],
                [t("documents.totalTTC"), totals.totalTTC],
              ].map(([label, value], i) => (
                <tr key={i} className={i === 4 ? "bg-primary-soft font-bold text-primary" : "bg-surface-2"}>
                  <td colSpan={5} className="px-3 py-2 text-end">
                    {label}
                  </td>
                  <td className="num px-3 py-2 text-end">{money(Number(value))}</td>
                  <td />
                </tr>
              ))}
            </tfoot>
          </table>
        </div>
      )}

      <Modal
        open={paste !== null}
        onClose={() => setPaste(null)}
        title={t("markets.importItems")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPaste(null)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={importPasted} disabled={!paste?.trim()}>
              {t("common.upload")}
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-muted">{t("markets.importHint")}</p>
        <Textarea dir="ltr" value={paste ?? ""} onChange={(e) => setPaste(e.target.value)} className="min-h-64 font-mono text-xs" />
      </Modal>
    </Card>
  );
}
