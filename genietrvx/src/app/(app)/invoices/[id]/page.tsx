"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Plus, Printer, Save, Trash } from "lucide-react";
import { Button, ButtonLink, Card, EmptyState, Input, PageHeader, ProgressBar, Select, Skeleton } from "@/components/ui";
import { StatusBadge } from "@/components/StatusBadge";
import { FormFields } from "@/components/crud/FormFields";
import { useFormErrors } from "@/components/crud/useFormErrors";
import { LinesEditor, TotalsBox } from "@/components/LinesEditor";
import { useApp } from "@/components/providers/AppProvider";
import { useCollection } from "@/lib/client/api";
import { useSettings } from "@/lib/client/settings";
import { invoiceFigures, type DocumentLine } from "@/lib/calc/documents";
import { todayIso } from "@/lib/calc/money";
import { amountInWordsFr } from "@/lib/calc/words";
import { ENUMS, type Invoice } from "@/lib/schemas";

type Payment = Invoice["payments"][number];

function InvoiceEditor({ invoice }: { invoice: Invoice }) {
  const { t, can, toast, money, enumLabel } = useApp();
  const { update } = useCollection("invoices");
  const { settings } = useSettings();
  const [values, setValues] = useState<Record<string, unknown>>({ ...invoice });
  const [lines, setLines] = useState<DocumentLine[]>(invoice.lines);
  const [payments, setPayments] = useState<Payment[]>(invoice.payments);
  const [busy, setBusy] = useState(false);
  const { errors, handle } = useFormErrors();
  const writable = can("invoices", "write");

  const { totals, balance } = invoiceFigures(
    {
      lines,
      payments,
      discountRate: Number(values.discountRate) || 0,
      tvaRate: Number(values.tvaRate) || 0,
      stampEnabled: values.stampEnabled === true,
    },
    settings.invoicing,
  );

  async function save() {
    setBusy(true);
    try {
      await update(invoice.id, { ...values, lines, payments });
      toast(t("common.saved"));
    } catch (err) {
      handle(err);
    } finally {
      setBusy(false);
    }
  }

  const setPayment = (i: number, patch: Partial<Payment>) => setPayments(payments.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  return (
    <div>
      <PageHeader
        back={
          <Link href="/invoices" className="no-print mb-2 inline-flex items-center gap-1 text-xs text-muted hover:text-primary">
            <ArrowLeft className="size-3.5 rtl:rotate-180" /> {t("invoices.title")}
          </Link>
        }
        title={
          <span className="flex flex-wrap items-center gap-3">
            {t("invoices.editor", { number: invoice.number })}
            {values.status === "issued" ? <StatusBadge enumKey="paymentStatus" value={balance.status} /> : <StatusBadge enumKey="invoiceStatus" value={String(values.status)} />}
          </span>
        }
        actions={
          <>
            <ButtonLink href={`/print/invoice/${invoice.id}`} target="_blank" variant="secondary" icon={<Printer className="size-4" />}>
              {t("common.print")}
            </ButtonLink>
            {writable && (
              <Button icon={<Save className="size-4" />} loading={busy} onClick={save}>
                {t("common.save")}
              </Button>
            )}
          </>
        }
      />
      <div className="flex flex-col gap-6">
        <Card>
          <fieldset disabled={!writable}>
            <FormFields
              values={values}
              errors={errors}
              onChange={(n, v) => setValues((p) => ({ ...p, [n]: v }))}
              fields={[
                { name: "clientId", label: "fields.client", type: "ref", ref: "clients" },
                { name: "projectId", label: "fields.project", type: "ref", ref: "projects" },
                { name: "date", label: "fields.date", type: "date", required: true },
                { name: "dueDate", label: "fields.dueDate", type: "date" },
                { name: "paymentMode", label: "fields.paymentMode", type: "select", enumKey: "paymentMode" },
                { name: "status", label: "fields.status", type: "select", enumKey: "invoiceStatus" },
                { name: "discountRate", label: "fields.discountRate", type: "number", min: 0, max: 100 },
                { name: "tvaRate", label: "fields.tvaRate", type: "number", min: 0, max: 100 },
                { name: "stampEnabled", label: "fields.stampEnabled", type: "checkbox", full: true },
              ]}
            />
          </fieldset>
        </Card>

        <Card title={t("common.lines")}>
          <LinesEditor lines={lines} onChange={setLines} readOnly={!writable} />
          <div className="mt-6 flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="w-full max-w-lg">
              <p className="text-xs text-muted">{t("invoices.inWords")}</p>
              <p className="mt-1 text-sm font-medium first-letter:uppercase" dir="ltr" lang="fr">
                {amountInWordsFr(totals.totalDue)}
              </p>
              <div className="mt-4">
                <FormFields values={values} onChange={(n, v) => setValues((p) => ({ ...p, [n]: v }))} fields={[{ name: "notes", label: "fields.notes", type: "textarea" }]} />
              </div>
            </div>
            <TotalsBox totals={totals} tvaRate={Number(values.tvaRate) || 0} discountRate={Number(values.discountRate) || 0} />
          </div>
        </Card>

        <Card
          title={t("invoices.payments")}
          actions={
            writable && (
              <Button
                size="sm"
                variant="secondary"
                icon={<Plus className="size-4" />}
                onClick={() => setPayments([...payments, { date: todayIso(), amount: balance.remaining, mode: String(values.paymentMode ?? "transfer"), reference: "" }])}
              >
                {t("invoices.addPayment")}
              </Button>
            )
          }
        >
          <div className="mb-4 grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-xl bg-surface-2 p-3">
              <p className="text-xs text-muted">{t("invoices.totalDue")}</p>
              <p className="num font-semibold">{money(totals.totalDue)}</p>
            </div>
            <div className="rounded-xl bg-success-soft p-3">
              <p className="text-xs text-muted">{t("fields.paid")}</p>
              <p className="num font-semibold text-success">{money(balance.paid)}</p>
            </div>
            <div className="rounded-xl bg-warning-soft p-3">
              <p className="text-xs text-muted">{t("fields.remaining")}</p>
              <p className="num font-semibold text-warning">{money(balance.remaining)}</p>
            </div>
          </div>
          <ProgressBar value={totals.totalDue ? (balance.paid / totals.totalDue) * 100 : 0} tone="success" className="mb-4" />
          {payments.length === 0 ? (
            <EmptyState title={t("invoices.noPayments")} />
          ) : (
            <div className="flex flex-col gap-2">
              {payments.map((p, i) => (
                <div key={i} className="grid grid-cols-2 items-center gap-2 rounded-xl border border-border p-2 sm:grid-cols-[160px_1fr_160px_1fr_40px]">
                  <Input disabled={!writable} type="date" value={p.date} onChange={(e) => setPayment(i, { date: e.target.value })} aria-label={t("fields.date")} />
                  <Input disabled={!writable} type="number" dir="ltr" value={p.amount} onChange={(e) => setPayment(i, { amount: Number(e.target.value) })} aria-label={t("fields.amount")} />
                  <Select disabled={!writable} value={p.mode} onChange={(e) => setPayment(i, { mode: e.target.value })} aria-label={t("fields.paymentMode")}>
                    {ENUMS.paymentMode.map((m) => (
                      <option key={m} value={m}>
                        {enumLabel("paymentMode", m)}
                      </option>
                    ))}
                  </Select>
                  <Input disabled={!writable} value={p.reference} placeholder={t("fields.reference")} onChange={(e) => setPayment(i, { reference: e.target.value })} />
                  {writable && (
                    <button onClick={() => setPayments(payments.filter((_, j) => j !== i))} className="rounded-lg p-2 text-muted hover:text-danger" aria-label={t("common.delete")}>
                      <Trash className="size-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

export default function InvoicePage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useApp();
  const { data, ready } = useCollection("invoices");
  const invoice = data.find((x) => x.id === id);
  if (!ready) return <Skeleton className="h-96" />;
  if (!invoice) return <EmptyState title={t("common.notFound")} action={<ButtonLink href="/invoices" variant="secondary">{t("common.back")}</ButtonLink>} />;
  return <InvoiceEditor key={invoice.id} invoice={invoice} />;
}
