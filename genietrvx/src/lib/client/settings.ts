"use client";

import { useApi } from "./api";
import { settingsSchema, type Settings } from "@/lib/schemas";

const FALLBACK = settingsSchema.parse({});

export function useSettings(): { settings: Settings; ready: boolean; reload: () => Promise<void> } {
  const { data, reload } = useApi<{ settings: Settings }>("/api/settings");
  return { settings: data?.settings ?? FALLBACK, ready: !!data, reload };
}
