import { describe, expect, it } from "vitest";
import { computeIrg, computePayslip, DEFAULT_PAYROLL_RATES } from "@/lib/calc/payroll";

describe("computeIrg (barème LF2022)", () => {
  it("exonère les revenus imposables ≤ 30 000 DA", () => {
    expect(computeIrg(0)).toBe(0);
    expect(computeIrg(20000)).toBe(0);
    expect(computeIrg(30000)).toBe(0);
  });

  it("applique le barème avec abattement de 40 % (borné 1 000 – 1 500 DA)", () => {
    // (35000-20000)*23% = 3450 ; abattement 1380 ; IRG = 2070
    expect(computeIrg(35000)).toBe(2070);
    // 20000*23% + 10000*27% = 7300 ; abattement plafonné 1500 ; IRG = 5800
    expect(computeIrg(50000)).toBe(5800);
    // 4600 + 10800 + 6000 = 21400 - 1500 = 19900
    expect(computeIrg(100000)).toBe(19900);
  });

  it("lisse l'IRG entre 30 000 et 35 000 DA", () => {
    const low = computeIrg(30010);
    const high = computeIrg(34990);
    expect(low).toBeGreaterThan(0);
    expect(low).toBeLessThan(50);
    expect(high).toBeGreaterThan(2000);
    expect(high).toBeLessThanOrEqual(2070);
  });

  it("arrondit l'assiette à la dizaine inférieure", () => {
    expect(computeIrg(35009)).toBe(computeIrg(35000));
  });
});

describe("computePayslip", () => {
  it("calcule un bulletin mensuel complet", () => {
    const slip = computePayslip(
      {
        salaryType: "monthly",
        baseSalary: 60000,
        dailyRate: 0,
        iepRate: 0,
        bonus: 0,
        panier: 0,
        transport: 0,
      },
      { daysPresent: 22, halfDays: 0, absences: 0, overtimeHours: 0, weatherDays: 0 },
      { ...DEFAULT_PAYROLL_RATES, cacobatphWorkerRate: 0 },
    );
    expect(slip.gross).toBe(60000);
    expect(slip.cnasEmployee).toBe(5400);
    expect(slip.taxable).toBe(54600);
    // 4600 + 14600*27% = 4600 + 3942 = 8542 - 1500 = 7042
    expect(slip.irg).toBe(7042);
    expect(slip.net).toBe(54600 - 7042);
    expect(slip.cnasEmployer).toBe(15600);
  });

  it("déduit les absences et ajoute les heures supplémentaires à 150 %", () => {
    const slip = computePayslip(
      { salaryType: "monthly", baseSalary: 44000, dailyRate: 0, iepRate: 0, bonus: 0, panier: 0, transport: 0 },
      { daysPresent: 20, halfDays: 0, absences: 2, overtimeHours: 10, weatherDays: 0 },
      DEFAULT_PAYROLL_RATES,
    );
    expect(slip.base).toBe(40000); // 44000 - 2 * 2000
    const hourly = 44000 / DEFAULT_PAYROLL_RATES.monthlyHours;
    expect(slip.overtime).toBeCloseTo(Math.round(hourly * 1.5 * 10 * 100) / 100, 2);
  });

  it("paie les journaliers au jour travaillé, panier et transport hors cotisation", () => {
    const slip = computePayslip(
      { salaryType: "daily", baseSalary: 0, dailyRate: 1500, iepRate: 0, bonus: 0, panier: 200, transport: 100 },
      { daysPresent: 20, halfDays: 2, absences: 0, overtimeHours: 0, weatherDays: 0 },
      { ...DEFAULT_PAYROLL_RATES, cacobatphWorkerRate: 0 },
    );
    expect(slip.base).toBe(31500); // 21 jours
    expect(slip.indemnities).toBe(300 * 21);
    expect(slip.cnasEmployee).toBe(2835); // 9% de 31500 seulement
    expect(slip.taxable).toBe(31500 - 2835 + 6300);
  });
});
