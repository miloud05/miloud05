"use client";

import clsx from "clsx";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui";
import { useApp } from "@/components/providers/AppProvider";
import { ENUMS, type CollectionName, type EnumKey } from "@/lib/schemas";
import { WILAYAS } from "@/lib/wilayas";
import { useCollection } from "@/lib/client/api";

export type FieldType = "text" | "textarea" | "number" | "date" | "select" | "ref" | "wilaya" | "email" | "tel" | "checkbox" | "password" | "month";

export interface FormField {
  name: string;
  label: string;
  type?: FieldType;
  enumKey?: EnumKey;
  ref?: CollectionName;
  refLabel?: (doc: Record<string, unknown>) => string;
  refFilter?: (doc: Record<string, unknown>, values: Record<string, unknown>) => boolean;
  required?: boolean;
  full?: boolean;
  step?: string;
  min?: number;
  max?: number;
  hint?: string;
  showIf?: (values: Record<string, unknown>) => boolean;
  ltr?: boolean;
  allowEmpty?: boolean;
}

export function defaultRefLabel(doc: Record<string, unknown>): string {
  if (doc.firstName) return `${doc.lastName ?? ""} ${doc.firstName}`.trim();
  if (doc.code && doc.name) return `${doc.code} — ${doc.name}`;
  return String(doc.name ?? doc.reference ?? doc.number ?? doc.object ?? doc.id);
}

function RefSelect({
  field,
  value,
  values,
  onChange,
  invalid,
}: {
  field: FormField;
  value: string;
  values: Record<string, unknown>;
  onChange: (v: string) => void;
  invalid?: boolean;
}) {
  const { t } = useApp();
  const { data } = useCollection(field.ref!);
  const options = (data as unknown as Record<string, unknown>[]).filter((d) => !field.refFilter || field.refFilter(d, values));
  const label = field.refLabel ?? defaultRefLabel;
  return (
    <Select id={field.name} value={value} onChange={(e) => onChange(e.target.value)} invalid={invalid} required={field.required}>
      <option value="">{t("common.select")}</option>
      {options.map((d) => (
        <option key={String(d.id)} value={String(d.id)}>
          {label(d)}
        </option>
      ))}
    </Select>
  );
}

export function FormFields({
  fields,
  values,
  onChange,
  errors = {},
}: {
  fields: FormField[];
  values: Record<string, unknown>;
  onChange: (name: string, value: unknown) => void;
  errors?: Record<string, string>;
}) {
  const { t, lang } = useApp();
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {fields
        .filter((f) => !f.showIf || f.showIf(values))
        .map((f) => {
          const type = f.type ?? "text";
          const raw = values[f.name];
          const str = raw === undefined || raw === null ? "" : String(raw);
          const err = errors[f.name];
          const common = { id: f.name, invalid: !!err, required: f.required };
          let control: React.ReactNode;
          switch (type) {
            case "textarea":
              control = <Textarea {...common} value={str} onChange={(e) => onChange(f.name, e.target.value)} />;
              break;
            case "select":
              control = (
                <Select {...common} value={str} onChange={(e) => onChange(f.name, e.target.value)}>
                  {f.allowEmpty && <option value="">{t("common.select")}</option>}
                  {ENUMS[f.enumKey!].map((opt) => (
                    <option key={opt} value={opt}>
                      {t(`enums.${f.enumKey}.${opt}`)}
                    </option>
                  ))}
                </Select>
              );
              break;
            case "ref":
              control = <RefSelect field={f} value={str} values={values} onChange={(v) => onChange(f.name, v)} invalid={!!err} />;
              break;
            case "wilaya":
              control = (
                <Select {...common} value={str} onChange={(e) => onChange(f.name, Number(e.target.value))}>
                  {WILAYAS.map((w) => (
                    <option key={w.code} value={w.code}>
                      {String(w.code).padStart(2, "0")} - {lang === "ar" ? w.ar : w.fr}
                    </option>
                  ))}
                </Select>
              );
              break;
            case "checkbox":
              control = <Checkbox checked={raw === true} onChange={(v) => onChange(f.name, v)} label={t(f.label)} id={f.name} />;
              break;
            default:
              control = (
                <Input
                  {...common}
                  type={type === "text" ? "text" : type}
                  step={f.step ?? (type === "number" ? "any" : undefined)}
                  min={f.min}
                  max={f.max}
                  dir={f.ltr || type === "email" || type === "tel" || type === "number" ? "ltr" : undefined}
                  value={str}
                  onChange={(e) => onChange(f.name, e.target.value)}
                  autoComplete={type === "password" ? "new-password" : undefined}
                />
              );
          }
          if (type === "checkbox") {
            return (
              <div key={f.name} className={clsx("flex items-end pb-2", f.full && "sm:col-span-2")}>
                {control}
              </div>
            );
          }
          return (
            <Field
              key={f.name}
              label={t(f.label)}
              htmlFor={f.name}
              error={err}
              hint={f.hint ? t(f.hint) : undefined}
              required={f.required}
              className={clsx((f.full || type === "textarea") && "sm:col-span-2")}
            >
              {control}
            </Field>
          );
        })}
    </div>
  );
}
