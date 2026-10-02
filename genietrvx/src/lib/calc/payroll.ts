import { round2 } from "./money";

/** Taux de paie paramétrables (Paramètres → Paie). */
export interface PayrollRates {
  /** Cotisation CNAS part salariale (%) */
  cnasEmployeeRate: number;
  /** Cotisation CNAS part patronale (%) */
  cnasEmployerRate: number;
  /** CACOBATPH congés payés, part patronale (%) */
  cacobatphEmployerRate: number;
  /** CACOBATPH chômage-intempéries, part salariale (%) */
  cacobatphWorkerRate: number;
  /** Jours ouvrables par mois (valeur d'une journée d'absence) */
  workingDays: number;
  /** Heures mensuelles légales (taux horaire) */
  monthlyHours: number;
  /** Majoration des heures supplémentaires (%) */
  overtimeRate: number;
  /** Salaire national minimum garanti (DA) */
  snmg: number;
}

export const DEFAULT_PAYROLL_RATES: PayrollRates = {
  cnasEmployeeRate: 9,
  cnasEmployerRate: 26,
  cacobatphEmployerRate: 12.21,
  cacobatphWorkerRate: 0.75,
  workingDays: 22,
  monthlyHours: 173.33,
  overtimeRate: 50,
  snmg: 24000,
};

export interface PayrollEmployee {
  salaryType: "monthly" | "daily";
  baseSalary: number;
  dailyRate: number;
  /** Indemnité d'expérience professionnelle (% du salaire de base) */
  iepRate: number;
  /** Prime de rendement / autres primes cotisables (DA) */
  bonus: number;
  /** Indemnité de panier par jour travaillé (DA) — non cotisable, imposable */
  panier: number;
  /** Indemnité de transport par jour travaillé (DA) — non cotisable, imposable */
  transport: number;
}

export interface AttendanceSummary {
  daysPresent: number;
  halfDays: number;
  absences: number;
  overtimeHours: number;
  weatherDays: number;
}

export interface Payslip {
  workedDays: number;
  base: number;
  iep: number;
  bonus: number;
  overtime: number;
  /** Salaire de poste soumis à cotisation */
  gross: number;
  cnasEmployee: number;
  cacobatphWorker: number;
  indemnities: number;
  taxable: number;
  irg: number;
  net: number;
  cnasEmployer: number;
  cacobatphEmployer: number;
  employerCost: number;
}

const IRG_BRACKETS: Array<[number, number, number]> = [
  [20000, 40000, 0.23],
  [40000, 80000, 0.27],
  [80000, 160000, 0.3],
  [160000, 320000, 0.33],
  [320000, Infinity, 0.35],
];

/**
 * IRG mensuel sur salaires — barème de la LF 2022 :
 * exonération jusqu'à 30 000 DA, abattement de 40 % borné entre 1 000 et 1 500 DA,
 * lissage entre 30 000 et 35 000 DA.
 */
export function computeIrg(taxableIncome: number): number {
  const r = Math.floor(Math.max(0, taxableIncome) / 10) * 10;
  if (r <= 30000) return 0;

  let gross = 0;
  for (const [from, to, rate] of IRG_BRACKETS) {
    if (r > from) gross += (Math.min(r, to) - from) * rate;
  }
  const abatement = Math.min(1500, Math.max(1000, gross * 0.4));
  let irg = Math.max(0, gross - abatement);
  if (r < 35000) irg = irg * (137 / 51) - 27925 / 8;
  return round2(Math.max(0, irg));
}

export function computePayslip(
  employee: PayrollEmployee,
  attendance: AttendanceSummary,
  rates: PayrollRates = DEFAULT_PAYROLL_RATES,
): Payslip {
  const workedDays = attendance.daysPresent + attendance.halfDays / 2;

  let base: number;
  let hourlyRate: number;
  if (employee.salaryType === "daily") {
    base = employee.dailyRate * workedDays;
    hourlyRate = employee.dailyRate / 8;
  } else {
    const dayValue = employee.baseSalary / rates.workingDays;
    const deducted = attendance.absences + attendance.halfDays / 2;
    base = Math.max(0, employee.baseSalary - dayValue * deducted);
    hourlyRate = employee.baseSalary / rates.monthlyHours;
  }
  base = round2(base);

  const iep = round2((base * employee.iepRate) / 100);
  const bonus = round2(employee.bonus);
  const overtime = round2(hourlyRate * (1 + rates.overtimeRate / 100) * attendance.overtimeHours);
  const gross = round2(base + iep + bonus + overtime);

  const cnasEmployee = round2((gross * rates.cnasEmployeeRate) / 100);
  const cacobatphWorker = round2((gross * rates.cacobatphWorkerRate) / 100);
  const indemnities = round2((employee.panier + employee.transport) * workedDays);
  const taxable = round2(gross - cnasEmployee - cacobatphWorker + indemnities);
  const irg = computeIrg(taxable);
  const net = round2(taxable - irg);

  const cnasEmployer = round2((gross * rates.cnasEmployerRate) / 100);
  const cacobatphEmployer = round2((gross * rates.cacobatphEmployerRate) / 100);
  const employerCost = round2(gross + indemnities + cnasEmployer + cacobatphEmployer);

  return {
    workedDays,
    base,
    iep,
    bonus,
    overtime,
    gross,
    cnasEmployee,
    cacobatphWorker,
    indemnities,
    taxable,
    irg,
    net,
    cnasEmployer,
    cacobatphEmployer,
    employerCost,
  };
}
