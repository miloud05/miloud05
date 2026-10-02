"use client";

import { useApp } from "@/components/providers/AppProvider";

export function Loading() {
  const { t } = useApp();
  return <p className="no-print p-10 text-center text-sm text-slate-500">{t("common.loading")}</p>;
}

export function NotFound() {
  const { t } = useApp();
  return <p className="p-10 text-center text-sm text-slate-600">{t("common.notFound")}</p>;
}

type Col = { ready: boolean; error: unknown };

/** État combiné de plusieurs collections : chargement, erreur (accès refusé) ou prêt. */
export function gate(...cols: Col[]): "loading" | "error" | "ready" {
  if (cols.some((c) => c.error)) return "error";
  return cols.every((c) => c.ready) ? "ready" : "loading";
}

export function GateView({ state }: { state: "loading" | "error" }) {
  return state === "error" ? <NotFound /> : <Loading />;
}
