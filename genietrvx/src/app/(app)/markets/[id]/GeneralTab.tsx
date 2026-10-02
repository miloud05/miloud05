"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { FormFields } from "@/components/crud/FormFields";
import { useFormErrors } from "@/components/crud/useFormErrors";
import { useApp } from "@/components/providers/AppProvider";
import { useCollection } from "@/lib/client/api";
import type { Market } from "@/lib/schemas";

export function GeneralTab({ market }: { market: Market }) {
  const { t, can, toast } = useApp();
  const { update } = useCollection("markets");
  const [values, setValues] = useState<Record<string, unknown>>({ ...market });
  const [busy, setBusy] = useState(false);
  const { errors, handle } = useFormErrors();
  const writable = can("markets", "write");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { items: _i, amendments: _a, bonds: _b, ...rest } = values;
      void _i;
      void _a;
      void _b;
      await update(market.id, rest);
      toast(t("common.saved"));
    } catch (err) {
      handle(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title={t("markets.general")}
      actions={
        writable && (
          <Button size="sm" type="submit" form="market-general" loading={busy} icon={<Save className="size-4" />}>
            {t("common.save")}
          </Button>
        )
      }
    >
      <form id="market-general" onSubmit={save} noValidate>
        <fieldset disabled={!writable}>
          <FormFields
            values={values}
            errors={errors}
            onChange={(name, v) => setValues((p) => ({ ...p, [name]: v }))}
            fields={[
              { name: "object", label: "fields.object", required: true, full: true },
              { name: "reference", label: "fields.reference", ltr: true },
              { name: "kind", label: "fields.kind", type: "select", enumKey: "marketKind" },
              { name: "clientId", label: "fields.client", type: "ref", ref: "clients" },
              { name: "projectId", label: "fields.project", type: "ref", ref: "projects" },
              { name: "procedure", label: "fields.procedure" },
              { name: "status", label: "fields.status", type: "select", enumKey: "marketStatus" },
              { name: "signDate", label: "fields.signDate", type: "date" },
              { name: "startDate", label: "fields.odsDate", type: "date" },
              { name: "durationDays", label: "fields.durationDays", type: "number", step: "1" },
              { name: "suspendedDays", label: "fields.suspendedDays", type: "number", step: "1" },
              { name: "completionDate", label: "fields.completionDate", type: "date" },
              { name: "tvaRate", label: "fields.tvaRate", type: "number" },
              { name: "guaranteeRate", label: "fields.guaranteeRate", type: "number" },
              { name: "advanceRate", label: "fields.advanceRate", type: "number" },
              { name: "penaltyRatePerMille", label: "fields.penaltyRate", type: "number" },
              { name: "penaltyCapPercent", label: "fields.penaltyCap", type: "number" },
              { name: "revisionCoefficient", label: "fields.revisionCoefficient", type: "number", step: "0.0001" },
              { name: "notes", label: "fields.notes", type: "textarea" },
            ]}
          />
        </fieldset>
      </form>
    </Card>
  );
}
