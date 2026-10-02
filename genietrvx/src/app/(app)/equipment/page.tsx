"use client";

import { Printer, Truck, Wrench } from "lucide-react";
import { CrudPage } from "@/components/crud/CrudPage";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge, ButtonLink, StatCard } from "@/components/ui";
import { useApp } from "@/components/providers/AppProvider";
import { useLookup } from "@/lib/client/lookup";
import { addDays, todayIso } from "@/lib/calc/money";

export default function EquipmentPage() {
  const { t, money, date, enumLabel } = useApp();
  const projects = useLookup("projects");
  const today = todayIso();
  const soon = addDays(today, 7);

  return (
    <CrudPage
      collection="equipment"
      title="equipment.title"
      subtitle="equipment.subtitle"
      newLabel="equipment.new"
      modalSize="lg"
      emptyIcon={<Truck className="size-6" />}
      defaultSort={{ key: "code", dir: "asc" }}
      defaults={() => ({ type: "excavator", ownership: "owned", status: "available" })}
      headerActions={
        <ButtonLink href="/print/equipment/all" target="_blank" variant="secondary" icon={<Printer className="size-4" />}>
          <span className="hidden md:inline">{t("equipment.printList")}</span>
        </ButtonLink>
      }
      searchText={(r) => `${r.code} ${r.name} ${r.brand} ${r.model} ${r.plate}`}
      filters={[
        { name: "status", label: "fields.status", enumKey: "equipmentStatus" },
        { name: "type", label: "fields.type", enumKey: "equipmentType" },
        { name: "projectId", label: "fields.project", options: projects.data.map((p) => ({ value: p.id, label: p.name })) },
      ]}
      summary={(rows) => (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label={t("dashboard.equipment")} value={rows.length} icon={<Truck className="size-5" />} />
          <StatCard label={enumLabel("equipmentStatus", "in_use")} value={rows.filter((r) => r.status === "in_use").length} tone="info" />
          <StatCard label={enumLabel("equipmentStatus", "available")} value={rows.filter((r) => r.status === "available").length} tone="success" />
          <StatCard
            label={t("equipment.maintenanceDue")}
            value={rows.filter((r) => r.nextMaintenance && r.nextMaintenance <= soon).length}
            tone="warning"
            icon={<Wrench className="size-5" />}
          />
        </div>
      )}
      columns={[
        { key: "code", label: "fields.code", render: (r) => <span className="num font-mono text-xs">{r.code}</span> },
        {
          key: "name",
          label: "fields.name",
          render: (r) => (
            <div>
              <p className="font-medium">{r.name}</p>
              <p className="text-xs text-muted">
                {[r.brand, r.model, r.plate].filter(Boolean).join(" · ") || enumLabel("equipmentType", r.type)}
              </p>
            </div>
          ),
        },
        { key: "ownership", label: "fields.ownership", render: (r) => enumLabel("ownership", r.ownership) },
        { key: "projectId", label: "fields.project", render: (r) => projects.get(r.projectId)?.code ?? "—" },
        {
          key: "hourlyCost",
          label: "fields.hourlyCost",
          align: "end",
          render: (r) => <span className="num">{r.ownership === "rented" ? `${money(r.dailyRentalCost)} / j` : money(r.hourlyCost)}</span>,
        },
        {
          key: "nextMaintenance",
          label: "fields.nextMaintenance",
          render: (r) =>
            r.nextMaintenance ? (
              <span className="inline-flex items-center gap-2">
                <span className="num">{date(r.nextMaintenance)}</span>
                {r.nextMaintenance <= soon && <Badge tone={r.nextMaintenance < today ? "danger" : "warning"}>{t("equipment.maintenanceDue")}</Badge>}
              </span>
            ) : (
              "—"
            ),
        },
        { key: "status", label: "fields.status", render: (r) => <StatusBadge enumKey="equipmentStatus" value={r.status} /> },
      ]}
      fields={[
        { name: "name", label: "fields.name", required: true },
        { name: "code", label: "fields.code", ltr: true, hint: "common.optional" },
        { name: "type", label: "fields.type", type: "select", enumKey: "equipmentType" },
        { name: "status", label: "fields.status", type: "select", enumKey: "equipmentStatus" },
        { name: "brand", label: "fields.brand" },
        { name: "model", label: "fields.model" },
        { name: "plate", label: "fields.plate", ltr: true },
        { name: "ownership", label: "fields.ownership", type: "select", enumKey: "ownership" },
        { name: "projectId", label: "fields.project", type: "ref", ref: "projects" },
        { name: "hourlyCost", label: "fields.hourlyCost", type: "number", showIf: (v) => v.ownership !== "rented" },
        { name: "dailyRentalCost", label: "fields.dailyRentalCost", type: "number", showIf: (v) => v.ownership === "rented" },
        { name: "purchaseDate", label: "fields.purchaseDate", type: "date", showIf: (v) => v.ownership !== "rented" },
        { name: "purchaseValue", label: "fields.purchaseValue", type: "number", showIf: (v) => v.ownership !== "rented" },
        { name: "hoursCounter", label: "fields.hoursCounter", type: "number" },
        { name: "lastMaintenance", label: "fields.lastMaintenance", type: "date" },
        { name: "nextMaintenance", label: "fields.nextMaintenance", type: "date" },
        { name: "insuranceExpiry", label: "fields.insuranceExpiry", type: "date" },
        { name: "notes", label: "fields.notes", type: "textarea" },
      ]}
    />
  );
}
