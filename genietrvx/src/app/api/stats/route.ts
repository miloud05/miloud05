import { NextResponse } from "next/server";
import { getSettings, getStore } from "@/lib/server/store";
import { handler, requireUser } from "@/lib/server/api";
import { can } from "@/lib/permissions";
import { computeDocumentTotals, invoiceBalance } from "@/lib/calc/documents";
import { computeDqeTotals } from "@/lib/calc/market";
import { currentStock } from "@/lib/calc/stock";
import { addDays, round2, todayIso } from "@/lib/calc/money";
import type {
  Attendance,
  Employee,
  Equipment,
  Expense,
  Invoice,
  Market,
  Material,
  Payslip,
  Project,
  StockMovement,
} from "@/lib/schemas";

export const dynamic = "force-dynamic";

function lastMonths(n: number): string[] {
  const now = new Date();
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth() - i, 1));
    out.push(d.toISOString().slice(0, 7));
  }
  return out;
}

export const GET = handler(async () => {
  const user = await requireUser();
  const store = getStore();
  const today = todayIso();
  const months = lastMonths(12);
  const alerts: Array<{ type: string; severity: "danger" | "warning" | "info"; label: string; date?: string; href: string }> = [];

  const projects = store.list<Project>("projects");
  const expenses = can(user.role, "expenses", "read") ? store.list<Expense>("expenses") : [];
  const spentByProject = new Map<string, number>();
  for (const e of expenses) spentByProject.set(e.projectId, (spentByProject.get(e.projectId) ?? 0) + e.amount);

  const active = projects.filter((p) => p.status === "ongoing");
  const late = active.filter((p) => p.endDate && p.endDate < today);
  for (const p of late) alerts.push({ type: "project_late", severity: "danger", label: p.name, date: p.endDate, href: `/projects/${p.id}` });

  const result: Record<string, unknown> = {
    projects: {
      total: projects.length,
      active: active.length,
      completed: projects.filter((p) => p.status === "completed" || p.status === "delivered").length,
      late: late.length,
      avgProgress: active.length ? round2(active.reduce((a, p) => a + p.progress, 0) / active.length) : 0,
      budget: round2(active.reduce((a, p) => a + p.budget, 0)),
      list: active
        .sort((a, b) => b.budget - a.budget)
        .slice(0, 6)
        .map((p) => ({
          id: p.id,
          name: p.name,
          code: p.code,
          progress: p.progress,
          budget: p.budget,
          spent: round2(spentByProject.get(p.id) ?? 0),
          endDate: p.endDate,
          wilaya: p.wilaya,
        })),
    },
  };

  if (can(user.role, "invoices", "read")) {
    const { stampRate, stampMax } = getSettings(store).invoicing;
    const invoices = store.list<Invoice>("invoices").filter((i) => i.status !== "cancelled" && i.status !== "draft");
    const revenue = months.map(() => 0);
    const collected = months.map(() => 0);
    let invoiced = 0;
    let paid = 0;
    let overdueAmount = 0;
    let overdueCount = 0;
    for (const inv of invoices) {
      const totals = computeDocumentTotals(inv.lines, {
        discountRate: inv.discountRate,
        tvaRate: inv.tvaRate,
        stamp: { enabled: inv.stampEnabled, rate: stampRate, max: stampMax },
      });
      const bal = invoiceBalance(totals.totalDue, inv.payments);
      invoiced += totals.totalDue;
      paid += bal.paid;
      const mi = months.indexOf(inv.date.slice(0, 7));
      if (mi >= 0) revenue[mi] += totals.totalHT;
      for (const pay of inv.payments) {
        const pi = months.indexOf(pay.date.slice(0, 7));
        if (pi >= 0) collected[pi] += pay.amount;
      }
      if (bal.remaining > 0 && inv.dueDate && inv.dueDate < today) {
        overdueAmount += bal.remaining;
        overdueCount++;
        alerts.push({ type: "invoice_overdue", severity: "danger", label: inv.number, date: inv.dueDate, href: `/invoices/${inv.id}` });
      }
    }
    result.finance = {
      invoiced: round2(invoiced),
      collected: round2(paid),
      outstanding: round2(invoiced - paid),
      overdueAmount: round2(overdueAmount),
      overdueCount,
    };
    result.series = months.map((m, i) => ({ month: m, revenue: round2(revenue[i]), collected: round2(collected[i]), expenses: 0 }));
  } else {
    result.series = months.map((m) => ({ month: m, revenue: 0, collected: 0, expenses: 0 }));
  }

  if (expenses.length) {
    const series = result.series as Array<{ month: string; expenses: number }>;
    const byCategory = new Map<string, number>();
    for (const e of expenses) {
      const row = series.find((s) => s.month === e.date.slice(0, 7));
      if (row) row.expenses = round2(row.expenses + e.amount);
      byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount);
    }
    result.expenses = {
      month: round2(expenses.filter((e) => e.date.startsWith(today.slice(0, 7))).reduce((a, e) => a + e.amount, 0)),
      total: round2(expenses.reduce((a, e) => a + e.amount, 0)),
      byCategory: [...byCategory.entries()].map(([category, amount]) => ({ category, amount: round2(amount) })).sort((a, b) => b.amount - a.amount),
    };
  }

  if (can(user.role, "markets", "read")) {
    const markets = store.list<Market>("markets");
    let portfolio = 0;
    for (const m of markets) {
      if (m.status === "closed") continue;
      portfolio += computeDqeTotals(m.items, m.tvaRate, m.amendments).totalTTC;
      for (const b of m.bonds) {
        if (b.expiryDate && b.expiryDate >= today && b.expiryDate <= addDays(today, 30)) {
          alerts.push({ type: "bond_expiring", severity: "warning", label: `${m.reference} — ${b.bank}`, date: b.expiryDate, href: `/markets/${m.id}` });
        }
      }
    }
    result.markets = { count: markets.filter((m) => m.status !== "closed").length, portfolio: round2(portfolio) };
  }

  const employees = store.list<Employee>("employees").filter((e) => e.status === "active");
  const todayAttendance = can(user.role, "attendance", "read")
    ? store.list<Attendance>("attendance").filter((a) => a.date === today)
    : [];
  result.workforce = {
    active: employees.length,
    presentToday: todayAttendance.filter((a) => a.status === "present" || a.status === "half").length,
    recordedToday: todayAttendance.length,
  };
  if (can(user.role, "payslips", "read")) {
    const slips = store.list<Payslip>("payslips");
    const lastPeriod = slips.map((s) => s.period).sort().at(-1);
    (result.workforce as Record<string, unknown>).payrollPeriod = lastPeriod ?? null;
    (result.workforce as Record<string, unknown>).payrollMass = round2(
      slips.filter((s) => s.period === lastPeriod).reduce((a, s) => a + s.employerCost, 0),
    );
  }

  if (can(user.role, "materials", "read")) {
    const materials = store.list<Material>("materials");
    const movements = store.list<StockMovement>("stockMovements");
    let value = 0;
    const low: Array<{ id: string; name: string; stock: number; min: number; unit: string }> = [];
    for (const m of materials) {
      const qty = currentStock(m, movements);
      value += Math.max(0, qty) * m.unitPrice;
      if (qty <= m.minStock) {
        low.push({ id: m.id, name: m.name, stock: qty, min: m.minStock, unit: m.unit });
        alerts.push({ type: "stock_low", severity: qty <= 0 ? "danger" : "warning", label: m.name, href: "/materials" });
      }
    }
    result.stock = { items: materials.length, value: round2(value), low };
  }

  if (can(user.role, "equipment", "read")) {
    const equipment = store.list<Equipment>("equipment");
    for (const e of equipment) {
      if (e.nextMaintenance && e.nextMaintenance <= addDays(today, 7)) {
        alerts.push({ type: "maintenance_due", severity: e.nextMaintenance < today ? "danger" : "warning", label: `${e.code} — ${e.name}`, date: e.nextMaintenance, href: "/equipment" });
      }
      if (e.insuranceExpiry && e.insuranceExpiry <= addDays(today, 15)) {
        alerts.push({ type: "insurance_expiring", severity: "warning", label: `${e.code} — ${e.name}`, date: e.insuranceExpiry, href: "/equipment" });
      }
    }
    result.equipment = {
      total: equipment.length,
      inUse: equipment.filter((e) => e.status === "in_use").length,
      available: equipment.filter((e) => e.status === "available").length,
      down: equipment.filter((e) => e.status === "broken" || e.status === "maintenance").length,
    };
  }

  const order = { danger: 0, warning: 1, info: 2 };
  result.alerts = alerts.sort((a, b) => order[a.severity] - order[b.severity]).slice(0, 30);
  result.activity = store.list("activity").slice(0, 12);
  return NextResponse.json(result);
});
