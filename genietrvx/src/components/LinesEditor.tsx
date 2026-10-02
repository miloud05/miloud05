"use client";

import { ArrowDown, ArrowUp, Plus, Trash } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { useApp } from "@/components/providers/AppProvider";
import { lineTotal, type DocumentLine, type DocumentTotals } from "@/lib/calc/documents";

export function LinesEditor({
  lines,
  onChange,
  readOnly,
}: {
  lines: DocumentLine[];
  onChange: (lines: DocumentLine[]) => void;
  readOnly?: boolean;
}) {
  const { t, money, number } = useApp();
  const set = (i: number, patch: Partial<DocumentLine>) => onChange(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= lines.length) return;
    const copy = [...lines];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    onChange(copy);
  };

  return (
    <div>
      <div className="scrollbar-thin relative overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-[11px] text-muted uppercase">
            <tr>
              <th className="w-10 px-2 py-2">#</th>
              <th className="min-w-72 px-2 py-2 text-start">{t("fields.designation")}</th>
              <th className="w-24 px-2 py-2 text-start">{t("fields.unit")}</th>
              <th className="w-28 px-2 py-2 text-end">{t("fields.quantity")}</th>
              <th className="w-36 px-2 py-2 text-end">{t("fields.unitPrice")}</th>
              <th className="w-40 px-2 py-2 text-end">{t("documents.lineTotal")}</th>
              {!readOnly && <th className="w-24" />}
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted">
                  {t("common.empty")}
                </td>
              </tr>
            )}
            {lines.map((l, i) => (
              <tr key={i} className="border-t border-border">
                <td className="num px-2 text-center text-xs text-muted">{i + 1}</td>
                {readOnly ? (
                  <>
                    <td className="px-2 py-2">{l.designation}</td>
                    <td className="px-2 py-2">{l.unit}</td>
                    <td className="num px-2 py-2 text-end">{number(l.quantity)}</td>
                    <td className="num px-2 py-2 text-end">{money(l.unitPrice)}</td>
                  </>
                ) : (
                  <>
                    <td className="px-1.5 py-1.5">
                      <Input value={l.designation} onChange={(e) => set(i, { designation: e.target.value })} className="h-9" aria-label={t("fields.designation")} />
                    </td>
                    <td className="px-1.5 py-1.5">
                      <Input value={l.unit} onChange={(e) => set(i, { unit: e.target.value })} className="h-9" aria-label={t("fields.unit")} />
                    </td>
                    <td className="px-1.5 py-1.5">
                      <Input type="number" dir="ltr" value={l.quantity} onChange={(e) => set(i, { quantity: Number(e.target.value) })} className="h-9 text-end" aria-label={t("fields.quantity")} />
                    </td>
                    <td className="px-1.5 py-1.5">
                      <Input type="number" dir="ltr" value={l.unitPrice} onChange={(e) => set(i, { unitPrice: Number(e.target.value) })} className="h-9 text-end" aria-label={t("fields.unitPrice")} />
                    </td>
                  </>
                )}
                <td className="num px-2 py-2 text-end font-medium">{money(lineTotal(l))}</td>
                {!readOnly && (
                  <td className="px-1">
                    <div className="flex items-center justify-end">
                      <button onClick={() => move(i, -1)} className="rounded p-1.5 text-muted hover:text-text disabled:opacity-30" disabled={i === 0} aria-label="↑">
                        <ArrowUp className="size-3.5" />
                      </button>
                      <button onClick={() => move(i, 1)} className="rounded p-1.5 text-muted hover:text-text disabled:opacity-30" disabled={i === lines.length - 1} aria-label="↓">
                        <ArrowDown className="size-3.5" />
                      </button>
                      <button onClick={() => onChange(lines.filter((_, j) => j !== i))} className="rounded p-1.5 text-muted hover:text-danger" aria-label={t("common.removeLine")}>
                        <Trash className="size-4" />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!readOnly && (
        <Button
          size="sm"
          variant="secondary"
          className="mt-3"
          icon={<Plus className="size-4" />}
          onClick={() => onChange([...lines, { designation: "", unit: "u", quantity: 1, unitPrice: 0 }])}
        >
          {t("common.addLine")}
        </Button>
      )}
    </div>
  );
}

export function TotalsBox({ totals, tvaRate, discountRate }: { totals: DocumentTotals; tvaRate: number; discountRate: number }) {
  const { t, money } = useApp();
  const rows: Array<[string, number]> = [[t("documents.subtotal"), totals.subtotal]];
  if (discountRate > 0) rows.push([`${t("documents.discount")} (${discountRate} %)`, -totals.discount]);
  rows.push([t("documents.totalHT"), totals.totalHT], [t("documents.tva", { rate: tvaRate }), totals.tva], [t("documents.totalTTC"), totals.totalTTC]);
  if (totals.stamp > 0) rows.push([t("documents.stamp"), totals.stamp]);
  return (
    <div className="w-full max-w-sm rounded-xl border border-border text-sm">
      {rows.map(([label, v]) => (
        <div key={label} className="flex justify-between border-b border-border px-4 py-2">
          <span className="text-muted">{label}</span>
          <span className="num">{money(v)}</span>
        </div>
      ))}
      <div className="flex justify-between rounded-b-xl bg-primary-soft px-4 py-3 font-bold text-primary">
        <span>{t("documents.totalDue")}</span>
        <span className="num">{money(totals.totalDue)}</span>
      </div>
    </div>
  );
}
