"use client";

import { Building } from "lucide-react";
import { CrudPage } from "@/components/crud/CrudPage";
import { StatusBadge } from "@/components/StatusBadge";
import { useApp } from "@/components/providers/AppProvider";
import { wilayaName } from "@/lib/wilayas";

export default function ClientsPage() {
  const { lang } = useApp();
  return (
    <CrudPage
      collection="clients"
      title="clients.title"
      subtitle="clients.subtitle"
      newLabel="clients.new"
      emptyIcon={<Building className="size-6" />}
      defaultSort={{ key: "name", dir: "asc" }}
      defaults={() => ({ type: "public", wilaya: 16 })}
      filters={[{ name: "type", label: "fields.type", enumKey: "clientType" }]}
      columns={[
        { key: "name", label: "fields.name", render: (r) => <span className="font-medium">{r.name}</span> },
        { key: "type", label: "fields.type", render: (r) => <StatusBadge enumKey="clientType" value={r.type} /> },
        { key: "contact", label: "fields.contact" },
        { key: "phone", label: "fields.phone", render: (r) => <span className="num">{r.phone || "—"}</span> },
        { key: "nif", label: "fields.nif", render: (r) => <span className="num text-xs">{r.nif || "—"}</span> },
        { key: "wilaya", label: "fields.wilaya", render: (r) => wilayaName(r.wilaya, lang) },
      ]}
      fields={[
        { name: "name", label: "fields.name", required: true, full: true },
        { name: "type", label: "fields.type", type: "select", enumKey: "clientType" },
        { name: "contact", label: "fields.contact" },
        { name: "phone", label: "fields.phone", type: "tel" },
        { name: "email", label: "fields.email", type: "email" },
        { name: "nif", label: "fields.nif", ltr: true },
        { name: "nis", label: "fields.nis", ltr: true },
        { name: "rc", label: "fields.rc", ltr: true },
        { name: "ai", label: "fields.ai", ltr: true },
        { name: "wilaya", label: "fields.wilaya", type: "wilaya" },
        { name: "address", label: "fields.address" },
        { name: "notes", label: "fields.notes", type: "textarea" },
      ]}
    />
  );
}
