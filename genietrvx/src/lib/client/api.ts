"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { CollectionName, Doc } from "@/lib/schemas";

export class ApiClientError extends Error {
  constructor(
    public status: number,
    public code: string,
    public details?: unknown,
  ) {
    super(code);
  }
}

export async function api<T = unknown>(url: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: init.method ?? "GET",
      headers: init.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      credentials: "same-origin",
    });
  } catch {
    throw new ApiClientError(0, "network");
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined" && !url.includes("/api/auth/login")) {
      // Session expirée : rechargement complet vers la page de connexion (hors cycle React).
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
    }
    throw new ApiClientError(res.status, String(data.error ?? "server_error"), data.details);
  }
  return data as T;
}

/* ------------------------------------------------------------------ */
/* Cache de collections partagé entre composants                        */
/* ------------------------------------------------------------------ */

interface Entry {
  data: unknown[] | undefined;
  error: ApiClientError | null;
  loading: boolean;
  promise: Promise<void> | null;
  listeners: Set<() => void>;
  snapshot: { data: unknown[] | undefined; error: ApiClientError | null; loading: boolean };
}

const cache = new Map<string, Entry>();

function entry(name: string): Entry {
  let e = cache.get(name);
  if (!e) {
    e = {
      data: undefined,
      error: null,
      loading: false,
      promise: null,
      listeners: new Set(),
      snapshot: { data: undefined, error: null, loading: true },
    };
    cache.set(name, e);
  }
  return e;
}

function emit(e: Entry) {
  e.snapshot = { data: e.data, error: e.error, loading: e.loading || (e.data === undefined && !e.error) };
  e.listeners.forEach((l) => l());
}

export function loadCollection(name: string, force = false): Promise<void> {
  const e = entry(name);
  if (e.promise && !force) return e.promise;
  e.loading = true;
  emit(e);
  const p = api<{ items: unknown[] }>(`/api/data/${name}`)
    .then((res) => {
      e.data = res.items;
      e.error = null;
    })
    .catch((err: ApiClientError) => {
      e.error = err;
    })
    .finally(() => {
      e.loading = false;
      if (e.promise === p) e.promise = null;
      emit(e);
    });
  e.promise = p;
  return p;
}

export function invalidate(...names: string[]) {
  for (const n of names) if (cache.has(n)) void loadCollection(n, true);
}

const EMPTY = { data: undefined, error: null, loading: true };

export function useCollection<C extends CollectionName>(name: C, enabled = true) {
  const subscribe = useCallback(
    (cb: () => void) => {
      const e = entry(name);
      e.listeners.add(cb);
      return () => e.listeners.delete(cb);
    },
    [name],
  );
  const snap = useSyncExternalStore(
    subscribe,
    () => entry(name).snapshot,
    () => EMPTY,
  );

  useEffect(() => {
    if (!enabled) return;
    const e = entry(name);
    if (e.data === undefined && !e.promise) void loadCollection(name);
  }, [name, enabled]);

  const reload = useCallback(() => loadCollection(name, true), [name]);

  const create = useCallback(
    async (body: Partial<Doc<C>> | Record<string, unknown>) => {
      const res = await api<{ item: Doc<C> }>(`/api/data/${name}`, { method: "POST", body });
      await loadCollection(name, true);
      return res.item;
    },
    [name],
  );

  const update = useCallback(
    async (id: string, body: Partial<Doc<C>> | Record<string, unknown>) => {
      const res = await api<{ item: Doc<C> }>(`/api/data/${name}/${id}`, { method: "PUT", body });
      await loadCollection(name, true);
      return res.item;
    },
    [name],
  );

  const remove = useCallback(
    async (id: string) => {
      await api(`/api/data/${name}/${id}`, { method: "DELETE" });
      await loadCollection(name, true);
    },
    [name],
  );

  return {
    data: (snap.data ?? []) as Doc<C>[],
    ready: snap.data !== undefined,
    loading: enabled ? snap.loading : false,
    error: snap.error,
    reload,
    create,
    update,
    remove,
  };
}

export function useApi<T>(url: string | null) {
  const key = url ? `url:${url}` : "url:__none__";
  const subscribe = useCallback(
    (cb: () => void) => {
      const e = entry(key);
      e.listeners.add(cb);
      return () => e.listeners.delete(cb);
    },
    [key],
  );
  const snap = useSyncExternalStore(subscribe, () => entry(key).snapshot, () => EMPTY);

  const load = useCallback(() => {
    if (!url) return Promise.resolve();
    const e = entry(key);
    e.loading = true;
    emit(e);
    const p = api<T>(url)
      .then((d) => {
        e.data = d as unknown as unknown[];
        e.error = null;
      })
      .catch((err: ApiClientError) => {
        e.error = err;
      })
      .finally(() => {
        e.loading = false;
        e.promise = null;
        emit(e);
      });
    e.promise = p;
    return p;
  }, [url, key]);

  useEffect(() => {
    if (!url) return;
    const e = entry(key);
    if (e.data === undefined && !e.promise) void load();
  }, [url, key, load]);

  return { data: snap.data as unknown as T | undefined, loading: url ? snap.loading : false, error: snap.error, reload: load };
}
