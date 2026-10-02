import bcrypt from "bcryptjs";
import type { Store } from "./db";
import { generatePayslips } from "./payroll-service";
import { addDays, todayIso } from "@/lib/calc/money";
import { settingsSchema } from "@/lib/schemas";

export const DEMO_PASSWORD = "Demo@2026";

/** Générateur pseudo-aléatoire déterministe (données de démonstration reproductibles). */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Identifiants au format UUID, identiques à chaque amorçage (instances multiples cohérentes). */
function deterministicIds(seed: number) {
  const next = rng(seed);
  const hex = (n: number) =>
    Array.from({ length: n }, () => Math.floor(next() * 16).toString(16)).join("");
  return () => `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`;
}

export function seedDatabase(store: Store, { demo }: { demo: boolean }) {
  if (store.count("users") > 0) return;

  const previousFactory = store.idFactory;
  store.idFactory = deterministicIds(46_2026);
  try {
    seedAll(store, demo);
  } finally {
    store.idFactory = previousFactory;
  }
}

function seedAll(store: Store, demo: boolean) {
  store.transaction(() => {
    const adminEmail = (process.env.ADMIN_EMAIL || "admin@genietrvx.dz").toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD || DEMO_PASSWORD;
    store.insert("users", {
      name: "Administrateur",
      email: adminEmail,
      role: "admin",
      active: true,
      passwordHash: bcrypt.hashSync(adminPassword, 10),
    });

    if (!demo) {
      store.upsert("settings", "main", settingsSchema.parse({}) as unknown as Record<string, unknown>);
      return;
    }
    seedDemo(store);
  });
}

function seedDemo(store: Store) {
  const rand = rng(2026);
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];
  const today = todayIso();
  const hash = bcrypt.hashSync(DEMO_PASSWORD, 10);

  for (const [name, email, role] of [
    ["Karim Benaïssa", "chef@genietrvx.dz", "site_manager"],
    ["Nadia Bouzid", "compta@genietrvx.dz", "accountant"],
    ["Yacine Merabet", "direction@genietrvx.dz", "manager"],
  ] as const) {
    store.insert("users", { name, email, role, active: true, passwordHash: hash });
  }

  store.upsert(
    "settings",
    "main",
    settingsSchema.parse({
      company: {
        name: "GenieTRVX SARL",
        legalForm: "SARL",
        nif: "001946020345187",
        nis: "001946010234567",
        rc: "46/00-0123456B19",
        ai: "46017234561",
        bank: "BNA - Agence Aïn Témouchent",
        rib: "001 00456 0300123456 78",
        address: "Zone d'activités, Lot n° 12",
        wilaya: 46,
        phone: "+213 43 60 12 34",
        email: "contact@genietrvx.dz",
        website: "www.genietrvx.dz",
        capital: 10000000,
      },
    }) as unknown as Record<string, unknown>,
  );

  /* Partenaires ------------------------------------------------------ */
  const clients = [
    { name: "OPGI d'Aïn Témouchent", type: "public", wilaya: 46, contact: "Service des marchés", phone: "043 60 22 10" },
    { name: "DEP de la wilaya d'Oran", type: "public", wilaya: 31, contact: "M. Hadj Ahmed", phone: "041 33 45 67" },
    { name: "APC de Hammam Bouhadjar", type: "public", wilaya: 46, contact: "Secrétaire général", phone: "043 55 12 01" },
    { name: "SARL Immobilière El Bahia", type: "private", wilaya: 31, contact: "Mme Fatima Zohra Kaci", phone: "0550 12 34 56" },
    { name: "M. Benali Mohamed", type: "individual", wilaya: 46, contact: "", phone: "0661 98 76 54" },
  ].map((c, i) =>
    store.insert("clients", {
      ...c,
      nif: c.type === "individual" ? "" : `0004600${i}12345678`,
      nis: "",
      rc: "",
      ai: "",
      email: "",
      address: "",
      notes: "",
    }),
  );

  const suppliers = [
    ["Cimenterie de l'Ouest", "materials", 13],
    ["Sidérurgie Méditerranée", "materials", 31],
    ["Briqueterie de Tlemcen", "materials", 13],
    ["Sablière Hammam Bouhadjar", "materials", 46],
    ["Location Engins Oranie", "equipment", 31],
    ["Station Naftal El Malah", "services", 46],
    ["Transport Benyahia & Fils", "transport", 46],
  ].map(([name, category, wilaya], i) =>
    store.insert("suppliers", {
      name,
      category,
      wilaya,
      nif: `0013${i}0987654321`,
      rc: "",
      phone: `0770 ${10 + i} 20 30`,
      email: "",
      address: "",
      notes: "",
    }),
  );

  const subcontractors = [
    ["Étanchéité Pro Ouest", "Étanchéité", 31, 4],
    ["Électricité Générale Benamar", "Électricité", 46, 5],
    ["Plomberie Sanitaire Hadjadj", "Plomberie", 46, 3],
  ].map(([name, specialty, wilaya, rating]) =>
    store.insert("subcontractors", {
      name,
      specialty,
      wilaya,
      rating,
      nif: "",
      rc: "",
      phone: "0555 00 11 22",
      email: "",
      address: "",
      notes: "",
    }),
  );

  /* Chantiers -------------------------------------------------------- */
  const projectsData = [
    {
      code: "CH-2026-001",
      name: "Réalisation de 50 logements publics locatifs (LPL)",
      clientId: clients[0].id,
      wilaya: 46,
      commune: "Aïn Témouchent",
      startDate: addDays(today, -200),
      endDate: addDays(today, 240),
      budget: 185_000_000,
      status: "ongoing",
      progress: 46,
      manager: "Karim Benaïssa",
    },
    {
      code: "CH-2026-002",
      name: "Construction d'un CEM type base 7",
      clientId: clients[1].id,
      wilaya: 31,
      commune: "Es Senia",
      startDate: addDays(today, -300),
      endDate: addDays(today, 45),
      budget: 96_000_000,
      status: "ongoing",
      progress: 78,
      manager: "Samir Ould Ali",
    },
    {
      code: "CH-2026-003",
      name: "Villa R+2 — Benali",
      clientId: clients[4].id,
      wilaya: 46,
      commune: "Beni Saf",
      startDate: addDays(today, -60),
      endDate: addDays(today, 300),
      budget: 24_000_000,
      status: "ongoing",
      progress: 18,
      manager: "Karim Benaïssa",
    },
    {
      code: "CH-2025-014",
      name: "Réhabilitation du siège de l'APC",
      clientId: clients[2].id,
      wilaya: 46,
      commune: "Hammam Bouhadjar",
      startDate: addDays(today, -420),
      endDate: addDays(today, -40),
      budget: 18_500_000,
      status: "delivered",
      progress: 100,
      manager: "Samir Ould Ali",
    },
    {
      code: "CH-2026-004",
      name: "Hangar de stockage métallique 1 200 m²",
      clientId: clients[3].id,
      wilaya: 31,
      commune: "Hassi Ameur",
      startDate: addDays(today, 30),
      endDate: addDays(today, 210),
      budget: 46_000_000,
      status: "study",
      progress: 0,
      manager: "Yacine Merabet",
    },
  ];
  const projects = projectsData.map((p) =>
    store.insert("projects", { ...p, address: "", description: "" }),
  );

  /* Planning (Gantt) ------------------------------------------------- */
  const phases = [
    ["Installation de chantier", 0, 15, 100],
    ["Terrassements généraux", 10, 30, 100],
    ["Fondations (semelles, longrines)", 35, 45, 100],
    ["Gros œuvre — structure béton armé", 70, 160, 60],
    ["Maçonnerie et cloisons", 150, 110, 25],
    ["Étanchéité", 230, 30, 0],
    ["Corps d'état secondaires (CES)", 250, 120, 0],
    ["VRD et aménagements extérieurs", 340, 60, 0],
    ["Réception provisoire", 410, 5, 0],
  ] as const;
  projects.slice(0, 3).forEach((p, pi) => {
    const scale = pi === 2 ? 0.8 : pi === 1 ? 0.85 : 1;
    let prev = "";
    phases.forEach(([name, offset, duration], i) => {
      const start = addDays(p.startDate as string, Math.round(offset * scale));
      const end = addDays(start, Math.max(1, Math.round(duration * scale)));
      const progress = end < today ? 100 : start > today ? 0 : Math.min(95, Math.round((100 * (Date.parse(today) - Date.parse(start))) / (Date.parse(end) - Date.parse(start))));
      const task = store.insert("tasks", {
        projectId: p.id,
        name,
        startDate: start,
        endDate: end,
        progress,
        responsible: i < 4 ? "Chef de chantier" : "Sous-traitant",
        dependsOn: prev,
        order: i,
      });
      prev = task.id;
    });
  });

  /* Marchés ---------------------------------------------------------- */
  const dqe1 = [
    ["1.1", "Décapage de la terre végétale", "m2", 2400, 120],
    ["1.2", "Fouilles en pleine masse", "m3", 3600, 650],
    ["1.3", "Remblais compactés", "m3", 1500, 480],
    ["2.1", "Béton de propreté dosé à 150 kg/m3", "m3", 180, 9500],
    ["2.2", "Béton armé en fondations dosé à 350 kg/m3", "m3", 950, 24000],
    ["2.3", "Béton armé en élévation dosé à 350 kg/m3", "m3", 1850, 28500],
    ["3.1", "Maçonnerie en double cloison de briques creuses", "m2", 9800, 2400],
    ["3.2", "Enduit au mortier de ciment", "m2", 21000, 650],
    ["4.1", "Étanchéité multicouche", "m2", 2600, 2200],
    ["5.1", "Carrelage granito", "m2", 4800, 1900],
    ["5.2", "Peinture vinylique", "m2", 26000, 380],
    ["6.1", "Menuiserie bois (portes intérieures)", "u", 250, 28000],
    ["6.2", "Menuiserie aluminium (fenêtres)", "u", 300, 34000],
  ] as const;
  const dqe2 = [
    ["1.1", "Terrassements généraux", "m3", 2100, 700],
    ["2.1", "Béton armé en fondations", "m3", 520, 24500],
    ["2.2", "Béton armé en élévation", "m3", 980, 29000],
    ["3.1", "Maçonnerie de briques", "m2", 5200, 2500],
    ["4.1", "Étanchéité et isolation des terrasses", "m2", 1900, 2400],
    ["5.1", "Revêtements de sols", "m2", 3600, 2100],
    ["6.1", "Lot électricité (forfait)", "ens", 1, 6_500_000],
    ["6.2", "Lot plomberie sanitaire (forfait)", "ens", 1, 4_200_000],
  ] as const;
  const toItems = (rows: ReadonlyArray<readonly [string, string, string, number, number]>, prefix: string) =>
    rows.map(([code, designation, unit, quantity, unitPrice], i) => ({
      id: `${prefix}-${i + 1}`,
      code,
      designation,
      unit,
      quantity,
      unitPrice,
    }));

  const market1 = store.insert("markets", {
    reference: "MP-046/2025/OPGI",
    object: "Réalisation de 50 logements publics locatifs à Aïn Témouchent",
    projectId: projects[0].id,
    clientId: clients[0].id,
    kind: "public",
    procedure: "Appel d'offres ouvert avec exigence de capacités minimales",
    signDate: addDays(today, -215),
    startDate: addDays(today, -200),
    durationDays: 450,
    suspendedDays: 15,
    completionDate: "",
    tvaRate: 19,
    guaranteeRate: 5,
    advanceRate: 15,
    penaltyRatePerMille: 1,
    penaltyCapPercent: 10,
    revisionCoefficient: 1,
    status: "ongoing",
    items: toItems(dqe1, "m1"),
    amendments: [{ number: "01", date: addDays(today, -40), object: "Travaux complémentaires de VRD", amount: 3_200_000, extraDays: 30 }],
    bonds: [
      { type: "performance", bank: "BNA", amount: 7_500_000, issueDate: addDays(today, -215), expiryDate: addDays(today, 400) },
      { type: "advance", bank: "BNA", amount: 22_000_000, issueDate: addDays(today, -210), expiryDate: addDays(today, 20) },
    ],
    notes: "",
  });
  const market2 = store.insert("markets", {
    reference: "MP-031/2025/DEP",
    object: "Construction d'un CEM type base 7 à Es Senia",
    projectId: projects[1].id,
    clientId: clients[1].id,
    kind: "public",
    procedure: "Appel d'offres national restreint",
    signDate: addDays(today, -310),
    startDate: addDays(today, -300),
    durationDays: 330,
    suspendedDays: 0,
    completionDate: "",
    tvaRate: 19,
    guaranteeRate: 5,
    advanceRate: 10,
    penaltyRatePerMille: 1,
    penaltyCapPercent: 10,
    revisionCoefficient: 1.032,
    status: "ongoing",
    items: toItems(dqe2, "m2"),
    amendments: [],
    bonds: [{ type: "performance", bank: "CPA", amount: 4_800_000, issueDate: addDays(today, -310), expiryDate: addDays(today, 120) }],
    notes: "",
  });

  const qty = (items: Array<{ id: string; quantity: number }>, ratio: number) =>
    Object.fromEntries(items.map((it, i) => [it.id, Math.round(it.quantity * Math.max(0, Math.min(1, ratio * (1.4 - i * 0.12))))]));
  const m1Items = market1.items as Array<{ id: string; quantity: number }>;
  const m2Items = market2.items as Array<{ id: string; quantity: number }>;
  [
    [market1, m1Items, 1, 0.18, "paid", -120],
    [market1, m1Items, 2, 0.32, "paid", -60],
    [market1, m1Items, 3, 0.45, "submitted", -5],
    [market2, m2Items, 1, 0.35, "paid", -180],
    [market2, m2Items, 2, 0.62, "approved", -70],
    [market2, m2Items, 3, 0.8, "draft", -3],
  ].forEach(([m, items, number, ratio, status, offset]) => {
    const market = m as { id: string };
    store.insert("situations", {
      marketId: market.id,
      number,
      date: addDays(today, offset as number),
      periodFrom: addDays(today, (offset as number) - 30),
      periodTo: addDays(today, offset as number),
      quantities: qty(items as Array<{ id: string; quantity: number }>, ratio as number),
      penalties: 0,
      status,
      notes: "",
    });
  });

  [
    [market1, "01/2025", "start", -200, "Ordre de service de démarrage des travaux"],
    [market1, "02/2025", "stop", -150, "Arrêt des travaux — intempéries"],
    [market1, "03/2025", "resume", -135, "Reprise des travaux"],
    [market2, "01/2025", "start", -300, "Ordre de service de démarrage des travaux"],
  ].forEach(([m, number, type, offset, subject]) =>
    store.insert("ods", {
      marketId: (m as { id: string }).id,
      number,
      type,
      date: addDays(today, offset as number),
      subject,
      description: "",
    }),
  );

  /* Devis et factures -------------------------------------------------- */
  const year = today.slice(0, 4);
  store.insert("quotes", {
    number: `DEV-${year}-0001`,
    clientId: clients[3].id,
    projectName: "Hangar de stockage métallique 1 200 m²",
    date: addDays(today, -25),
    validUntil: addDays(today, 5),
    lines: [
      { designation: "Terrassements et plateforme", unit: "m3", quantity: 1800, unitPrice: 650 },
      { designation: "Fondations en béton armé", unit: "m3", quantity: 210, unitPrice: 25000 },
      { designation: "Charpente métallique (fourniture et pose)", unit: "kg", quantity: 54000, unitPrice: 420 },
      { designation: "Couverture en panneaux sandwich", unit: "m2", quantity: 1250, unitPrice: 4800 },
      { designation: "Dallage industriel", unit: "m2", quantity: 1200, unitPrice: 5200 },
    ],
    discountRate: 3,
    tvaRate: 19,
    status: "accepted",
    notes: "Délai d'exécution : 6 mois.",
  });
  store.insert("quotes", {
    number: `DEV-${year}-0002`,
    clientId: clients[4].id,
    projectName: "Extension villa — clôture et portail",
    date: addDays(today, -8),
    validUntil: addDays(today, 22),
    lines: [
      { designation: "Mur de clôture en parpaings", unit: "ml", quantity: 120, unitPrice: 9500 },
      { designation: "Portail coulissant en fer forgé", unit: "u", quantity: 1, unitPrice: 380000 },
    ],
    discountRate: 0,
    tvaRate: 19,
    status: "sent",
    notes: "",
  });

  const invoiceRows = [
    [clients[3].id, projects[4].id, -90, 3_850_000, "transfer", [[-60, 2_000_000], [-30, 1_000_000]]],
    [clients[4].id, projects[2].id, -45, 4_200_000, "check", [[-20, 4_998_000]]],
    [clients[4].id, projects[2].id, -10, 2_600_000, "cash", []],
    [clients[3].id, projects[4].id, -150, 1_250_000, "transfer", [[-120, 1_487_500]]],
  ] as const;
  invoiceRows.forEach(([clientId, projectId, offset, amount, mode, payments], i) =>
    store.insert("invoices", {
      number: `FAC-${year}-${String(i + 1).padStart(4, "0")}`,
      clientId,
      projectId,
      quoteId: "",
      date: addDays(today, offset),
      dueDate: addDays(today, offset + 30),
      lines: [{ designation: `Travaux réalisés — acompte n° ${i + 1}`, unit: "ens", quantity: 1, unitPrice: amount }],
      discountRate: 0,
      tvaRate: 19,
      stampEnabled: mode === "cash",
      paymentMode: mode,
      status: "issued",
      payments: payments.map(([o, a]) => ({ date: addDays(today, o), amount: a, mode, reference: "" })),
      notes: "",
    }),
  );

  /* Personnel ---------------------------------------------------------- */
  const staff = [
    ["Benaïssa", "Karim", "Chef de chantier", "supervisor", "cdi", "monthly", 95000, 0],
    ["Ould Ali", "Samir", "Ingénieur génie civil", "engineer", "cdi", "monthly", 130000, 0],
    ["Hamdi", "Rachid", "Conducteur de travaux", "supervisor", "cdi", "monthly", 85000, 0],
    ["Bouzid", "Nadia", "Comptable", "admin", "cdi", "monthly", 70000, 0],
    ["Khelifi", "Mourad", "Maçon qualifié", "worker", "cdd", "daily", 0, 2500],
    ["Saadi", "Abdelkader", "Maçon", "worker", "cdd", "daily", 0, 2200],
    ["Mebarki", "Ali", "Ferrailleur", "worker", "cdd", "daily", 0, 2300],
    ["Djilali", "Hocine", "Coffreur", "worker", "cdd", "daily", 0, 2300],
    ["Touati", "Bilal", "Conducteur d'engins", "technician", "cdi", "monthly", 62000, 0],
    ["Rahmani", "Sofiane", "Manœuvre", "worker", "daily", "daily", 0, 1600],
    ["Amrani", "Youcef", "Manœuvre", "worker", "daily", "daily", 0, 1600],
    ["Zerrouki", "Omar", "Électricien", "technician", "cdd", "monthly", 55000, 0],
    ["Belkacem", "Farid", "Plombier", "technician", "cdd", "daily", 0, 2400],
    ["Ferhat", "Lyes", "Topographe", "technician", "cdi", "monthly", 68000, 0],
    ["Hadjeres", "Amine", "Magasinier", "admin", "cdi", "monthly", 45000, 0],
  ] as const;
  const employees = staff.map(([lastName, firstName, position, category, contractType, salaryType, baseSalary, dailyRate], i) =>
    store.insert("employees", {
      matricule: `EMP-${String(i + 1).padStart(3, "0")}`,
      firstName,
      lastName,
      nin: `1${String(9850000 + i * 7919).padStart(17, "0")}`,
      cnasNumber: `46${String(8500000 + i * 131).padStart(10, "0")}`,
      birthDate: addDays("1990-01-01", -i * 400),
      position,
      category,
      contractType,
      salaryType,
      baseSalary,
      dailyRate,
      iepRate: i % 3 === 0 ? 10 : 5,
      bonus: category === "worker" ? 0 : 3000,
      panier: 200,
      transport: 150,
      hireDate: addDays(today, -400 - i * 30),
      projectId: projects[i % 3].id,
      phone: `0661 ${String(100000 + i * 3571).slice(0, 6)}`,
      address: "",
      wilaya: 46,
      status: "active",
    }),
  );

  /* Pointage (dimanche → jeudi) sur les ~45 derniers jours --------------- */
  for (let d = -45; d <= 0; d++) {
    const date = addDays(today, d);
    const dow = new Date(`${date}T00:00:00Z`).getUTCDay(); // 5 = vendredi, 6 = samedi
    if (dow === 5 || dow === 6) continue;
    for (const emp of employees) {
      const r = rand();
      const status = r < 0.86 ? "present" : r < 0.9 ? "half" : r < 0.95 ? "absent" : r < 0.97 ? "weather" : "leave";
      store.insert("attendance", {
        date,
        employeeId: emp.id,
        projectId: emp.projectId,
        status,
        overtimeHours: status === "present" && rand() < 0.15 ? 2 : 0,
        notes: "",
      });
    }
  }
  const prevMonth = addDays(`${today.slice(0, 7)}-01`, -1).slice(0, 7);
  const rates = settingsSchema.parse({}).payroll;
  generatePayslips(store, prevMonth, rates);
  for (const p of store.list<{ id: string; period: string }>("payslips")) {
    const doc = store.get<Record<string, unknown>>("payslips", p.id);
    if (doc) store.update("payslips", p.id, { ...doc, status: "paid" });
  }

  /* Matériaux et stock ------------------------------------------------- */
  const materials = [
    ["MAT-001", "Ciment CPJ 42.5 (sac 50 kg)", "cement", "sac", 1250, 800, 300],
    ["MAT-002", "Rond à béton HA10", "steel", "kg", 165, 6000, 2000],
    ["MAT-003", "Rond à béton HA12", "steel", "kg", 162, 8000, 2500],
    ["MAT-004", "Rond à béton HA16", "steel", "kg", 160, 5000, 2000],
    ["MAT-005", "Sable 0/4", "aggregates", "m3", 3000, 120, 40],
    ["MAT-006", "Gravier 8/15", "aggregates", "m3", 3600, 90, 30],
    ["MAT-007", "Gravier 15/25", "aggregates", "m3", 3400, 70, 30],
    ["MAT-008", "Brique creuse 8 trous", "bricks", "u", 42, 25000, 8000],
    ["MAT-009", "Brique creuse 12 trous", "bricks", "u", 58, 12000, 5000],
    ["MAT-010", "Hourdis 16", "bricks", "u", 95, 3000, 1000],
    ["MAT-011", "Bois de coffrage (madrier)", "wood", "m3", 68000, 12, 4],
    ["MAT-012", "Fil de fer recuit", "steel", "kg", 260, 400, 100],
    ["MAT-013", "Peinture vinylique (fût 25 kg)", "paint", "u", 5200, 40, 15],
  ].map(([code, name, category, unit, unitPrice, initialStock, minStock], i) =>
    store.insert("materials", {
      code,
      name,
      category,
      unit,
      unitPrice,
      initialStock,
      minStock,
      location: "Dépôt central",
      supplierId: suppliers[Math.min(3, i % 4)].id,
    }),
  );
  materials.forEach((m, i) => {
    const initial = Number(m.initialStock);
    store.insert("stockMovements", {
      date: addDays(today, -30 + i),
      materialId: m.id,
      type: "in",
      quantity: Math.round(initial * 0.5),
      unitPrice: m.unitPrice,
      projectId: "",
      supplierId: m.supplierId,
      reference: `BL-${1200 + i}`,
      notes: "",
    });
    const outFactor = i === 0 || i === 4 ? 1.3 : 0.6;
    store.insert("stockMovements", {
      date: addDays(today, -10 + (i % 7)),
      materialId: m.id,
      type: "out",
      quantity: Math.round(initial * outFactor),
      unitPrice: m.unitPrice,
      projectId: projects[i % 3].id,
      supplierId: "",
      reference: `BS-${300 + i}`,
      notes: "",
    });
  });

  /* Engins ------------------------------------------------------------- */
  [
    ["ENG-01", "Pelle hydraulique 22 t", "excavator", "Caterpillar", "320", "owned", "in_use", 0, 9500],
    ["ENG-02", "Chargeuse sur pneus", "loader", "Komatsu", "WA320", "owned", "available", -1, 7800],
    ["ENG-03", "Camion benne 6x4", "truck", "Renault", "Kerax", "owned", "in_use", 1, 5200],
    ["ENG-04", "Grue à tour 40 m", "crane", "Potain", "MDT 219", "rented", "in_use", 0, 0],
    ["ENG-05", "Bétonnière 350 L", "mixer", "Altrad", "B350", "owned", "in_use", 2, 600],
    ["ENG-06", "Compacteur vibrant", "compactor", "Bomag", "BW 120", "owned", "maintenance", -1, 3500],
    ["ENG-07", "Groupe électrogène 60 kVA", "generator", "SDMO", "J66K", "owned", "broken", -1, 1200],
    ["ENG-08", "Véhicule de liaison", "vehicle", "Toyota", "Hilux", "owned", "in_use", 1, 1500],
  ].forEach(([code, name, type, brand, model, ownership, status, p, hourlyCost], i) =>
    store.insert("equipment", {
      code,
      name,
      type,
      brand,
      model,
      plate: type === "truck" || type === "vehicle" ? `0${1234 + i}-120-46` : "",
      ownership,
      status,
      projectId: (p as number) >= 0 ? projects[p as number].id : "",
      hourlyCost,
      dailyRentalCost: ownership === "rented" ? 45000 : 0,
      purchaseDate: ownership === "owned" ? addDays(today, -1500 + i * 90) : "",
      purchaseValue: ownership === "owned" ? 2_000_000 + i * 1_500_000 : 0,
      hoursCounter: 1200 + i * 830,
      lastMaintenance: addDays(today, -60 - i * 5),
      nextMaintenance: addDays(today, i % 3 === 0 ? -3 : 25 + i * 4),
      insuranceExpiry: addDays(today, 90 + i * 20),
      notes: "",
    }),
  );

  /* Dépenses (6 derniers mois) ----------------------------------------- */
  const categories = ["materials", "labor", "equipment", "fuel", "transport", "subcontracting", "overhead"] as const;
  const labels: Record<(typeof categories)[number], string> = {
    materials: "Achat de matériaux",
    labor: "Main d'œuvre occasionnelle",
    equipment: "Location d'engins",
    fuel: "Carburant engins",
    transport: "Transport de matériaux",
    subcontracting: "Situation sous-traitant",
    overhead: "Frais généraux",
  };
  const base: Record<(typeof categories)[number], number> = {
    materials: 1_800_000,
    labor: 350_000,
    equipment: 420_000,
    fuel: 120_000,
    transport: 90_000,
    subcontracting: 900_000,
    overhead: 60_000,
  };
  for (let i = 0; i < 60; i++) {
    const category = pick(categories);
    store.insert("expenses", {
      date: addDays(today, -Math.floor(rand() * 180)),
      projectId: projects[Math.floor(rand() * 3)].id,
      category,
      amount: Math.round(base[category] * (0.4 + rand())),
      supplierId: category === "materials" ? pick(suppliers.slice(0, 4)).id : "",
      paymentMode: pick(["cash", "check", "transfer"] as const),
      reference: `REF-${5000 + i}`,
      description: labels[category],
    });
  }

  /* Sous-traitance ------------------------------------------------------ */
  store.insert("subcontracts", {
    subcontractorId: subcontractors[0].id,
    projectId: projects[0].id,
    object: "Étanchéité des terrasses — 5 blocs",
    amount: 5_400_000,
    startDate: addDays(today, 20),
    endDate: addDays(today, 60),
    status: "active",
    payments: [],
    notes: "",
  });
  store.insert("subcontracts", {
    subcontractorId: subcontractors[1].id,
    projectId: projects[1].id,
    object: "Lot électricité courants forts et faibles",
    amount: 6_100_000,
    startDate: addDays(today, -90),
    endDate: addDays(today, 30),
    status: "active",
    payments: [{ date: addDays(today, -30), amount: 2_500_000, mode: "transfer", reference: "VIR-8891" }],
    notes: "",
  });

  /* Rapports journaliers -------------------------------------------------- */
  const works = [
    "Coulage du plancher haut RDC bloc B (42 m3). Ferraillage des poteaux du 1er étage.",
    "Coffrage des poutres du 1er étage. Réception des aciers HA12 (8 t).",
    "Maçonnerie des cloisons RDC bloc A. Décoffrage du plancher bloc B.",
  ];
  for (let d = 0; d < 6; d++) {
    store.insert("dailyReports", {
      date: addDays(today, -d - 1),
      projectId: projects[d % 2].id,
      weather: pick(["sunny", "cloudy", "windy", "hot"] as const),
      workforce: 18 + Math.floor(rand() * 10),
      equipmentCount: 3 + (d % 3),
      worksDone: works[d % works.length],
      incidents: d === 2 ? "Panne du groupe électrogène — retard de 2 heures." : "",
      observations: "",
      author: "Karim Benaïssa",
    });
  }
}
