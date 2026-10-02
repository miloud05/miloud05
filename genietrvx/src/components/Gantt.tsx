"use client";

import clsx from "clsx";
import { useMemo, useState } from "react";
import { useApp } from "@/components/providers/AppProvider";
import { addDays, daysBetween, todayIso } from "@/lib/calc/money";
import type { Task } from "@/lib/schemas";

type Zoom = "day" | "week" | "month";
const DAY_WIDTH: Record<Zoom, number> = { day: 30, week: 11, month: 3.6 };
const ROW = 40;

export interface GanttRow {
  task: Task;
  group?: string;
  color?: string;
}

const PALETTE = ["#e8590c", "#2563eb", "#15803d", "#9333ea", "#0891b2", "#b45309", "#db2777"];

export function Gantt({
  rows,
  onSelect,
  initialZoom = "week",
}: {
  rows: GanttRow[];
  onSelect?: (task: Task) => void;
  initialZoom?: Zoom;
}) {
  const { t, date, lang } = useApp();
  const [zoom, setZoom] = useState<Zoom>(initialZoom);
  const today = todayIso();

  const { start, days } = useMemo(() => {
    if (!rows.length) return { start: today, days: 30 };
    const min = rows.reduce((m, r) => (r.task.startDate < m ? r.task.startDate : m), rows[0].task.startDate);
    const max = rows.reduce((m, r) => (r.task.endDate > m ? r.task.endDate : m), rows[0].task.endDate);
    const s = addDays(min < today ? min : today, -3);
    const e = addDays(max > today ? max : today, 7);
    return { start: s, days: Math.max(14, daysBetween(s, e) + 1) };
  }, [rows, today]);

  const dw = DAY_WIDTH[zoom];
  const width = Math.ceil(days * dw);

  const months = useMemo(() => {
    const out: Array<{ label: string; left: number; width: number }> = [];
    let cursor = start;
    while (daysBetween(start, cursor) < days) {
      const d = new Date(`${cursor}T00:00:00Z`);
      const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
      const from = daysBetween(start, cursor);
      const to = Math.min(days, daysBetween(start, next));
      out.push({
        label: new Intl.DateTimeFormat(lang === "ar" ? "ar-DZ" : "fr-FR", { month: zoom === "month" ? "short" : "long", year: "numeric", numberingSystem: "latn" }).format(d),
        left: from * dw,
        width: (to - from) * dw,
      });
      cursor = next;
    }
    return out;
  }, [start, days, dw, zoom, lang]);

  const ticks = useMemo(() => {
    const out: Array<{ label: string; left: number; weekend: boolean }> = [];
    if (zoom === "month") return out;
    for (let i = 0; i < days; i++) {
      const iso = addDays(start, i);
      const d = new Date(`${iso}T00:00:00Z`);
      const dow = d.getUTCDay();
      if (zoom === "day") out.push({ label: String(d.getUTCDate()), left: i * dw, weekend: dow === 5 || dow === 6 });
      else if (dow === 0) out.push({ label: String(d.getUTCDate()), left: i * dw, weekend: false });
    }
    return out;
  }, [start, days, dw, zoom]);

  const todayLeft = daysBetween(start, today) * dw;
  const groupColors = new Map<string, string>();

  return (
    <div className="flex flex-col gap-3">
      <div className="no-print flex items-center gap-2 text-xs">
        <span className="text-muted">{t("projects.zoom")} :</span>
        {(["day", "week", "month"] as Zoom[]).map((z) => (
          <button
            key={z}
            onClick={() => setZoom(z)}
            className={clsx("rounded-md px-2.5 py-1 font-medium", zoom === z ? "bg-primary text-white" : "bg-surface-2 text-muted hover:text-text")}
          >
            {t(`projects.zoom${z[0].toUpperCase()}${z.slice(1)}`)}
          </button>
        ))}
      </div>
      <div className="flex overflow-hidden rounded-xl border border-border" dir="ltr">
        <div className="w-56 shrink-0 border-e border-border bg-surface sm:w-72" dir={lang === "ar" ? "rtl" : "ltr"}>
          <div className="flex h-12 items-end border-b border-border bg-surface-2 px-3 pb-2 text-[11px] font-semibold text-muted uppercase">
            {t("fields.taskName")}
          </div>
          {rows.map(({ task, group }) => (
            <button
              key={task.id}
              onClick={() => onSelect?.(task)}
              className="flex w-full flex-col justify-center border-b border-border px-3 text-start hover:bg-surface-2"
              style={{ height: ROW }}
            >
              <span className="truncate text-xs font-medium">{task.name}</span>
              <span className="truncate text-[10px] text-muted">
                {group ? `${group} · ` : ""}
                {date(task.startDate)} → {date(task.endDate)}
              </span>
            </button>
          ))}
        </div>
        <div className="scrollbar-thin flex-1 overflow-x-auto bg-surface">
          <div className="relative" style={{ width, minHeight: 48 + rows.length * ROW }}>
            <div className="sticky top-0 h-12 border-b border-border bg-surface-2">
              {months.map((m, i) => (
                <div key={i} className="absolute top-0 h-6 truncate border-s border-border px-1.5 pt-1 text-[11px] font-semibold capitalize" style={{ left: m.left, width: m.width }}>
                  {m.label}
                </div>
              ))}
              {ticks.map((tk, i) => (
                <div key={i} className={clsx("absolute top-6 h-6 border-s border-border pt-1 text-center text-[10px] text-muted", tk.weekend && "bg-border/40")} style={{ left: tk.left, width: zoom === "day" ? dw : 7 * dw }}>
                  {tk.label}
                </div>
              ))}
            </div>
            {zoom === "day" &&
              ticks.filter((tk) => tk.weekend).map((tk, i) => (
                <div key={i} className="absolute bottom-0 bg-surface-2/70" style={{ left: tk.left, width: dw, top: 48 }} />
              ))}
            {rows.map(({ task, group, color }, i) => {
              const left = daysBetween(start, task.startDate) * dw;
              const w = Math.max(dw, (daysBetween(task.startDate, task.endDate) + 1) * dw);
              let c = color;
              if (!c) {
                const key = group ?? "_";
                if (!groupColors.has(key)) groupColors.set(key, PALETTE[groupColors.size % PALETTE.length]);
                c = groupColors.get(key)!;
              }
              const late = task.progress < 100 && task.endDate < today;
              return (
                <div key={task.id} className="absolute inset-x-0 border-b border-border/60" style={{ top: 48 + i * ROW, height: ROW }}>
                  <button
                    onClick={() => onSelect?.(task)}
                    title={`${task.name} — ${task.progress}%`}
                    className={clsx("absolute top-2 h-6 overflow-hidden rounded-md text-start shadow-sm", late && "ring-2 ring-danger/70")}
                    style={{ left, width: w, background: `${c}33` }}
                  >
                    <span className="absolute inset-y-0 start-0 rounded-md" style={{ width: `${task.progress}%`, background: c }} />
                    <span className="relative px-1.5 text-[10px] leading-6 font-semibold whitespace-nowrap text-slate-900 dark:text-white">
                      {w > 46 ? `${task.progress}%` : ""}
                    </span>
                  </button>
                </div>
              );
            })}
            {todayLeft >= 0 && todayLeft <= width && (
              <div className="pointer-events-none absolute bottom-0 w-px bg-danger" style={{ left: todayLeft, top: 24 }}>
                <span className="absolute -top-0 -translate-x-1/2 rounded bg-danger px-1 text-[9px] font-bold text-white">{t("projects.todayMarker")}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Avancement global pondéré par la durée des tâches. */
export function weightedProgress(tasks: readonly Task[]): number {
  let total = 0;
  let done = 0;
  for (const tk of tasks) {
    const d = Math.max(1, daysBetween(tk.startDate, tk.endDate) + 1);
    total += d;
    done += (d * tk.progress) / 100;
  }
  return total ? Math.round((done / total) * 100) : 0;
}
