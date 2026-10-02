"use client";

import { useRouter } from "next/navigation";
import { FileText, Printer } from "lucide-react";
import { CrudPage } from "@/components/crud/CrudPage";
import { StatusBadge } from "@/components/StatusBadge";
import { StatCard } from "@/components/ui";
import { useApp } from "@/components/providers/AppProvider";
import { useLookup } from "@/lib/client/lookup";
import { useSettings } from "@/lib/client/settings";
import { computeDocumentTotals } from "@/lib/calc/documents";
import { addDays, round2, todayIso } from "@/lib/calc/money";
import type { Quote } from "@/lib/schemas";

export default function QuotesPage() {
  const { t, money, date, enumLabel } = useApp();
  const router = useRouter();
  const clients = useLookup("clients");
  const { settings } = useSettings();
  const totalOf = (q: Quote) => computeDocumentTotals(q.lines, { discountRate: q.discountRate, tvaRate: q.tvaRate }).totalTTC;

  return (
    <CrudPage
      collection="quotes"
      title="quotes.title"
      subtitle="quotes.subtitle"
      newLabel="quotes.new"
      emptyIcon={<FileText className="size-6" />}
      defaultSort={{ key: "number", dir: "desc" }}
      defaults={() => ({
        date: todayIso(),
        validUntil: addDays(todayIso(), settings.invoicing.quoteValidityDays),
        tvaRate: settings.invoicing.tvaRate,
        status: "draft",
        lines: [],
      })}
      rowHref={(r) => `/quotes/${r.id}`}
      afterCreate={(doc) => router.push(`/quotes/${doc.id}`)}
      searchText={(r) => `${r.number} ${r.projectName} ${clients.label(r.clientId)}`}
      filters={[{ name: "status", label: "fields.status", enumKey: "quoteStatus" }]}
      summary={(rows) => (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label={t("quotes.title")} value={rows.length} icon={<FileText className="size-5" />} />
          {(["sent", "accepted", "rejected"] as const).map((s) => {
            const list = rows.filter((r) => r.status === s);
            return (
              <StatCard
                key={s}
                label={enumLabel("quoteStatus", s)}
                value={list.length}
                hint={money(round2(list.reduce((a, q) => a + totalOf(q), 0)))}
                tone={s === "accepted" ? "success" : s === "rejected" ? "danger" : "info"}
              />
            );
          })}
        </div>
      )}
      columns={[
        { key: "number", label: "fields.number", render: (r) => <span className="num font-mono text-xs font-semibold">{r.number}</span> },
        { key: "clientId", label: "fields.client", render: (r) => clients.label(r.clientId), sortValue: (r) => clients.label(r.clientId) },
        { key: "projectName", label: "fields.projectName", className: "max-w-sm", render: (r) => <span className="line-clamp-1">{r.projectName}</span> },
        { key: "date", label: "fields.date", render: (r) => <span className="num">{date(r.date)}</span> },
        { key: "validUntil", label: "fields.validUntil", render: (r) => <span className="num">{date(r.validUntil)}</span> },
        { key: "total", label: "fields.totalTTC", align: "end", sortValue: totalOf, render: (r) => <span className="num font-semibold">{money(totalOf(r))}</span> },
        { key: "status", label: "fields.status", render: (r) => <StatusBadge enumKey="quoteStatus" value={r.status} /> },
      ]}
      rowActions={(r) => (
        <a href={`/print/quote/${r.id}`} target="_blank" className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-text" title={t("common.print")}>
          <Printer className="size-4" />
        </a>
      )}
      fields={[
        { name: "clientId", label: "fields.client", type: "ref", ref: "clients", full: true },
        { name: "projectName", label: "fields.projectName", full: true },
        { name: "date", label: "fields.date", type: "date", required: true },
        { name: "validUntil", label: "fields.validUntil", type: "date" },
        { name: "status", label: "fields.status", type: "select", enumKey: "quoteStatus" },
        { name: "tvaRate", label: "fields.tvaRate", type: "number" },
      ]}
    />
  );
}
