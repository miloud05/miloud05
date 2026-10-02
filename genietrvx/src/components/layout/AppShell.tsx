"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown, KeyRound, Languages, LogOut, Menu, Moon, Sun, X } from "lucide-react";
import { NAV } from "./nav";
import { Logo } from "./Logo";
import { useApp } from "@/components/providers/AppProvider";
import { Button, Field, Input, Modal } from "@/components/ui";
import { api } from "@/lib/client/api";

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { t, can } = useApp();
  const pathname = usePathname();
  return (
    <nav className="scrollbar-thin flex h-full flex-col overflow-y-auto bg-navy px-3 pt-5 pb-6 text-white/80">
      <div className="mb-6 px-2">
        <Link href="/dashboard" onClick={onNavigate}>
          <Logo light />
        </Link>
      </div>
      <div className="flex flex-1 flex-col gap-5">
        {NAV.map((group, gi) => {
          const items = group.items.filter((item) => !item.resource || can(item.resource));
          if (!items.length) return null;
          return (
            <div key={gi}>
              {group.label && (
                <p className="mb-1.5 px-3 text-[10px] font-semibold tracking-widest text-white/40 uppercase">{t(group.label)}</p>
              )}
              <ul className="flex flex-col gap-0.5">
                {items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        className={clsx(
                          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                          active ? "bg-primary text-white shadow-sm" : "hover:bg-white/8 hover:text-white",
                        )}
                      >
                        <Icon className="size-[18px] shrink-0" />
                        <span className="truncate">{t(item.label)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
      <p className="mt-6 px-3 text-[10px] text-white/30">GenieTRVX © {new Date().getFullYear()}</p>
    </nav>
  );
}

function PasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, toast, errorMessage } = useApp();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/auth/password", { method: "POST", body: { currentPassword: current, newPassword: next } });
      toast(t("auth.passwordChanged"));
      setCurrent("");
      setNext("");
      onClose();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("auth.changePassword")}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="pwd-form" loading={busy}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <form id="pwd-form" onSubmit={submit} className="flex flex-col gap-4">
        <Field label={t("auth.currentPassword")} required>
          <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required autoComplete="current-password" />
        </Field>
        <Field label={t("auth.newPassword")} required hint="6+">
          <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={6} autoComplete="new-password" />
        </Field>
      </form>
    </Modal>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { t, user, lang, setLang, theme, toggleTheme, enumLabel } = useApp();
  const [drawer, setDrawer] = useState(false);
  const [menu, setMenu] = useState(false);
  const [pwd, setPwd] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menu]);

  async function logout() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/login");
    router.refresh();
  }

  const initials = (user?.name ?? "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex min-h-screen">
      <aside className="no-print fixed inset-y-0 start-0 z-30 hidden w-64 lg:block">
        <Sidebar />
      </aside>

      {drawer && (
        <div className="no-print fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-950/50" onClick={() => setDrawer(false)} />
          <div className="animate-in absolute inset-y-0 start-0 w-72 max-w-[85vw]">
            <button
              onClick={() => setDrawer(false)}
              className="absolute end-3 top-5 z-10 rounded-lg p-1 text-white/70 hover:text-white"
              aria-label={t("common.close")}
            >
              <X className="size-5" />
            </button>
            <Sidebar onNavigate={() => setDrawer(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:ps-64">
        <header className="no-print sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-surface/90 px-4 backdrop-blur sm:px-6">
          <button
            className="rounded-lg p-2 text-muted hover:bg-surface-2 lg:hidden"
            onClick={() => setDrawer(true)}
            aria-label="Menu"
          >
            <Menu className="size-5" />
          </button>
          <div className="min-w-0 flex-1 truncate text-sm text-muted">
            {pathname === "/dashboard" ? t("app.tagline") : null}
          </div>
          <button
            onClick={() => setLang(lang === "fr" ? "ar" : "fr")}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-muted hover:bg-surface-2 hover:text-text"
            title={t("common.language")}
          >
            <Languages className="size-4" />
            <span>{lang === "fr" ? "العربية" : "Français"}</span>
          </button>
          <button
            onClick={toggleTheme}
            className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-text"
            title={t("common.theme")}
            aria-label={t("common.theme")}
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenu((v) => !v);
              }}
              className="flex items-center gap-2 rounded-lg py-1 ps-1 pe-2 hover:bg-surface-2"
            >
              <span className="grid size-8 place-items-center rounded-full bg-primary-soft text-xs font-bold text-primary">{initials}</span>
              <span className="hidden text-start leading-tight sm:block">
                <span className="block text-sm font-medium">{user?.name}</span>
                <span className="block text-[11px] text-muted">{enumLabel("role", user?.role)}</span>
              </span>
              <ChevronDown className="size-4 text-muted" />
            </button>
            {menu && (
              <div className="animate-in absolute end-0 top-12 w-56 rounded-xl border border-border bg-surface p-1.5 shadow-xl" onClick={(e) => e.stopPropagation()}>
                <div className="border-b border-border px-3 py-2 text-xs text-muted">{user?.email}</div>
                <button
                  onClick={() => {
                    setMenu(false);
                    setPwd(true);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-surface-2"
                >
                  <KeyRound className="size-4" /> {t("auth.changePassword")}
                </button>
                <button onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-danger hover:bg-danger-soft">
                  <LogOut className="size-4" /> {t("common.logout")}
                </button>
              </div>
            )}
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1500px] flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
      <PasswordDialog open={pwd} onClose={() => setPwd(false)} />
    </div>
  );
}
