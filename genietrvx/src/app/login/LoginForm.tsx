"use client";

import { useState } from "react";
import { CircleCheck, Languages, LogIn, Moon, Sun } from "lucide-react";
import { useApp } from "@/components/providers/AppProvider";
import { Button, Field, Input } from "@/components/ui";
import { Logo, LogoMark } from "@/components/layout/Logo";
import { api } from "@/lib/client/api";

const DEMO_ACCOUNTS = [
  ["admin@genietrvx.dz", "admin"],
  ["direction@genietrvx.dz", "manager"],
  ["compta@genietrvx.dz", "accountant"],
  ["chef@genietrvx.dz", "site_manager"],
] as const;
const DEMO_PASSWORD = "Demo@2026";

export function LoginForm({ next, demo }: { next: string; demo: boolean }) {
  const { t, lang, setLang, theme, toggleTheme, enumLabel, errorMessage } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/login", { method: "POST", body: { email, password } });
      window.location.href = next;
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden bg-navy p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="pointer-events-none absolute -end-32 -bottom-32 size-[480px] rounded-full bg-primary/25 blur-3xl" />
        <Logo light />
        <div className="relative max-w-xl">
          <h1 className="text-4xl leading-tight font-extrabold">{t("auth.heroTitle")}</h1>
          <p className="mt-4 text-lg text-white/70">{t("auth.heroText")}</p>
          <ul className="mt-8 grid gap-3">
            {["feature1", "feature2", "feature3", "feature4"].map((f) => (
              <li key={f} className="flex items-center gap-3 text-white/85">
                <CircleCheck className="size-5 text-primary" /> {t(`auth.${f}`)}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-white/40">© {new Date().getFullYear()} GenieTRVX</p>
      </div>

      <div className="flex flex-col">
        <div className="flex justify-end gap-1 p-4">
          <button
            onClick={() => setLang(lang === "fr" ? "ar" : "fr")}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-text"
          >
            <Languages className="size-4" /> {lang === "fr" ? "العربية" : "Français"}
          </button>
          <button onClick={toggleTheme} className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-text" aria-label={t("common.theme")}>
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
        </div>
        <div className="flex flex-1 items-center justify-center px-6 pb-16">
          <div className="w-full max-w-sm">
            <div className="mb-8 flex flex-col items-center text-center lg:items-start lg:text-start">
              <div className="mb-6 lg:hidden">
                <LogoMark className="size-12" />
              </div>
              <h2 className="text-2xl font-bold">{t("auth.title")}</h2>
              <p className="mt-1 text-sm text-muted">{t("auth.subtitle")}</p>
            </div>
            <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
              <Field label={t("auth.email")} htmlFor="email">
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  dir="ltr"
                />
              </Field>
              <Field label={t("auth.password")} htmlFor="password">
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  dir="ltr"
                />
              </Field>
              {error && (
                <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
                  {error}
                </p>
              )}
              <Button type="submit" loading={busy} icon={<LogIn className="size-4" />} className="mt-2 w-full">
                {busy ? t("auth.submitting") : t("auth.submit")}
              </Button>
            </form>

            {demo && (
              <div className="mt-8 rounded-xl border border-dashed border-border p-4">
                <p className="text-xs font-semibold text-muted uppercase">{t("auth.demo")}</p>
                <p className="mt-1 text-xs text-muted">{t("auth.demoHint", { password: DEMO_PASSWORD })}</p>
                <div className="mt-3 grid gap-1.5">
                  {DEMO_ACCOUNTS.map(([mail, role]) => (
                    <button
                      key={mail}
                      type="button"
                      onClick={() => {
                        setEmail(mail);
                        setPassword(DEMO_PASSWORD);
                      }}
                      className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-start text-xs hover:bg-surface-2"
                    >
                      <span dir="ltr" className="font-mono">{mail}</span>
                      <span className="text-muted">{enumLabel("role", role)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
