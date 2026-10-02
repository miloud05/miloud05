"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Save, Upload } from "lucide-react";
import { Button, Card, EmptyState, Field, Input, PageHeader, Select, Skeleton, Tabs, Textarea } from "@/components/ui";
import { useApp } from "@/components/providers/AppProvider";
import { api, useApi } from "@/lib/client/api";
import { useSettings } from "@/lib/client/settings";
import { WILAYAS } from "@/lib/wilayas";
import type { Settings } from "@/lib/schemas";

type Tab = "company" | "payroll" | "invoicing" | "backup" | "activity";
type Section = keyof Settings;

function SettingsForm({ initial }: { initial: Settings }) {
  const { t, can, toast, errorMessage, lang } = useApp();
  const { reload } = useSettings();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("company");
  const [values, setValues] = useState<Settings>(initial);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const writable = can("settings", "write");
  const activity = useApi<{ items: Array<{ id: string; userName: string; action: string; collection: string; label: string; at: string }> }>(
    tab === "activity" ? "/api/activity" : null,
  );

  const set = <S extends Section>(section: S, key: keyof Settings[S], v: unknown) =>
    setValues((prev) => ({ ...prev, [section]: { ...prev[section], [key]: v } }));

  async function save() {
    setBusy(true);
    try {
      await api("/api/settings", { method: "PUT", body: values });
      await reload();
      toast(t("common.saved"));
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  async function restore(file: File) {
    if (!confirm(t("settings.restoreWarning"))) return;
    setBusy(true);
    try {
      const json = JSON.parse(await file.text());
      const res = await api<{ restored: number }>("/api/backup", { method: "POST", body: json });
      toast(t("settings.restored", { count: res.restored }));
      await api("/api/auth/logout", { method: "POST" }).catch(() => undefined);
      setTimeout(() => {
        router.replace("/login");
        router.refresh();
      }, 1200);
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const text = (section: Section, key: string, label: string, opts: { type?: string; ltr?: boolean } = {}) => (
    <Field label={t(label)} key={`${section}.${key}`}>
      <Input
        type={opts.type ?? "text"}
        dir={opts.ltr || opts.type === "number" ? "ltr" : undefined}
        step={opts.type === "number" ? "any" : undefined}
        value={String((values[section] as Record<string, unknown>)[key] ?? "")}
        onChange={(e) => set(section, key as never, opts.type === "number" ? Number(e.target.value) : e.target.value)}
      />
    </Field>
  );

  const showSave = writable && (tab === "company" || tab === "payroll" || tab === "invoicing");

  return (
    <div>
      <PageHeader
        title={t("settings.title")}
        subtitle={t("settings.subtitle")}
        actions={
          showSave && (
            <Button icon={<Save className="size-4" />} loading={busy} onClick={save}>
              {t("common.save")}
            </Button>
          )
        }
      />
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "company", label: t("settings.company") },
          { id: "payroll", label: t("settings.payroll") },
          { id: "invoicing", label: t("settings.invoicing") },
          ...(can("backup", "write") ? [{ id: "backup" as Tab, label: t("settings.backup") }] : []),
          { id: "activity", label: t("settings.activity") },
        ]}
      />
      <fieldset disabled={!writable}>
        {tab === "company" && (
          <Card>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {text("company", "name", "fields.name")}
              {text("company", "legalForm", "settings.legalForm")}
              {text("company", "capital", "settings.capital", { type: "number" })}
              {text("company", "nif", "fields.nif", { ltr: true })}
              {text("company", "nis", "fields.nis", { ltr: true })}
              {text("company", "rc", "fields.rc", { ltr: true })}
              {text("company", "ai", "fields.ai", { ltr: true })}
              {text("company", "bank", "settings.bank")}
              {text("company", "rib", "settings.rib", { ltr: true })}
              {text("company", "address", "fields.address")}
              <Field label={t("fields.wilaya")}>
                <Select value={values.company.wilaya} onChange={(e) => set("company", "wilaya", Number(e.target.value))}>
                  {WILAYAS.map((w) => (
                    <option key={w.code} value={w.code}>
                      {String(w.code).padStart(2, "0")} - {lang === "ar" ? w.ar : w.fr}
                    </option>
                  ))}
                </Select>
              </Field>
              {text("company", "phone", "fields.phone", { ltr: true })}
              {text("company", "email", "fields.email", { ltr: true })}
              {text("company", "website", "settings.website", { ltr: true })}
            </div>
          </Card>
        )}
        {tab === "payroll" && (
          <Card>
            <p className="mb-5 rounded-xl bg-info-soft px-4 py-3 text-sm text-info">{t("settings.payrollNote")}</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {(["cnasEmployeeRate", "cnasEmployerRate", "cacobatphEmployerRate", "cacobatphWorkerRate", "workingDays", "monthlyHours", "overtimeRate", "snmg"] as const).map((k) =>
                text("payroll", k, `settings.${k}`, { type: "number" }),
              )}
            </div>
          </Card>
        )}
        {tab === "invoicing" && (
          <Card>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {text("invoicing", "tvaRate", "fields.tvaRate", { type: "number" })}
              {text("invoicing", "stampRate", "settings.stampRate", { type: "number" })}
              {text("invoicing", "stampMax", "settings.stampMax", { type: "number" })}
              {text("invoicing", "paymentTermsDays", "settings.paymentTermsDays", { type: "number" })}
              {text("invoicing", "quoteValidityDays", "settings.quoteValidityDays", { type: "number" })}
              <Field label={t("settings.footer")} className="sm:col-span-2">
                <Textarea value={values.invoicing.footer} onChange={(e) => set("invoicing", "footer", e.target.value)} />
              </Field>
            </div>
          </Card>
        )}
      </fieldset>
      {tab === "backup" && (
        <Card>
          <p className="mb-5 text-sm text-muted">{t("settings.backupHint")}</p>
          <div className="flex flex-wrap gap-3">
            <a href="/api/backup" className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover">
              <Download className="size-4" /> {t("settings.downloadBackup")}
            </a>
            <Button variant="secondary" icon={<Upload className="size-4" />} loading={busy} onClick={() => fileRef.current?.click()}>
              {t("settings.restoreBackup")}
            </Button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])} />
          </div>
        </Card>
      )}
      {tab === "activity" && (
        <Card padded={false}>
          {!activity.data ? (
            <div className="p-5">{activity.error ? <EmptyState title={t("common.noAccess")} /> : <Skeleton className="h-64" />}</div>
          ) : (
            <ul className="divide-y divide-border">
              {activity.data.items.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                  <span>
                    <span className="font-medium">{a.userName}</span> {t(`dashboard.actions.${a.action}`)} — <span className="text-muted">{a.collection}</span> · {a.label}
                  </span>
                  <span className="num text-xs text-muted">{new Date(a.at).toLocaleString(lang === "ar" ? "ar-DZ" : "fr-FR", { numberingSystem: "latn" })}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { t, can } = useApp();
  const { settings, ready } = useSettings();
  if (!can("settings")) return <EmptyState title={t("common.noAccess")} />;
  if (!ready) return <Skeleton className="h-96" />;
  return <SettingsForm initial={settings} />;
}
