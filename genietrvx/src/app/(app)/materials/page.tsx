"use client";

import { useMemo } from "react";
import { Package, Printer, TriangleAlert } from "lucide-react";
import { CrudPage } from "@/components/crud/CrudPage";
import { Badge, ButtonLink, StatCard } from "@/components/ui";
import { useApp } from "@/components/providers/AppProvider";
import { useCollection } from "@/lib/client/api";
import { currentStock } from "@/lib/calc/stock";
import { round2 } from "@/lib/calc/money";
import type { Material } from "@/lib/schemas";

export default function MaterialsPage() {
  const { t, money, number, enumLabel } = useApp();
  const { data: movements } = useCollection("stockMovements");
  const { data: materials } = useCollection("materials");
  const stockMap = useMemo(() => new Map(materials.map((m) => [m.id, currentStock(m, movements)])), [materials, movements]);
  const stockOf = (m: Material) => stockMap.get(m.id) ?? currentStock(m, movements);

  return (
    <CrudPage
      collection="materials"
      title="materials.title"
      subtitle="materials.subtitle"
      newLabel="materials.new"
      emptyIcon={<Package className="size-6" />}
      defaultSort={{ key: "code", dir: "asc" }}
      defaults={() => ({ category: "cement", unit: "u", location: "Dépôt central" })}
      headerActions={
        <ButtonLink href="/print/stock/all" target="_blank" variant="secondary" icon={<Printer className="size-4" />}>
          <span className="hidden md:inline">{t("materials.printStock")}</span>
        </ButtonLink>
      }
      filters={[
        { name: "category", label: "fields.category", enumKey: "materialCategory" },
        {
          name: "low",
          label: "materials.low",
          options: [{ value: "1", label: t("materials.low") }],
          match: (r) => stockOf(r) <= r.minStock,
        },
      ]}
      summary={(rows) => {
        const value = round2(rows.reduce((a, m) => a + Math.max(0, stockOf(m)) * m.unitPrice, 0));
        const low = rows.filter((m) => stockOf(m) <= m.minStock).length;
        return (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label={t("nav.materials")} value={rows.length} icon={<Package className="size-5" />} />
            <StatCard label={t("dashboard.stockValue")} value={money(value)} tone="success" />
            <StatCard label={t("materials.low")} value={low} tone={low ? "danger" : "neutral"} icon={<TriangleAlert className="size-5" />} />
          </div>
        );
      }}
      columns={[
        { key: "code", label: "fields.code", render: (r) => <span className="num font-mono text-xs">{r.code}</span> },
        { key: "name", label: "fields.name", render: (r) => <span className="font-medium">{r.name}</span> },
        { key: "category", label: "fields.category", render: (r) => enumLabel("materialCategory", r.category) },
        {
          key: "stock",
          label: "fields.stock",
          align: "end",
          sortValue: (r) => stockOf(r),
          render: (r) => {
            const s = stockOf(r);
            return (
              <span className="inline-flex items-center gap-2">
                {s <= r.minStock && <Badge tone="danger">{t("materials.low")}</Badge>}
                <span className={`num font-semibold ${s <= r.minStock ? "text-danger" : ""}`}>
                  {number(s)} {r.unit}
                </span>
              </span>
            );
          },
        },
        { key: "minStock", label: "fields.minStock", align: "end", render: (r) => <span className="num text-muted">{number(r.minStock)}</span> },
        { key: "unitPrice", label: "fields.unitPrice", align: "end", render: (r) => <span className="num">{money(r.unitPrice)}</span> },
        {
          key: "value",
          label: "fields.stockValue",
          align: "end",
          sortValue: (r) => Math.max(0, stockOf(r)) * r.unitPrice,
          render: (r) => <span className="num">{money(Math.max(0, stockOf(r)) * r.unitPrice)}</span>,
        },
        { key: "location", label: "fields.location" },
      ]}
      fields={[
        { name: "name", label: "fields.name", required: true, full: true },
        { name: "code", label: "fields.code", ltr: true, hint: "common.optional" },
        { name: "category", label: "fields.category", type: "select", enumKey: "materialCategory" },
        { name: "unit", label: "fields.unit" },
        { name: "unitPrice", label: "fields.unitPrice", type: "number" },
        { name: "initialStock", label: "fields.initialStock", type: "number" },
        { name: "minStock", label: "fields.minStock", type: "number" },
        { name: "location", label: "fields.location" },
        { name: "supplierId", label: "fields.supplier", type: "ref", ref: "suppliers" },
      ]}
    />
  );
}
