"use client";

import clsx from "clsx";
import { useMemo, useState } from "react";
import { CalendarCheck, CheckCheck, ChevronLeft, ChevronRight, Printer, Save } from "lucide-react";
import { Badge, Button, ButtonLink, Card, EmptyState, Input, PageHeader, Select, Skeleton, Table, Td, Th } from "@/components/ui";
import { useApp } from "@/components/providers/AppProvider";
import { api, invalidate, useCollection } from "@/lib/client/api";
import { addDays, todayIso } from "@/lib/calc/money";
import { ENUMS } from "@/lib/schemas";

type Entry = { status: string; overtimeHours: number };

const STATUS_STYLE: Record<string, string> = {
  present: "bg-success text-white",
  half: "bg-info text-white",
  absent: "bg-danger text-white",
  leave: "bg-primary text-white",
  weather: "bg-warning text-white",
  sick: "bg-amber-600 text-white",
};

export default function AttendancePage() {
  const { t, can, toast, errorMessage, enumLabel, date: fmtDate } = useApp();
  const { data: employees, ready: empReady } = useCollection("employees");
  const { data: projects } = useCollection("projects");
  const { data: attendance, ready: attReady } = useCollection("attendance");
  const [date, setDate] = useState(todayIso());
  const [projectId, setProjectId] = useState("");
  const [draft, setDraft] = useState<{ date: string; entries: Partial<Record<string, Entry>> } | null>(null);
  const [busy, setBusy] = useState(false);
  const writable = can("attendance", "write");

  const staff = useMemo(
    () =>
      employees
        .filter((e) => e.status === "active" && (!projectId || e.projectId === projectId))
        .sort((a, b) => a.lastName.localeCompare(b.lastName)),
    [employees, projectId],
  );

  const saved = useMemo(() => {
    const map: Partial<Record<string, Entry>> = {};
    for (const a of attendance) if (a.date === date) map[a.employeeId] = { status: a.status, overtimeHours: a.overtimeHours };
    return map;
  }, [attendance, date]);
  const dirty = draft !== null && draft.date === date;
  const entries = dirty ? draft.entries : saved;

  const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
  const weekend = dow === 5 || dow === 6;
  const month = date.slice(0, 7);

  const summary = useMemo(() => {
    const rows = new Map<string, Record<string, number>>();
    for (const a of attendance) {
      if (!a.date.startsWith(month)) continue;
      const r = rows.get(a.employeeId) ?? { present: 0, half: 0, absent: 0, leave: 0, weather: 0, sick: 0, overtime: 0 };
      r[a.status] = (r[a.status] ?? 0) + 1;
      r.overtime += a.overtimeHours;
      rows.set(a.employeeId, r);
    }
    return rows;
  }, [attendance, month]);

  function set(id: string, patch: Partial<Entry>) {
    setDraft({ date, entries: { ...entries, [id]: { ...(entries[id] ?? { status: "present", overtimeHours: 0 }), ...patch } } });
  }

  async function save() {
    setBusy(true);
    try {
      const list = staff.flatMap((e) => {
        const entry = entries[e.id];
        return entry ? [{ employeeId: e.id, status: entry.status, overtimeHours: entry.overtimeHours }] : [];
      });
      const res = await api<{ saved: number }>("/api/attendance/bulk", { method: "POST", body: { date, projectId, entries: list } });
      invalidate("attendance");
      toast(t("attendance.saved", { count: res.saved }));
      setDraft(null);
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={t("attendance.title")}
        subtitle={t("attendance.subtitle")}
        actions={
          <ButtonLink href={`/print/attendance/${month}${projectId ? `?project=${projectId}` : ""}`} target="_blank" variant="secondary" icon={<Printer className="size-4" />}>
            {t("attendance.printSheet")}
          </ButtonLink>
        }
      />

      <Card className="mb-6" padded={false}>
        <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-center">
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setDate(addDays(date, -1))} aria-label={t("common.previous")}>
              <ChevronLeft className="size-4 rtl:rotate-180" />
            </Button>
            <Input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="w-44" />
            <Button variant="secondary" size="sm" onClick={() => setDate(addDays(date, 1))} aria-label={t("common.next")}>
              <ChevronRight className="size-4 rtl:rotate-180" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDate(todayIso())}>
              {t("common.today")}
            </Button>
          </div>
          <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="md:w-72" aria-label={t("fields.project")}>
            <option value="">{t("projects.allProjects")}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name}
              </option>
            ))}
          </Select>
          <div className="flex flex-1 items-center justify-end gap-2">
            {weekend && <Badge tone="warning">{t("attendance.weekend")}</Badge>}
            {dirty && <Badge tone="info">{t("attendance.unsaved")}</Badge>}
            {writable && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<CheckCheck className="size-4" />}
                  onClick={() => {
                    const next = { ...entries };
                    staff.forEach((e) => (next[e.id] = { overtimeHours: next[e.id]?.overtimeHours ?? 0, status: "present" }));
                    setDraft({ date, entries: next });
                  }}
                >
                  {t("attendance.markAll")}
                </Button>
                <Button size="sm" icon={<Save className="size-4" />} loading={busy} onClick={save} disabled={!dirty}>
                  {t("attendance.save")}
                </Button>
              </>
            )}
          </div>
        </div>
        <div className="px-4 py-3 text-sm font-semibold">{t("attendance.sheet", { date: fmtDate(date) })}</div>
        {!empReady || !attReady ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : staff.length === 0 ? (
          <EmptyState icon={<CalendarCheck className="size-6" />} title={t("attendance.noEmployees")} />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{t("fields.employee")}</Th>
                <Th>{t("fields.status")}</Th>
                <Th align="end">{t("fields.overtimeHours")}</Th>
              </tr>
            </thead>
            <tbody>
              {staff.map((e) => {
                const entry = entries[e.id];
                return (
                  <tr key={e.id}>
                    <Td>
                      <p className="font-medium">
                        {e.lastName} {e.firstName}
                      </p>
                      <p className="text-xs text-muted">
                        {e.matricule} · {e.position}
                      </p>
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {ENUMS.attendanceStatus.map((s) => (
                          <button
                            key={s}
                            disabled={!writable}
                            onClick={() => set(e.id, { status: s })}
                            className={clsx(
                              "rounded-md px-2.5 py-1 text-xs font-medium transition",
                              entry?.status === s ? STATUS_STYLE[s] : "bg-surface-2 text-muted hover:text-text",
                            )}
                          >
                            {enumLabel("attendanceStatus", s)}
                          </button>
                        ))}
                      </div>
                    </Td>
                    <Td align="end">
                      <Input
                        type="number"
                        dir="ltr"
                        min={0}
                        max={12}
                        step="0.5"
                        disabled={!writable}
                        value={entry?.overtimeHours ?? 0}
                        onChange={(ev) => set(e.id, { overtimeHours: Number(ev.target.value) })}
                        className="ms-auto h-9 w-20 text-end"
                        aria-label={t("fields.overtimeHours")}
                      />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <Card title={`${t("attendance.summary")} — ${month}`} padded={false}>
        <Table>
          <thead>
            <tr>
              <Th>{t("fields.employee")}</Th>
              {ENUMS.attendanceStatus.map((s) => (
                <Th key={s} align="center">
                  {enumLabel("attendanceStatus", s)}
                </Th>
              ))}
              <Th align="center">{t("fields.overtimeHours")}</Th>
            </tr>
          </thead>
          <tbody>
            {staff.map((e) => {
              const r = summary.get(e.id);
              return (
                <tr key={e.id}>
                  <Td className="font-medium">
                    {e.lastName} {e.firstName}
                  </Td>
                  {ENUMS.attendanceStatus.map((s) => (
                    <Td key={s} align="center" className="num">
                      {r?.[s] || "—"}
                    </Td>
                  ))}
                  <Td align="center" className="num">
                    {r?.overtime || "—"}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
