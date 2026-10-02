import { describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { Store } from "@/lib/server/db";
import { seedDatabase, DEMO_PASSWORD } from "@/lib/server/seed";
import { generatePayslips, summarizeAttendance } from "@/lib/server/payroll-service";
import { COLLECTIONS, schemas, settingsSchema } from "@/lib/schemas";
import { DEFAULT_PAYROLL_RATES } from "@/lib/calc/payroll";

describe("Store", () => {
  it("insère, lit, met à jour et supprime des documents", () => {
    const s = new Store(":memory:");
    const doc = s.insert("clients", { name: "A" });
    expect(s.get("clients", doc.id)?.name).toBe("A");
    s.update("clients", doc.id, { name: "B" });
    expect(s.get("clients", doc.id)?.name).toBe("B");
    expect(s.list("clients")).toHaveLength(1);
    expect(s.remove("clients", doc.id)).toBe(true);
    expect(s.list("clients")).toHaveLength(0);
  });

  it("annule une transaction en cas d'erreur", () => {
    const s = new Store(":memory:");
    expect(() =>
      s.transaction(() => {
        s.insert("clients", { name: "X" });
        throw new Error("boom");
      }),
    ).toThrow("boom");
    expect(s.count("clients")).toBe(0);
  });

  it("sauvegarde et restaure toutes les données", () => {
    const s = new Store(":memory:");
    s.insert("clients", { name: "A" });
    const dump = s.dump();
    s.clear();
    s.restore(dump);
    expect(s.list("clients")[0].name).toBe("A");
  });
});

describe("seedDatabase", () => {
  const store = new Store(":memory:");
  seedDatabase(store, { demo: true });

  it("crée un administrateur avec un mot de passe haché", () => {
    const admin = store.list<{ email: string; passwordHash: string; role: string }>("users").find((u) => u.role === "admin");
    expect(admin?.email).toBe("admin@genietrvx.dz");
    expect(bcrypt.compareSync(DEMO_PASSWORD, admin!.passwordHash)).toBe(true);
  });

  it("produit des données de démonstration conformes aux schémas", () => {
    for (const c of COLLECTIONS) {
      for (const doc of store.list<Record<string, unknown>>(c)) {
        const result = schemas[c].safeParse(doc);
        if (!result.success) throw new Error(`${c}: ${JSON.stringify(result.error.issues)}`);
      }
    }
    expect(store.count("projects")).toBeGreaterThan(3);
    expect(store.count("payslips")).toBeGreaterThan(5);
    expect(settingsSchema.safeParse(store.get("settings", "main")).success).toBe(true);
  });

  it("ne réensemence pas une base existante", () => {
    const before = store.count("projects");
    seedDatabase(store, { demo: true });
    expect(store.count("projects")).toBe(before);
  });
});

describe("generatePayslips", () => {
  it("génère les bulletins à partir du pointage et ne touche pas aux bulletins validés", () => {
    const s = new Store(":memory:");
    const emp = s.insert("employees", schemas.employees.parse({
      firstName: "A",
      lastName: "B",
      salaryType: "daily",
      dailyRate: 2000,
    }));
    s.insert("attendance", { date: "2026-03-01", employeeId: emp.id, projectId: "", status: "present", overtimeHours: 0 });
    s.insert("attendance", { date: "2026-03-02", employeeId: emp.id, projectId: "", status: "present", overtimeHours: 0 });
    s.insert("attendance", { date: "2026-04-01", employeeId: emp.id, projectId: "", status: "present", overtimeHours: 0 });

    const r1 = generatePayslips(s, "2026-03", DEFAULT_PAYROLL_RATES);
    expect(r1.created).toBe(1);
    const slip = s.list<{ id: string; base: number; status: string }>("payslips")[0];
    expect(slip.base).toBe(4000);

    s.update("payslips", slip.id, { ...s.get("payslips", slip.id)!, status: "validated" });
    const r2 = generatePayslips(s, "2026-03", DEFAULT_PAYROLL_RATES);
    expect(r2.skipped).toBe(1);
    expect(r2.created + r2.updated).toBe(0);
  });

  it("considère un mois complet pour un mensuel sans pointage", () => {
    const sum = summarizeAttendance([], { salaryType: "monthly" }, { workingDays: 22 });
    expect(sum.daysPresent).toBe(22);
    expect(sum.absences).toBe(0);
  });
});
