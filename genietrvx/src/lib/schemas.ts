import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

const str = (max = 500) => z.string().trim().max(max).default("");
const reqStr = (max = 200) => z.string().trim().min(1).max(max);
const num = (min = 0) => z.coerce.number().refine(Number.isFinite, "invalid").pipe(z.number().min(min)).default(0);
const signedNum = () => z.coerce.number().refine(Number.isFinite, "invalid").default(0);
const pct = () => z.coerce.number().min(0).max(100).default(0);
const isoDate = () =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "date")
    .default("");
const reqDate = () => z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "date");
const ref = () => z.string().trim().max(64).default("");
const wilaya = () => z.coerce.number().int().min(0).max(58).default(16);
const bool = () =>
  z.preprocess((v) => v === true || v === "true" || v === "on" || v === 1, z.boolean()).default(false);

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

export const ENUMS = {
  clientType: ["public", "private", "individual"],
  supplierCategory: ["materials", "equipment", "services", "transport", "other"],
  projectStatus: ["study", "ongoing", "suspended", "completed", "delivered"],
  marketKind: ["public", "private"],
  marketStatus: ["draft", "ongoing", "provisional", "final", "closed"],
  bondType: ["bid", "performance", "advance", "retention"],
  situationStatus: ["draft", "submitted", "approved", "paid"],
  odsType: ["start", "stop", "resume", "modification", "other"],
  quoteStatus: ["draft", "sent", "accepted", "rejected"],
  invoiceStatus: ["draft", "issued", "cancelled"],
  paymentMode: ["transfer", "check", "cash"],
  employeeCategory: ["worker", "technician", "supervisor", "engineer", "admin"],
  contractType: ["cdi", "cdd", "daily", "apprentice"],
  salaryType: ["monthly", "daily"],
  activeStatus: ["active", "inactive"],
  attendanceStatus: ["present", "half", "absent", "leave", "weather", "sick"],
  payslipStatus: ["draft", "validated", "paid"],
  materialCategory: ["cement", "steel", "aggregates", "bricks", "wood", "plumbing", "electrical", "paint", "tools", "other"],
  movementType: ["in", "out", "adjustment"],
  equipmentType: ["excavator", "loader", "truck", "crane", "mixer", "compactor", "generator", "scaffolding", "vehicle", "other"],
  ownership: ["owned", "rented"],
  equipmentStatus: ["available", "in_use", "broken", "maintenance"],
  expenseCategory: ["materials", "labor", "equipment", "fuel", "transport", "subcontracting", "overhead", "other"],
  weather: ["sunny", "cloudy", "rainy", "windy", "hot"],
  role: ["admin", "manager", "accountant", "site_manager", "viewer"],
  subcontractStatus: ["active", "completed", "cancelled"],
} as const;

export type EnumKey = keyof typeof ENUMS;
const e = <K extends EnumKey>(key: K, fallback?: (typeof ENUMS)[K][number]) =>
  z.enum(ENUMS[key] as unknown as [string, ...string[]]).default((fallback ?? ENUMS[key][0]) as string);

/* ------------------------------------------------------------------ */
/* Sub-documents                                                       */
/* ------------------------------------------------------------------ */

export const docLineSchema = z.object({
  designation: z.string().trim().max(500).default(""),
  unit: z.string().trim().max(20).default("u"),
  quantity: signedNum(),
  unitPrice: signedNum(),
});

export const dqeItemSchema = z.object({
  id: z.string().min(1).max(64),
  code: str(20),
  designation: str(500),
  unit: str(20),
  quantity: num(),
  unitPrice: num(),
});

const paymentSchema = z.object({
  date: reqDate(),
  amount: num(),
  mode: e("paymentMode"),
  reference: str(100),
});

/* ------------------------------------------------------------------ */
/* Collections                                                         */
/* ------------------------------------------------------------------ */

export const schemas = {
  clients: z.object({
    name: reqStr(),
    type: e("clientType", "public"),
    nif: str(30),
    nis: str(30),
    rc: str(30),
    ai: str(30),
    contact: str(100),
    phone: str(30),
    email: str(120),
    address: str(300),
    wilaya: wilaya(),
    notes: str(2000),
  }),
  suppliers: z.object({
    name: reqStr(),
    category: e("supplierCategory"),
    nif: str(30),
    rc: str(30),
    phone: str(30),
    email: str(120),
    address: str(300),
    wilaya: wilaya(),
    notes: str(2000),
  }),
  subcontractors: z.object({
    name: reqStr(),
    specialty: str(100),
    nif: str(30),
    rc: str(30),
    phone: str(30),
    email: str(120),
    address: str(300),
    wilaya: wilaya(),
    rating: z.coerce.number().int().min(0).max(5).default(3),
    notes: str(2000),
  }),
  subcontracts: z.object({
    subcontractorId: reqStr(64),
    projectId: reqStr(64),
    object: reqStr(300),
    amount: num(),
    startDate: isoDate(),
    endDate: isoDate(),
    status: e("subcontractStatus"),
    payments: z.array(paymentSchema).max(500).default([]),
    notes: str(2000),
  }),
  projects: z.object({
    code: str(30),
    name: reqStr(),
    clientId: ref(),
    wilaya: wilaya(),
    commune: str(100),
    address: str(300),
    startDate: isoDate(),
    endDate: isoDate(),
    budget: num(),
    status: e("projectStatus", "ongoing"),
    progress: pct(),
    manager: str(100),
    description: str(3000),
  }),
  tasks: z.object({
    projectId: reqStr(64),
    name: reqStr(),
    startDate: reqDate(),
    endDate: reqDate(),
    progress: pct(),
    responsible: str(100),
    dependsOn: ref(),
    order: z.coerce.number().int().default(0),
  }),
  markets: z.object({
    reference: str(60),
    object: reqStr(500),
    projectId: ref(),
    clientId: ref(),
    kind: e("marketKind", "public"),
    procedure: str(100),
    signDate: isoDate(),
    startDate: isoDate(),
    durationDays: z.coerce.number().int().min(0).default(0),
    suspendedDays: z.coerce.number().int().min(0).default(0),
    completionDate: isoDate(),
    tvaRate: pct().default(19),
    guaranteeRate: pct().default(5),
    advanceRate: pct().default(0),
    penaltyRatePerMille: z.coerce.number().min(0).max(100).default(1),
    penaltyCapPercent: pct().default(10),
    revisionCoefficient: z.coerce.number().min(0.5).max(3).default(1),
    status: e("marketStatus", "ongoing"),
    items: z.array(dqeItemSchema).max(2000).default([]),
    amendments: z
      .array(
        z.object({
          number: str(20),
          date: isoDate(),
          object: str(300),
          amount: signedNum(),
          extraDays: z.coerce.number().int().default(0),
        }),
      )
      .max(100)
      .default([]),
    bonds: z
      .array(
        z.object({
          type: e("bondType"),
          bank: str(100),
          amount: num(),
          issueDate: isoDate(),
          expiryDate: isoDate(),
        }),
      )
      .max(50)
      .default([]),
    notes: str(3000),
  }),
  situations: z.object({
    marketId: reqStr(64),
    number: z.coerce.number().int().min(1).default(1),
    date: reqDate(),
    periodFrom: isoDate(),
    periodTo: isoDate(),
    quantities: z.record(z.string(), z.coerce.number().min(0)).default({}),
    penalties: num(),
    status: e("situationStatus"),
    notes: str(2000),
  }),
  ods: z.object({
    marketId: reqStr(64),
    number: str(30),
    type: e("odsType"),
    date: reqDate(),
    subject: reqStr(300),
    description: str(3000),
  }),
  quotes: z.object({
    number: str(30),
    clientId: ref(),
    projectName: str(300),
    date: reqDate(),
    validUntil: isoDate(),
    lines: z.array(docLineSchema).max(1000).default([]),
    discountRate: pct(),
    tvaRate: pct().default(19),
    status: e("quoteStatus"),
    notes: str(3000),
  }),
  invoices: z.object({
    number: str(30),
    clientId: ref(),
    projectId: ref(),
    quoteId: ref(),
    date: reqDate(),
    dueDate: isoDate(),
    lines: z.array(docLineSchema).max(1000).default([]),
    discountRate: pct(),
    tvaRate: pct().default(19),
    stampEnabled: bool(),
    paymentMode: e("paymentMode"),
    status: e("invoiceStatus", "issued"),
    payments: z.array(paymentSchema).max(500).default([]),
    notes: str(3000),
  }),
  employees: z.object({
    matricule: str(30),
    firstName: reqStr(100),
    lastName: reqStr(100),
    nin: str(30),
    cnasNumber: str(30),
    birthDate: isoDate(),
    position: str(100),
    category: e("employeeCategory"),
    contractType: e("contractType"),
    salaryType: e("salaryType"),
    baseSalary: num(),
    dailyRate: num(),
    iepRate: pct(),
    bonus: num(),
    panier: num(),
    transport: num(),
    hireDate: isoDate(),
    projectId: ref(),
    phone: str(30),
    address: str(300),
    wilaya: wilaya(),
    status: e("activeStatus"),
  }),
  attendance: z.object({
    date: reqDate(),
    employeeId: reqStr(64),
    projectId: ref(),
    status: e("attendanceStatus"),
    overtimeHours: z.coerce.number().min(0).max(24).default(0),
    notes: str(300),
  }),
  payslips: z.object({
    employeeId: reqStr(64),
    period: z.string().regex(/^\d{4}-\d{2}$/),
    projectId: ref(),
    daysPresent: num(),
    halfDays: num(),
    absences: num(),
    overtimeHours: num(),
    weatherDays: num(),
    workedDays: num(),
    base: num(),
    iep: num(),
    bonus: num(),
    overtime: num(),
    gross: num(),
    cnasEmployee: num(),
    cacobatphWorker: num(),
    indemnities: num(),
    taxable: num(),
    irg: num(),
    net: num(),
    cnasEmployer: num(),
    cacobatphEmployer: num(),
    employerCost: num(),
    status: e("payslipStatus"),
  }),
  materials: z.object({
    code: str(30),
    name: reqStr(),
    category: e("materialCategory"),
    unit: str(20).default("u"),
    unitPrice: num(),
    initialStock: num(),
    minStock: num(),
    location: str(100),
    supplierId: ref(),
  }),
  stockMovements: z.object({
    date: reqDate(),
    materialId: reqStr(64),
    type: e("movementType"),
    quantity: signedNum(),
    unitPrice: num(),
    projectId: ref(),
    supplierId: ref(),
    reference: str(60),
    notes: str(500),
  }),
  equipment: z.object({
    code: str(30),
    name: reqStr(),
    type: e("equipmentType"),
    brand: str(60),
    model: str(60),
    plate: str(30),
    ownership: e("ownership"),
    status: e("equipmentStatus"),
    projectId: ref(),
    hourlyCost: num(),
    dailyRentalCost: num(),
    purchaseDate: isoDate(),
    purchaseValue: num(),
    hoursCounter: num(),
    lastMaintenance: isoDate(),
    nextMaintenance: isoDate(),
    insuranceExpiry: isoDate(),
    notes: str(2000),
  }),
  expenses: z.object({
    date: reqDate(),
    projectId: ref(),
    category: e("expenseCategory"),
    amount: num(),
    supplierId: ref(),
    paymentMode: e("paymentMode", "cash"),
    reference: str(60),
    description: reqStr(500),
  }),
  dailyReports: z.object({
    date: reqDate(),
    projectId: reqStr(64),
    weather: e("weather"),
    workforce: z.coerce.number().int().min(0).default(0),
    equipmentCount: z.coerce.number().int().min(0).default(0),
    worksDone: reqStr(5000),
    incidents: str(3000),
    observations: str(3000),
    author: str(100),
  }),
  users: z.object({
    name: reqStr(100),
    email: z.string().trim().toLowerCase().pipe(z.email()),
    role: e("role", "viewer"),
    active: z.preprocess((v) => v !== false && v !== "false", z.boolean()).default(true),
    password: z.string().min(6).max(100).optional(),
  }),
} as const;

export type CollectionName = keyof typeof schemas;
export const COLLECTIONS = Object.keys(schemas) as CollectionName[];

export function isCollection(name: string): name is CollectionName {
  return Object.prototype.hasOwnProperty.call(schemas, name);
}

export interface BaseRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export type Doc<C extends CollectionName> = z.output<(typeof schemas)[C]> & BaseRecord;

export type Client = Doc<"clients">;
export type Supplier = Doc<"suppliers">;
export type Subcontractor = Doc<"subcontractors">;
export type Subcontract = Doc<"subcontracts">;
export type Project = Doc<"projects">;
export type Task = Doc<"tasks">;
export type Market = Doc<"markets">;
export type Situation = Doc<"situations">;
export type Ods = Doc<"ods">;
export type Quote = Doc<"quotes">;
export type Invoice = Doc<"invoices">;
export type Employee = Doc<"employees">;
export type Attendance = Doc<"attendance">;
export type Payslip = Doc<"payslips">;
export type Material = Doc<"materials">;
export type StockMovement = Doc<"stockMovements">;
export type Equipment = Doc<"equipment">;
export type Expense = Doc<"expenses">;
export type DailyReport = Doc<"dailyReports">;
export type User = Omit<Doc<"users">, "password">;

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

export const settingsSchema = z.object({
  company: z
    .object({
      name: str(200).default("GenieTRVX SARL"),
      legalForm: str(50).default("SARL"),
      nif: str(30),
      nis: str(30),
      rc: str(30),
      ai: str(30),
      bank: str(100),
      rib: str(40),
      address: str(300),
      wilaya: wilaya(),
      phone: str(30),
      email: str(120),
      website: str(120),
      capital: num(),
    })
    .prefault({}),
  payroll: z
    .object({
      cnasEmployeeRate: pct().default(9),
      cnasEmployerRate: pct().default(26),
      cacobatphEmployerRate: pct().default(12.21),
      cacobatphWorkerRate: pct().default(0.75),
      workingDays: z.coerce.number().min(1).max(31).default(22),
      monthlyHours: z.coerce.number().min(1).max(300).default(173.33),
      overtimeRate: pct().default(50),
      snmg: num().default(24000),
    })
    .prefault({}),
  invoicing: z
    .object({
      tvaRate: pct().default(19),
      stampRate: pct().default(1),
      stampMax: num().default(2500),
      paymentTermsDays: z.coerce.number().int().min(0).max(365).default(30),
      quoteValidityDays: z.coerce.number().int().min(0).max(365).default(30),
      footer: str(500).default("Merci pour votre confiance."),
    })
    .prefault({}),
});

export type Settings = z.output<typeof settingsSchema>;
