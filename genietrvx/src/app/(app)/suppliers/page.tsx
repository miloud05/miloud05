"use client";

import { Store } from "lucide-react";
import { CrudPage } from "@/components/crud/CrudPage";
import { Badge } from "@/components/ui";
import { useApp } from "@/components/providers/AppProvider";
import { wilayaName } from "@/lib/wilayas";

export default function SuppliersPage() {
  const { lang, enumLabel } = useApp();
  return (
    <CrudPage
      collection="suppliers"
      title="suppliers.title"
      subtitle="suppliers.subtitle"
      newLabel="suppliers.new"
      emptyIcon={<Store className="size-6" />}
      defaultSort={{ key: "name", dir: "asc" }}
      defaults={() => ({ category: "materials", wilaya: 16 })}
      filters={[{ name: "category", label: "fields.category", enumKey: "supplierCategory" }]}
      columns={[
        { key: "name", label: "fields.name", render: (r) => <span className="font-medium">{r.name}</span> },
        { key: "category", label: "fields.category", render: (r) => <Badge>{enumLabel("supplierCategory", r.category)}</Badge> },
        { key: "phone", label: "fields.phone", render: (r) => <span className="num">{r.phone || "—"}</span> },
        { key: "email", label: "fields.email" },
        { key: "nif", label: "fields.nif", render: (r) => <span className="num text-xs">{r.nif || "—"}</span> },
        { key: "wilaya", label: "fields.wilaya", render: (r) => wilayaName(r.wilaya, lang) },
      ]}
      fields={[
        { name: "name", label: "fields.name", required: true, full: true },
        { name: "category", label: "fields.category", type: "select", enumKey: "supplierCategory" },
        { name: "phone", label: "fields.phone", type: "tel" },
        { name: "email", label: "fields.email", type: "email" },
        { name: "nif", label: "fields.nif", ltr: true },
        { name: "rc", label: "fields.rc", ltr: true },
        { name: "wilaya", label: "fields.wilaya", type: "wilaya" },
        { name: "address", label: "fields.address", full: true },
        { name: "notes", label: "fields.notes", type: "textarea" },
      ]}
    />
  );
}
