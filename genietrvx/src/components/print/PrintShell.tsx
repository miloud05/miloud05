"use client";

import clsx from "clsx";
import type { ReactNode } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import { useApp } from "@/components/providers/AppProvider";
import { LogoMark } from "@/components/layout/Logo";
import { todayIso } from "@/lib/calc/money";
import { wilayaName } from "@/lib/wilayas";
import type { Settings } from "@/lib/schemas";

export function PrintToolbar() {
  const { t } = useApp();
  return (
    <div className="no-print mx-auto mb-4 flex max-w-[210mm] items-center justify-between gap-3 px-2">
      <button onClick={() => (window.history.length > 1 ? window.history.back() : window.close())} className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm text-slate-700 shadow-sm hover:bg-slate-50">
        <ArrowLeft className="size-4 rtl:rotate-180" /> {t("print.back")}
      </button>
      <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-[#e8590c] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#c94a06]">
        <Printer className="size-4" /> {t("print.print")}
      </button>
    </div>
  );
}

export function CompanyHeader({ settings, title, meta }: { settings: Settings; title: ReactNode; meta?: ReactNode }) {
  const { lang } = useApp();
  const c = settings.company;
  return (
    <header className="mb-6 flex items-start justify-between gap-6 border-b-2 border-[#0f2340] pb-4">
      <div className="flex gap-3">
        <LogoMark className="size-12 shrink-0" />
        <div className="text-[10.5px] leading-snug text-slate-600">
          <p className="text-base font-extrabold text-[#0f2340]">
            {c.name} {c.legalForm && !c.name.includes(c.legalForm) ? c.legalForm : ""}
          </p>
          {c.capital > 0 && <p>Capital social : {new Intl.NumberFormat("fr-FR").format(c.capital)} DA</p>}
          <p>
            {c.address}
            {c.address ? " — " : ""}
            {wilayaName(c.wilaya, lang)}
          </p>
          <p>{[c.phone && `Tél : ${c.phone}`, c.email, c.website].filter(Boolean).join(" · ")}</p>
          <p className="num">{[c.nif && `NIF : ${c.nif}`, c.nis && `NIS : ${c.nis}`, c.rc && `RC : ${c.rc}`, c.ai && `AI : ${c.ai}`].filter(Boolean).join(" · ")}</p>
          {c.rib && (
            <p className="num">
              {c.bank} — RIB : {c.rib}
            </p>
          )}
        </div>
      </div>
      <div className="text-end">
        <p className="text-xl font-extrabold tracking-wide text-[#e8590c]">{title}</p>
        {meta && <div className="mt-1 text-[11px] text-slate-600">{meta}</div>}
      </div>
    </header>
  );
}

export function PrintFooter({ settings }: { settings: Settings }) {
  const { t, date } = useApp();
  return (
    <footer className="mt-10 flex items-end justify-between border-t border-slate-300 pt-3 text-[10px] text-slate-500">
      <span>{settings.invoicing.footer}</span>
      <span className="num">{t("print.generatedOn", { date: date(todayIso()) })} · GenieTRVX</span>
    </footer>
  );
}

export function Signatures({ left, right }: { left: string; right: string }) {
  return (
    <div className="mt-10 grid grid-cols-2 gap-10 text-center text-[11px]">
      {[left, right].map((label) => (
        <div key={label}>
          <p className="font-semibold">{label}</p>
          <div className="mt-2 h-20 rounded border border-dashed border-slate-300" />
        </div>
      ))}
    </div>
  );
}

export function PrintPage({ children, landscape }: { children: ReactNode; landscape?: boolean }) {
  return (
    <>
      <PrintToolbar />
      <article className={clsx("print-page", landscape && "landscape")}>{children}</article>
    </>
  );
}

export function InfoGrid({ rows }: { rows: Array<[ReactNode, ReactNode]> }) {
  return (
    <table className="no-border mb-4">
      <tbody>
        {rows.map(([k, v], i) => (
          <tr key={i}>
            <td className="w-44 pe-3 text-slate-500">{k}</td>
            <td className="font-medium">{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
