"use client";

import { useMemo } from "react";
import { useCollection } from "./api";
import { can } from "@/lib/permissions";
import type { CollectionName, Doc } from "@/lib/schemas";
import { useApp } from "@/components/providers/AppProvider";
import { defaultRefLabel } from "@/components/crud/FormFields";

/** Index par identifiant d'une collection (chargée seulement si l'utilisateur y a accès). */
export function useLookup<C extends CollectionName>(name: C) {
  const { user } = useApp();
  const allowed = can(user?.role, name, "read");
  const { data, ready } = useCollection(name, allowed);
  return useMemo(() => {
    const map = new Map<string, Doc<C>>();
    for (const d of data) map.set(d.id, d);
    return {
      data,
      ready: ready || !allowed,
      map,
      get: (id: string | undefined) => (id ? map.get(id) : undefined),
      label: (id: string | undefined) => {
        if (!id) return "—";
        const d = map.get(id);
        return d ? defaultRefLabel(d as unknown as Record<string, unknown>) : "—";
      },
    };
  }, [data, ready, allowed]);
}
