"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, FileOutput, Printer, Save } from "lucide-react";
import { Button, ButtonLink, Card, EmptyState, PageHeader, Skeleton } from "@/components/ui";
import { StatusBadge } from "@/components/StatusBadge";
import { FormFields } from "@/components/crud/FormFields";
import { useFormErrors } from "@/components/crud/useFormErrors";
import { LinesEditor, TotalsBox } from "@/components/LinesEditor";
import { useApp } from "@/components/providers/AppProvider";
import { useCollection } from "@/lib/client/api";
import { useSettings } from "@/lib/client/settings";
import { computeDocumentTotals, type DocumentLine } from "@/lib/calc/documents";
import { addDays, todayIso } from "@/lib/calc/money";
import type { Quote } from "@/lib/schemas";

function QuoteEditor({ quote }: { quote: Quote }) {
  const { t, can, toast } = useApp();
  const router = useRouter();
  const { update } = useCollection("quotes");
  const invoices = useCollection("invoices", can("invoices"));
  const { settings } = useSettings();
  const [values, setValues] = useState<Record<string, unknown>>({ ...quote });
  const [lines, setLines] = useState<DocumentLine[]>(quote.lines);
  const [busy, setBusy] = useState(false);
  const [converting, setConverting] = useState(false);
  const { errors, handle } = useFormErrors();
  const writable = can("quotes", "write");
  const totals = computeDocumentTotals(lines, { discountRate: Number(values.discountRate) || 0, tvaRate: Number(values.tvaRate) || 0 });

  async function save() {
    setBusy(true);
    try {
      await update(quote.id, { ...values, lines });
      toast(t("common.saved"));
    } catch (err) {
      handle(err);
    } finally {
      setBusy(false);
    }
  }

  async function convert() {
    setConverting(true);
    try {
      await update(quote.id, { ...values, lines, status: "accepted" });
      const inv = await invoices.create({
        clientId: values.clientId,
        quoteId: quote.id,
        date: todayIso(),
        dueDate: addDays(todayIso(), settings.invoicing.paymentTermsDays),
        lines,
        discountRate: values.discountRate,
        tvaRate: values.tvaRate,
        paymentMode: "transfer",
        status: "issued",
        notes: `${t("print.quote")} ${quote.number}`,
      });
      toast(t("quotes.converted", { number: inv.number }));
      router.push(`/invoices/${inv.id}`);
    } catch (err) {
      handle(err);
    } finally {
      setConverting(false);
    }
  }

  return (
    <div>
      <PageHeader
        back={
          <Link href="/quotes" className="no-print mb-2 inline-flex items-center gap-1 text-xs text-muted hover:text-primary">
            <ArrowLeft className="size-3.5 rtl:rotate-180" /> {t("quotes.title")}
          </Link>
        }
        title={
          <span className="flex items-center gap-3">
            {t("quotes.editor", { number: quote.number })} <StatusBadge enumKey="quoteStatus" value={String(values.status)} />
          </span>
        }
        actions={
          <>
            <ButtonLink href={`/print/quote/${quote.id}`} target="_blank" variant="secondary" icon={<Printer className="size-4" />}>
              {t("common.print")}
            </ButtonLink>
            {writable && can("invoices", "write") && (
              <Button variant="secondary" icon={<FileOutput className="size-4" />} loading={converting} onClick={convert} disabled={!lines.length}>
                {t("quotes.convert")}
              </Button>
            )}
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
                { name: "projectName", label: "fields.projectName" },
                { name: "date", label: "fields.date", type: "date", required: true },
                { name: "validUntil", label: "fields.validUntil", type: "date" },
                { name: "status", label: "fields.status", type: "select", enumKey: "quoteStatus" },
                { name: "discountRate", label: "fields.discountRate", type: "number", min: 0, max: 100 },
                { name: "tvaRate", label: "fields.tvaRate", type: "number", min: 0, max: 100 },
              ]}
            />
          </fieldset>
        </Card>
        <Card title={t("common.lines")}>
          <LinesEditor lines={lines} onChange={setLines} readOnly={!writable} />
          <div className="mt-6 flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="w-full max-w-lg">
              <FormFields
                values={values}
                onChange={(n, v) => setValues((p) => ({ ...p, [n]: v }))}
                fields={[{ name: "notes", label: "fields.notes", type: "textarea" }]}
              />
            </div>
            <TotalsBox totals={totals} tvaRate={Number(values.tvaRate) || 0} discountRate={Number(values.discountRate) || 0} />
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function QuotePage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useApp();
  const { data, ready } = useCollection("quotes");
  const quote = data.find((q) => q.id === id);

  if (!ready) return <Skeleton className="h-96" />;
  if (!quote) return <EmptyState title={t("common.notFound")} action={<ButtonLink href="/quotes" variant="secondary">{t("common.back")}</ButtonLink>} />;
  return <QuoteEditor key={quote.id} quote={quote} />;
}
