"use client";

import { useState } from "react";
import { Plus, Save, Trash } from "lucide-react";
import { Badge, Button, Card, Input, Select } from "@/components/ui";
import { useApp } from "@/components/providers/AppProvider";
import { useCollection } from "@/lib/client/api";
import { addDays, todayIso } from "@/lib/calc/money";
import { ENUMS, type Market } from "@/lib/schemas";

export function ContractTab({ market }: { market: Market }) {
  const { t, money, can, toast, errorMessage, enumLabel } = useApp();
  const { update } = useCollection("markets");
  const [amendments, setAmendments] = useState(market.amendments);
  const [bonds, setBonds] = useState(market.bonds);
  const [busy, setBusy] = useState(false);
  const writable = can("markets", "write");
  const today = todayIso();

  async function save() {
    setBusy(true);
    try {
      await update(market.id, { amendments, bonds });
      toast(t("common.saved"));
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  const cell = "px-2 py-1.5";
  return (
    <div className="flex flex-col gap-6">
      <Card
        title={t("markets.amendments")}
        padded={false}
        actions={
          writable && (
            <>
              <Button
                size="sm"
                variant="secondary"
                icon={<Plus className="size-4" />}
                onClick={() => setAmendments([...amendments, { number: String(amendments.length + 1).padStart(2, "0"), date: today, object: "", amount: 0, extraDays: 0 }])}
              >
                {t("markets.newAmendment")}
              </Button>
              <Button size="sm" icon={<Save className="size-4" />} loading={busy} onClick={save}>
                {t("common.save")}
              </Button>
            </>
          )
        }
      >
        <div className="scrollbar-thin relative overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-[11px] text-muted uppercase">
              <tr>
                <th className="w-24 px-3 py-2 text-start">{t("fields.number")}</th>
                <th className="w-40 px-3 py-2 text-start">{t("fields.date")}</th>
                <th className="min-w-64 px-3 py-2 text-start">{t("fields.object")}</th>
                <th className="w-44 px-3 py-2 text-end">{t("fields.amount")}</th>
                <th className="w-32 px-3 py-2 text-end">{t("markets.extraDays")}</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {amendments.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-muted">
                    {t("common.empty")}
                  </td>
                </tr>
              )}
              {amendments.map((a, i) => {
                const set = (patch: Partial<typeof a>) => setAmendments(amendments.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                return (
                  <tr key={i} className="border-t border-border">
                    <td className={cell}>
                      <Input disabled={!writable} value={a.number} onChange={(e) => set({ number: e.target.value })} className="h-9" />
                    </td>
                    <td className={cell}>
                      <Input disabled={!writable} type="date" value={a.date} onChange={(e) => set({ date: e.target.value })} className="h-9" />
                    </td>
                    <td className={cell}>
                      <Input disabled={!writable} value={a.object} onChange={(e) => set({ object: e.target.value })} className="h-9" />
                    </td>
                    <td className={cell}>
                      <Input disabled={!writable} type="number" dir="ltr" value={a.amount} onChange={(e) => set({ amount: Number(e.target.value) })} className="h-9 text-end" />
                    </td>
                    <td className={cell}>
                      <Input disabled={!writable} type="number" dir="ltr" value={a.extraDays} onChange={(e) => set({ extraDays: Number(e.target.value) })} className="h-9 text-end" />
                    </td>
                    <td className="px-1">
                      {writable && (
                        <button onClick={() => setAmendments(amendments.filter((_, j) => j !== i))} className="rounded-lg p-2 text-muted hover:text-danger" aria-label={t("common.removeLine")}>
                          <Trash className="size-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {amendments.length > 0 && (
              <tfoot>
                <tr className="bg-surface-2 font-semibold">
                  <td colSpan={3} className="px-3 py-2 text-end">
                    {t("common.total")}
                  </td>
                  <td className="num px-3 py-2 text-end">{money(amendments.reduce((s, a) => s + (Number(a.amount) || 0), 0))}</td>
                  <td className="num px-3 py-2 text-end">{amendments.reduce((s, a) => s + (Number(a.extraDays) || 0), 0)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>

      <Card
        title={t("markets.bonds")}
        padded={false}
        actions={
          writable && (
            <>
              <Button
                size="sm"
                variant="secondary"
                icon={<Plus className="size-4" />}
                onClick={() => setBonds([...bonds, { type: "performance", bank: "", amount: 0, issueDate: today, expiryDate: addDays(today, 365) }])}
              >
                {t("markets.newBond")}
              </Button>
              <Button size="sm" icon={<Save className="size-4" />} loading={busy} onClick={save}>
                {t("common.save")}
              </Button>
            </>
          )
        }
      >
        <div className="scrollbar-thin relative overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-[11px] text-muted uppercase">
              <tr>
                <th className="min-w-56 px-3 py-2 text-start">{t("fields.type")}</th>
                <th className="min-w-40 px-3 py-2 text-start">{t("markets.bank")}</th>
                <th className="w-44 px-3 py-2 text-end">{t("fields.amount")}</th>
                <th className="w-40 px-3 py-2 text-start">{t("markets.issueDate")}</th>
                <th className="w-48 px-3 py-2 text-start">{t("markets.expiryDate")}</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {bonds.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-muted">
                    {t("common.empty")}
                  </td>
                </tr>
              )}
              {bonds.map((b, i) => {
                const set = (patch: Partial<typeof b>) => setBonds(bonds.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                const expiring = b.expiryDate && b.expiryDate <= addDays(today, 30);
                return (
                  <tr key={i} className="border-t border-border">
                    <td className={cell}>
                      <Select disabled={!writable} value={b.type} onChange={(e) => set({ type: e.target.value })} className="h-9">
                        {ENUMS.bondType.map((x) => (
                          <option key={x} value={x}>
                            {enumLabel("bondType", x)}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className={cell}>
                      <Input disabled={!writable} value={b.bank} onChange={(e) => set({ bank: e.target.value })} className="h-9" />
                    </td>
                    <td className={cell}>
                      <Input disabled={!writable} type="number" dir="ltr" value={b.amount} onChange={(e) => set({ amount: Number(e.target.value) })} className="h-9 text-end" />
                    </td>
                    <td className={cell}>
                      <Input disabled={!writable} type="date" value={b.issueDate} onChange={(e) => set({ issueDate: e.target.value })} className="h-9" />
                    </td>
                    <td className={cell}>
                      <div className="flex items-center gap-2">
                        <Input disabled={!writable} type="date" value={b.expiryDate} onChange={(e) => set({ expiryDate: e.target.value })} className="h-9" />
                        {expiring && <Badge tone={b.expiryDate < today ? "danger" : "warning"}>!</Badge>}
                      </div>
                    </td>
                    <td className="px-1">
                      {writable && (
                        <button onClick={() => setBonds(bonds.filter((_, j) => j !== i))} className="rounded-lg p-2 text-muted hover:text-danger" aria-label={t("common.removeLine")}>
                          <Trash className="size-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
