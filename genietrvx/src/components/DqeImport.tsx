"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileSpreadsheet, Upload } from "lucide-react";
import { Button, Modal, Textarea } from "@/components/ui";
import { FormFields } from "@/components/crud/FormFields";
import { useFormErrors } from "@/components/crud/useFormErrors";
import { useApp } from "@/components/providers/AppProvider";
import { uploadSpreadsheet, useCollection } from "@/lib/client/api";
import { dqeBaseHT, type DqeItem } from "@/lib/calc/market";
import { parsePastedItems } from "@/lib/calc/paste";
import { round2, todayIso } from "@/lib/calc/money";

const ACCEPT = ".xlsx,.xlsm,.csv,.tsv,.txt";

/** Bouton « Importer un fichier » : envoie le tableur et renvoie les articles détectés. */
export function DqeFileButton({
  onItems,
  label,
  variant = "secondary",
  size = "sm",
}: {
  onItems: (items: DqeItem[], fileName: string) => void;
  label?: string;
  variant?: "primary" | "secondary";
  size?: "sm" | "md";
}) {
  const { t, toast, errorMessage } = useApp();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handle(file: File) {
    setBusy(true);
    try {
      const res = await uploadSpreadsheet(file);
      onItems(res.items, res.fileName);
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <>
      <Button variant={variant} size={size} loading={busy} icon={<Upload className="size-4" />} onClick={() => input.current?.click()}>
        {label ?? t("markets.importFromFile")}
      </Button>
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        className="hidden"
        data-testid="dqe-file-input"
        onChange={(e) => e.target.files?.[0] && handle(e.target.files[0])}
      />
    </>
  );
}

/** Assistant d'import : fichier Excel/CSV (ou copier-coller) → aperçu du DQE → création du marché. */
export function ImportMarketDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, money, number, toast } = useApp();
  const router = useRouter();
  const { create } = useCollection("markets");
  const [items, setItems] = useState<DqeItem[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [pasted, setPasted] = useState("");
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);
  const { errors, handle, clear } = useFormErrors();

  function reset() {
    setItems(null);
    setFileName("");
    setPasted("");
    clear();
  }

  function close() {
    reset();
    onClose();
  }

  function accept(list: DqeItem[], name: string) {
    setItems(list);
    setFileName(name);
    const base = name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
    setValues({
      object: base,
      kind: "public",
      status: "ongoing",
      tvaRate: 19,
      guaranteeRate: 5,
      advanceRate: 15,
      penaltyRatePerMille: 1,
      penaltyCapPercent: 10,
      revisionCoefficient: 1,
      signDate: todayIso(),
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!items?.length) return;
    setBusy(true);
    try {
      const doc = await create({ ...values, items });
      toast(t("markets.importCreated", { count: items.length }));
      close();
      router.push(`/markets/${doc.id}`);
    } catch (err) {
      handle(err);
    } finally {
      setBusy(false);
    }
  }

  const total = items ? round2(dqeBaseHT(items)) : 0;

  return (
    <Modal
      open={open}
      onClose={close}
      size="xl"
      title={t("markets.importTitle")}
      footer={
        items && items.length > 0 ? (
          <>
            <Button variant="ghost" className="me-auto" icon={<ArrowLeft className="size-4 rtl:rotate-180" />} onClick={reset}>
              {t("markets.importChangeFile")}
            </Button>
            <Button variant="secondary" onClick={close}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" form="import-market-form" loading={busy}>
              {t("markets.importCreate")}
            </Button>
          </>
        ) : undefined
      }
    >
      {!items ? (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-border px-6 py-10 text-center">
            <div className="grid size-12 place-items-center rounded-2xl bg-primary-soft text-primary">
              <FileSpreadsheet className="size-6" />
            </div>
            <DqeFileButton onItems={accept} label={t("markets.importChoose")} variant="primary" size="md" />
            <p className="max-w-lg text-xs text-muted">{t("markets.importHintFile")}</p>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">{t("markets.importOrPaste")}</p>
            <Textarea dir="ltr" value={pasted} onChange={(e) => setPasted(e.target.value)} className="min-h-32 font-mono text-xs" placeholder={t("markets.importHint")} />
            <Button className="mt-2" size="sm" variant="secondary" disabled={!pasted.trim()} onClick={() => accept(parsePastedItems(pasted), "Excel")}>
              {t("markets.importAnalyze")}
            </Button>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <p className="max-w-md text-sm text-danger">{t("markets.importNone")}</p>
          <Button variant="secondary" onClick={reset}>
            {t("markets.importChangeFile")}
          </Button>
        </div>
      ) : (
        <form id="import-market-form" onSubmit={submit} noValidate className="flex flex-col gap-5">
          <p className="rounded-xl bg-success-soft px-4 py-3 text-sm font-medium text-success">
            {t("markets.importDetected", { count: items.length, file: fileName, total: money(total) })}
          </p>
          <div className="scrollbar-thin relative max-h-64 overflow-auto rounded-xl border border-border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-surface-2 text-[10px] text-muted uppercase">
                <tr>
                  <th className="px-2 py-2 text-start">{t("fields.code")}</th>
                  <th className="px-2 py-2 text-start">{t("fields.designation")}</th>
                  <th className="px-2 py-2">{t("fields.unit")}</th>
                  <th className="px-2 py-2 text-end">{t("fields.quantity")}</th>
                  <th className="px-2 py-2 text-end">{t("fields.unitPrice")}</th>
                  <th className="px-2 py-2 text-end">{t("documents.lineTotal")}</th>
                </tr>
              </thead>
              <tbody>
                {items.slice(0, 100).map((it) => (
                  <tr key={it.id} className="border-t border-border">
                    <td className="px-2 py-1.5 font-mono">{it.code}</td>
                    <td className="px-2 py-1.5">{it.designation}</td>
                    <td className="px-2 py-1.5 text-center">{it.unit}</td>
                    <td className="num px-2 py-1.5 text-end">{number(it.quantity)}</td>
                    <td className="num px-2 py-1.5 text-end">{money(it.unitPrice)}</td>
                    <td className="num px-2 py-1.5 text-end">{money(round2(it.quantity * it.unitPrice))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {items.length > 100 && <p className="px-3 py-2 text-xs text-muted">{t("markets.importPreviewMore", { count: items.length - 100 })}</p>}
          </div>
          <FormFields
            values={values}
            errors={errors}
            onChange={(n, v) => setValues((p) => ({ ...p, [n]: v }))}
            fields={[
              { name: "object", label: "fields.object", required: true, full: true },
              { name: "reference", label: "fields.reference", ltr: true },
              { name: "kind", label: "fields.kind", type: "select", enumKey: "marketKind" },
              { name: "clientId", label: "fields.client", type: "ref", ref: "clients" },
              { name: "projectId", label: "fields.project", type: "ref", ref: "projects" },
              { name: "startDate", label: "fields.odsDate", type: "date" },
              { name: "durationDays", label: "fields.durationDays", type: "number", step: "1" },
              { name: "tvaRate", label: "fields.tvaRate", type: "number" },
              { name: "guaranteeRate", label: "fields.guaranteeRate", type: "number" },
            ]}
          />
        </form>
      )}
    </Modal>
  );
}
