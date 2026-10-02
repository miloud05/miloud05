"use client";

import { Handshake, Star } from "lucide-react";
import { CrudPage } from "@/components/crud/CrudPage";
import { useApp } from "@/components/providers/AppProvider";
import { wilayaName } from "@/lib/wilayas";

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex" aria-label={`${value}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`size-3.5 ${i <= value ? "fill-amber-400 text-amber-400" : "text-border"}`} />
      ))}
    </span>
  );
}

export default function SubcontractorsPage() {
  const { lang } = useApp();
  return (
    <CrudPage
      collection="subcontractors"
      title="subcontractors.title"
      subtitle="subcontractors.subtitle"
      newLabel="subcontractors.new"
      emptyIcon={<Handshake className="size-6" />}
      defaultSort={{ key: "name", dir: "asc" }}
      defaults={() => ({ rating: 3, wilaya: 16 })}
      columns={[
        { key: "name", label: "fields.name", render: (r) => <span className="font-medium">{r.name}</span> },
        { key: "specialty", label: "fields.specialty" },
        { key: "rating", label: "fields.rating", render: (r) => <Stars value={r.rating} /> },
        { key: "phone", label: "fields.phone", render: (r) => <span className="num">{r.phone || "—"}</span> },
        { key: "wilaya", label: "fields.wilaya", render: (r) => wilayaName(r.wilaya, lang) },
      ]}
      fields={[
        { name: "name", label: "fields.name", required: true, full: true },
        { name: "specialty", label: "fields.specialty" },
        { name: "rating", label: "fields.rating", type: "number", min: 0, max: 5, step: "1" },
        { name: "phone", label: "fields.phone", type: "tel" },
        { name: "email", label: "fields.email", type: "email" },
        { name: "nif", label: "fields.nif", ltr: true },
        { name: "rc", label: "fields.rc", ltr: true },
        { name: "wilaya", label: "fields.wilaya", type: "wilaya" },
        { name: "address", label: "fields.address" },
        { name: "notes", label: "fields.notes", type: "textarea" },
      ]}
    />
  );
}
