import type { Store } from "./db";
import { computePayslip, type AttendanceSummary, type PayrollRates } from "@/lib/calc/payroll";
import type { Attendance, Employee, Payslip } from "@/lib/schemas";

export function summarizeAttendance(
  records: readonly Pick<Attendance, "status" | "overtimeHours">[],
  employee: Pick<Employee, "salaryType">,
  rates: Pick<PayrollRates, "workingDays">,
): AttendanceSummary {
  if (records.length === 0) {
    return employee.salaryType === "monthly"
      ? { daysPresent: rates.workingDays, halfDays: 0, absences: 0, overtimeHours: 0, weatherDays: 0 }
      : { daysPresent: 0, halfDays: 0, absences: 0, overtimeHours: 0, weatherDays: 0 };
  }
  const count = (s: string) => records.filter((r) => r.status === s).length;
  const paidLeave = employee.salaryType === "monthly" ? count("leave") : 0;
  return {
    daysPresent: count("present") + paidLeave,
    halfDays: count("half"),
    absences: count("absent") + count("sick"),
    overtimeHours: records.reduce((a, r) => a + (Number(r.overtimeHours) || 0), 0),
    weatherDays: count("weather"),
  };
}

/**
 * Génère (ou régénère) les bulletins d'une période « AAAA-MM » à partir du pointage.
 * Les bulletins déjà validés ou payés ne sont jamais écrasés.
 */
export function generatePayslips(
  store: Store,
  period: string,
  rates: PayrollRates,
  options: { projectId?: string } = {},
): { created: number; updated: number; skipped: number } {
  const employees = store
    .list<Employee>("employees")
    .filter((e) => e.status === "active" && (!options.projectId || e.projectId === options.projectId));
  const attendance = store.list<Attendance>("attendance").filter((a) => a.date.startsWith(period));
  const existing = store.list<Payslip>("payslips").filter((p) => p.period === period);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  store.transaction(() => {
    for (const emp of employees) {
      const records = attendance.filter((a) => a.employeeId === emp.id);
      const summary = summarizeAttendance(records, emp, rates);
      const current = existing.find((p) => p.employeeId === emp.id);
      if (current && current.status !== "draft") {
        skipped++;
        continue;
      }
      if (emp.salaryType === "daily" && summary.daysPresent + summary.halfDays === 0) {
        skipped++;
        continue;
      }
      const slip = computePayslip({ ...emp, salaryType: emp.salaryType === "daily" ? "daily" : "monthly" }, summary, rates);
      const doc = {
        employeeId: emp.id,
        period,
        projectId: emp.projectId,
        ...summary,
        ...slip,
        status: "draft",
      };
      if (current) {
        store.update("payslips", current.id, doc);
        updated++;
      } else {
        store.insert("payslips", doc);
        created++;
      }
    }
  });

  return { created, updated, skipped };
}
