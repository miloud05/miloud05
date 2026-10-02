"use client";

import { useState } from "react";
import { Pencil, Plus, Printer, Trash } from "lucide-react";
import { Button, Card, EmptyState, Modal, Table, Td, Th } from "@/components/ui";
import { StatusBadge } from "@/components/StatusBadge";
import { FormFields } from "@/components/crud/FormFields";
import { useFormErrors } from "@/components/crud/useFormErrors";
import { useApp } from "@/components/providers/AppProvider";
import { useCollection } from "@/lib/client/api";
import { todayIso } from "@/lib/calc/money";
import type { Market, Ods } from "@/lib/schemas";

export function OdsTab({ market, ods }: { market: Market; ods: Ods[] }) {
  const { t, date, can, toast, errorMessage } = useApp();
  const { create, update, remove } = useCollection("ods");
  const [editing, setEditing] = useState<Ods | null | undefined>(undefined);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);
  const { errors, handle, clear } = useFormErrors();
  const writable = can("ods", "write");

  function open(o: Ods | null) {
    clear();
    setEditing(o);
    setValues(o ? { ...o } : { marketId: market.id, type: "start", date: todayIso() });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (editing) await update(editing.id, values);
      else await create({ ...values, marketId: market.id });
      toast(t("common.saved"));
      setEditing(undefined);
    } catch (err) {
      handle(err);
    } finally {
      setBusy(false);
    }
  }

  async function destroy(o: Ods) {
    if (!confirm(t("common.confirmDelete"))) return;
    try {
      await remove(o.id);
      toast(t("common.deleted"));
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  }

  const sorted = [...ods].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <Card
      title={t("markets.ods")}
      padded={false}
      actions={
        writable && (
          <Button size="sm" icon={<Plus className="size-4" />} onClick={() => open(null)}>
            {t("markets.newOds")}
          </Button>
        )
      }
    >
      {sorted.length === 0 ? (
        <EmptyState title={t("common.empty")} />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>{t("fields.number")}</Th>
              <Th>{t("fields.date")}</Th>
              <Th>{t("fields.type")}</Th>
              <Th>{t("fields.subject")}</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {sorted.map((o) => (
              <tr key={o.id}>
                <Td className="num font-mono text-xs">{o.number}</Td>
                <Td className="num">{date(o.date)}</Td>
                <Td>
                  <StatusBadge enumKey="odsType" value={o.type} />
                </Td>
                <Td>{o.subject}</Td>
                <Td align="end">
                  <div className="flex justify-end gap-1">
                    <a href={`/print/ods/${o.id}`} target="_blank" className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-text" title={t("common.print")}>
                      <Printer className="size-4" />
                    </a>
                    {writable && (
                      <>
                        <button onClick={() => open(o)} className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-text" aria-label={t("common.edit")}>
                          <Pencil className="size-4" />
                        </button>
                        <button onClick={() => destroy(o)} className="rounded-lg p-2 text-muted hover:bg-danger-soft hover:text-danger" aria-label={t("common.delete")}>
                          <Trash className="size-4" />
                        </button>
                      </>
                    )}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <Modal
        open={editing !== undefined}
        onClose={() => setEditing(undefined)}
        title={editing ? t("common.edit") : t("markets.newOds")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(undefined)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" form="ods-form" loading={busy}>
              {t("common.save")}
            </Button>
          </>
        }
      >
        <form id="ods-form" onSubmit={save} noValidate>
          <FormFields
            values={values}
            errors={errors}
            onChange={(n, v) => setValues((p) => ({ ...p, [n]: v }))}
            fields={[
              { name: "number", label: "fields.number", ltr: true, hint: "common.optional" },
              { name: "date", label: "fields.date", type: "date", required: true },
              { name: "type", label: "fields.type", type: "select", enumKey: "odsType" },
              { name: "subject", label: "fields.subject", required: true, full: true },
              { name: "description", label: "fields.description", type: "textarea" },
            ]}
          />
        </form>
      </Modal>
    </Card>
  );
}
