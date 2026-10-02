"use client";

import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LANG_COOKIE, translate, type Lang, type Vars } from "@/lib/i18n";
import { can as canAccess, type Resource, type Role } from "@/lib/permissions";
import { formatDate, formatMoney, formatNumber } from "@/lib/calc/money";
import { ApiClientError } from "@/lib/client/api";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

type ToastKind = "success" | "error" | "info";
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface AppContextValue {
  lang: Lang;
  dir: "ltr" | "rtl";
  t: (key: string, vars?: Vars) => string;
  setLang: (lang: Lang) => void;
  theme: "light" | "dark";
  toggleTheme: () => void;
  user: CurrentUser | null;
  can: (resource: Resource, mode?: "read" | "write") => boolean;
  money: (v: number) => string;
  number: (v: number, digits?: number) => string;
  date: (v: string | undefined | null) => string;
  enumLabel: (enumKey: string, value: string | undefined) => string;
  toast: (message: string, kind?: ToastKind) => void;
  errorMessage: (err: unknown) => string;
}

const AppContext = createContext<AppContextValue | null>(null);

const THEME_EVENT = "gtx-theme";

/** Le thème est appliqué avant l'hydratation par un script inline (voir app/layout.tsx). */
function readTheme(): "light" | "dark" {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function subscribeTheme(cb: () => void) {
  window.addEventListener(THEME_EVENT, cb);
  return () => window.removeEventListener(THEME_EVENT, cb);
}

export function AppProvider({
  lang: initialLang,
  user,
  children,
}: {
  lang: Lang;
  user: CurrentUser | null;
  children: ReactNode;
}) {
  const router = useRouter();
  const [lang, setLangState] = useState<Lang>(initialLang);
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "light" as const);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toggleTheme = useCallback(() => {
    const next = readTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("gtx_theme", next);
    } catch {
      /* stockage indisponible */
    }
    window.dispatchEvent(new Event(THEME_EVENT));
  }, []);

  const setLang = useCallback(
    (next: Lang) => {
      document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
      document.documentElement.lang = next;
      document.documentElement.dir = next === "ar" ? "rtl" : "ltr";
      setLangState(next);
      router.refresh();
    },
    [router],
  );

  const toast = useCallback((message: string, kind: ToastKind = "success") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 4200);
  }, []);

  const value = useMemo<AppContextValue>(() => {
    const t = (key: string, vars?: Vars) => translate(lang, key, vars);
    return {
      lang,
      dir: lang === "ar" ? "rtl" : "ltr",
      t,
      setLang,
      theme,
      toggleTheme,
      user,
      can: (resource, mode = "read") => canAccess(user?.role, resource, mode),
      money: (v) => formatMoney(v, lang),
      number: (v, digits = 2) => formatNumber(v, digits, lang),
      date: (v) => formatDate(v, lang),
      enumLabel: (enumKey, v) => (v ? translate(lang, `enums.${enumKey}.${v}`) : "—"),
      toast,
      errorMessage: (err) => {
        if (err instanceof ApiClientError) {
          const details = Array.isArray(err.details) ? (err.details[0] as Record<string, unknown> | undefined) : err.details;
          const vars: Vars = {};
          if (details && typeof details === "object") {
            for (const [k, v] of Object.entries(details)) if (typeof v === "string" || typeof v === "number") vars[k] = v;
          }
          if (err.code === "validation" && details && typeof details === "object" && "message" in details) {
            const specific = translate(lang, `errors.${String(details.message)}`, vars);
            if (!specific.startsWith("errors.")) return specific;
          }
          const msg = translate(lang, `errors.${err.code}`, vars);
          return msg.startsWith("errors.") ? t("common.error") : msg;
        }
        return t("common.error");
      },
    };
  }, [lang, setLang, theme, toggleTheme, user, toast]);

  return (
    <AppContext.Provider value={value}>
      {children}
      <div className="no-print pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4">
        {toasts.map((x) => (
          <div
            key={x.id}
            role="status"
            className={`animate-in pointer-events-auto max-w-md rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${
              x.kind === "error"
                ? "bg-danger text-white"
                : x.kind === "info"
                  ? "bg-navy text-white"
                  : "bg-success text-white"
            }`}
          >
            {x.message}
          </div>
        ))}
      </div>
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
}
