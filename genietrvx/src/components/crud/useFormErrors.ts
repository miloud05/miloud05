"use client";

import { useState } from "react";
import { ApiClientError } from "@/lib/client/api";
import { useApp } from "@/components/providers/AppProvider";

/** Traduit les erreurs de validation renvoyées par l'API en messages par champ. */
export function useFormErrors() {
  const { t, toast, errorMessage } = useApp();
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handle(err: unknown) {
    if (err instanceof ApiClientError && err.code === "validation" && Array.isArray(err.details)) {
      const map: Record<string, string> = {};
      for (const d of err.details as Array<{ path: string; message: string; available?: number }>) {
        const key = `errors.${d.message}`;
        const specific = t(key, d.available !== undefined ? { available: d.available } : undefined);
        map[d.path.split(".")[0]] = specific !== key ? specific : t("common.required");
      }
      setErrors(map);
      toast(t("errors.validation"), "error");
      return;
    }
    toast(errorMessage(err), "error");
  }

  return { errors, setErrors, handle, clear: () => setErrors({}) };
}
