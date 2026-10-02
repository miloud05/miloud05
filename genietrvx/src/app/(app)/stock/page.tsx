"use client";

import { ArrowLeftRight, Printer } from "lucide-react";
import { CrudPage } from "@/components/crud/CrudPage";
import { StatusBadge } from "@/components/StatusBadge";
import { useApp } from "@/components/providers/AppProvider";
import { useLookup } from "@/lib/client/lookup";
import { todayIso } from "@/lib/calc/money";

export default function StockMovementsPage() {
  const { t, money, number, date } = useApp();
  const materials = useLookup("materials");
  const projects = useLookup("projects");
  const suppliers = useLookup("suppliers");

  return (
    <CrudPage
      collection="stockMovements"
      title="stockMovements.title"
      subtitle="stockMovements.subtitle"
      newLabel="stockMovements.new"
      emptyIcon={<ArrowLeftRight className="size-6" />}
      defaultSort={{ key: "date", dir: "desc" }}
      defaults={() => ({ date: todayIso(), type: "in" })}
      searchText={(r) => `${materials.label(r.materialId)} ${r.reference} ${projects.label(r.projectId)} ${r.notes}`}
      filters={[
        { name: "type", label: "fields.type", enumKey: "movementType" },
        { name: "materialId", label: "fields.material", options: materials.data.map((m) => ({ value: m.id, label: m.name })) },
        { name: "projectId", label: "fields.project", options: projects.data.map((p) => ({ value: p.id, label: p.name })) },
      ]}
      columns={[
        { key: "date", label: "fields.date", render: (r) => <span className="num">{date(r.date)}</span> },
        { key: "type", label: "fields.type", render: (r) => <StatusBadge enumKey="movementType" value={r.type} /> },
        { key: "materialId", label: "fields.material", render: (r) => <span className="font-medium">{materials.get(r.materialId)?.name ?? "—"}</span>, sortValue: (r) => materials.label(r.materialId) },
        {
          key: "quantity",
          label: "fields.quantity",
          align: "end",
          render: (r) => (
            <span className={`num font-semibold ${r.type === "out" ? "text-warning" : r.type === "in" ? "text-success" : ""}`}>
              {r.type === "out" ? "−" : r.type === "in" ? "+" : ""}
              {number(Math.abs(r.quantity))} {materials.get(r.materialId)?.unit}
            </span>
          ),
        },
        { key: "amount", label: "fields.amount", align: "end", sortValue: (r) => Math.abs(r.quantity) * r.unitPrice, render: (r) => <span className="num">{money(Math.abs(r.quantity) * r.unitPrice)}</span> },
        { key: "projectId", label: "fields.project", render: (r) => projects.get(r.projectId)?.code ?? "—" },
        { key: "supplierId", label: "fields.supplier", render: (r) => suppliers.get(r.supplierId)?.name ?? "—" },
        { key: "reference", label: "fields.reference" },
      ]}
      rowActions={(r) => (
        <a href={`/print/movement/${r.id}`} target="_blank" className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-text" title={t("stockMovements.printVoucher")}>
          <Printer className="size-4" />
        </a>
      )}
      fields={[
        { name: "date", label: "fields.date", type: "date", required: true },
        { name: "type", label: "fields.type", type: "select", enumKey: "movementType" },
        { name: "materialId", label: "fields.material", type: "ref", ref: "materials", required: true, full: true },
        { name: "quantity", label: "fields.quantity", type: "number", required: true },
        { name: "unitPrice", label: "fields.unitPrice", type: "number" },
        { name: "projectId", label: "fields.project", type: "ref", ref: "projects", showIf: (v) => v.type !== "in" },
        { name: "supplierId", label: "fields.supplier", type: "ref", ref: "suppliers", showIf: (v) => v.type === "in" },
        { name: "reference", label: "fields.reference", ltr: true },
        { name: "notes", label: "fields.notes", type: "textarea" },
      ]}
    />
  );
}
