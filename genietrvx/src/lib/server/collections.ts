import bcrypt from "bcryptjs";
import type { Store, StoredDoc } from "./db";
import { ApiError } from "./api";
import type { SessionUser } from "./auth";
import { schemas, type CollectionName } from "@/lib/schemas";
import { currentStock } from "@/lib/calc/stock";
import { todayIso } from "@/lib/calc/money";

type Data = Record<string, unknown>;

/* ------------------------------------------------------------------ */
/* Numérotation automatique                                            */
/* ------------------------------------------------------------------ */

function nextSequence(values: unknown[], pattern: RegExp): number {
  let max = 0;
  for (const v of values) {
    const m = typeof v === "string" ? v.match(pattern) : null;
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

function autoNumber(store: Store, collection: CollectionName, data: Data) {
  const year = String(data.date ?? data.startDate ?? todayIso()).slice(0, 4) || todayIso().slice(0, 4);
  const docs = store.list<StoredDoc>(collection);
  const field = (k: string) => docs.map((d) => d[k]);
  switch (collection) {
    case "quotes":
      if (!data.number) data.number = `DEV-${year}-${String(nextSequence(field("number"), new RegExp(`^DEV-${year}-(\\d+)$`))).padStart(4, "0")}`;
      break;
    case "invoices":
      if (!data.number) data.number = `FAC-${year}-${String(nextSequence(field("number"), new RegExp(`^FAC-${year}-(\\d+)$`))).padStart(4, "0")}`;
      break;
    case "projects":
      if (!data.code) data.code = `CH-${year}-${String(nextSequence(field("code"), new RegExp(`^CH-${year}-(\\d+)$`))).padStart(3, "0")}`;
      break;
    case "employees":
      if (!data.matricule) data.matricule = `EMP-${String(nextSequence(field("matricule"), /^EMP-(\d+)$/)).padStart(3, "0")}`;
      break;
    case "materials":
      if (!data.code) data.code = `MAT-${String(nextSequence(field("code"), /^MAT-(\d+)$/)).padStart(3, "0")}`;
      break;
    case "equipment":
      if (!data.code) data.code = `ENG-${String(nextSequence(field("code"), /^ENG-(\d+)$/)).padStart(2, "0")}`;
      break;
    case "ods":
      if (!data.number) {
        const same = docs.filter((d) => d.marketId === data.marketId).map((d) => d.number);
        data.number = `${String(nextSequence(same, /^(\d+)\//)).padStart(2, "0")}/${year}`;
      }
      break;
    case "situations": {
      if (!data.number || Number(data.number) < 1) {
        const nums = docs.filter((d) => d.marketId === data.marketId).map((d) => Number(d.number) || 0);
        data.number = (nums.length ? Math.max(...nums) : 0) + 1;
      }
      break;
    }
    case "stockMovements":
      if (!Number(data.unitPrice) && typeof data.materialId === "string") {
        const material = store.get<StoredDoc>("materials", data.materialId);
        if (material) data.unitPrice = material.unitPrice;
      }
      break;
    default:
      break;
  }
}

/* ------------------------------------------------------------------ */
/* Validation métier                                                   */
/* ------------------------------------------------------------------ */

function requireRef(store: Store, collection: CollectionName, id: unknown, field: string) {
  if (typeof id === "string" && id && !store.get(collection, id)) {
    throw new ApiError(400, "validation", [{ path: field, message: "not_found" }]);
  }
}

const REFS: Partial<Record<CollectionName, Array<[string, CollectionName]>>> = {
  projects: [["clientId", "clients"]],
  tasks: [["projectId", "projects"]],
  markets: [["projectId", "projects"], ["clientId", "clients"]],
  situations: [["marketId", "markets"]],
  ods: [["marketId", "markets"]],
  quotes: [["clientId", "clients"]],
  invoices: [["clientId", "clients"], ["projectId", "projects"]],
  employees: [["projectId", "projects"]],
  attendance: [["employeeId", "employees"], ["projectId", "projects"]],
  payslips: [["employeeId", "employees"]],
  materials: [["supplierId", "suppliers"]],
  stockMovements: [["materialId", "materials"], ["projectId", "projects"], ["supplierId", "suppliers"]],
  equipment: [["projectId", "projects"]],
  expenses: [["projectId", "projects"], ["supplierId", "suppliers"]],
  dailyReports: [["projectId", "projects"]],
  subcontracts: [["subcontractorId", "subcontractors"], ["projectId", "projects"]],
};

function validateBusiness(store: Store, collection: CollectionName, data: Data, existingId?: string) {
  for (const [field, target] of REFS[collection] ?? []) requireRef(store, target, data[field], field);

  const dateOrder = (a: string, b: string) => {
    if (data[a] && data[b] && String(data[b]) < String(data[a])) {
      throw new ApiError(400, "validation", [{ path: b, message: "date_before_start" }]);
    }
  };
  if (collection === "tasks" || collection === "projects" || collection === "subcontracts") dateOrder("startDate", "endDate");

  if (collection === "stockMovements" && data.type === "out") {
    const material = store.get<{ id: string; initialStock: number }>("materials", String(data.materialId));
    if (material) {
      const available = currentStock(material, store.list("stockMovements") as never, existingId);
      if (Math.abs(Number(data.quantity)) > available) {
        throw new ApiError(400, "validation", [{ path: "quantity", message: "insufficient_stock", available }]);
      }
    }
  }

  if (collection === "attendance") {
    const dup = store
      .list<StoredDoc>("attendance")
      .find((a) => a.date === data.date && a.employeeId === data.employeeId && a.id !== existingId);
    if (dup) throw new ApiError(409, "duplicate_attendance");
  }

  if (collection === "payslips") {
    const dup = store
      .list<StoredDoc>("payslips")
      .find((p) => p.period === data.period && p.employeeId === data.employeeId && p.id !== existingId);
    if (dup) throw new ApiError(409, "duplicate_payslip");
  }
}

/* ------------------------------------------------------------------ */
/* Utilisateurs                                                        */
/* ------------------------------------------------------------------ */

function prepareUser(store: Store, data: Data, existing: StoredDoc | null, actor: SessionUser): Data {
  const users = store.list<StoredDoc>("users");
  if (users.some((u) => u.email === data.email && u.id !== existing?.id)) {
    throw new ApiError(409, "email_taken");
  }
  const { password, ...rest } = data;
  if (!existing && !password) throw new ApiError(400, "validation", [{ path: "password", message: "required" }]);

  if (existing) {
    const wasActiveAdmin = existing.role === "admin" && existing.active !== false;
    const staysActiveAdmin = rest.role === "admin" && rest.active !== false;
    if (wasActiveAdmin && !staysActiveAdmin) {
      const otherAdmins = users.filter((u) => u.id !== existing.id && u.role === "admin" && u.active !== false);
      if (otherAdmins.length === 0) throw new ApiError(400, "last_admin");
    }
    if (existing.id === actor.id && rest.active === false) throw new ApiError(400, "cannot_disable_self");
  }

  return {
    ...rest,
    passwordHash: password ? bcrypt.hashSync(String(password), 10) : existing?.passwordHash,
  };
}

export function publicDoc(collection: CollectionName, doc: StoredDoc): StoredDoc {
  if (collection === "users") {
    const { passwordHash: _ph, ...rest } = doc;
    void _ph;
    return rest as StoredDoc;
  }
  return doc;
}

/* ------------------------------------------------------------------ */
/* Création / mise à jour / suppression                                */
/* ------------------------------------------------------------------ */

export function createDoc(store: Store, collection: CollectionName, body: Data, actor: SessionUser): StoredDoc {
  return store.transaction(() => {
    const data = { ...body };
    autoNumber(store, collection, data);
    let parsed = schemas[collection].parse(data) as Data;
    validateBusiness(store, collection, parsed);
    if (collection === "users") parsed = prepareUser(store, parsed, null, actor);
    const doc = store.insert(collection, parsed) as StoredDoc;
    logActivity(store, actor, "create", collection, doc);
    return publicDoc(collection, doc);
  });
}

export function updateDoc(store: Store, collection: CollectionName, id: string, body: Data, actor: SessionUser): StoredDoc {
  return store.transaction(() => {
    const existing = store.get<StoredDoc>(collection, id);
    if (!existing) throw new ApiError(404, "not_found");
    const { passwordHash: _ph, ...existingPublic } = existing;
    void _ph;
    const merged: Data = { ...existingPublic, ...body };
    if (collection === "users" && !body.password) delete merged.password;
    let parsed = schemas[collection].parse(merged) as Data;
    validateBusiness(store, collection, parsed, id);
    if (collection === "users") parsed = prepareUser(store, parsed, existing, actor);
    const doc = store.update(collection, id, parsed) as StoredDoc;
    logActivity(store, actor, "update", collection, doc);
    return publicDoc(collection, doc);
  });
}

/** Références bloquantes : on ne supprime pas un élément encore utilisé. */
const BLOCKING: Partial<Record<CollectionName, Array<[CollectionName, string]>>> = {
  clients: [["projects", "clientId"], ["markets", "clientId"], ["quotes", "clientId"], ["invoices", "clientId"]],
  projects: [
    ["markets", "projectId"],
    ["invoices", "projectId"],
    ["expenses", "projectId"],
    ["attendance", "projectId"],
    ["stockMovements", "projectId"],
    ["subcontracts", "projectId"],
  ],
  suppliers: [["expenses", "supplierId"], ["stockMovements", "supplierId"], ["materials", "supplierId"]],
  subcontractors: [["subcontracts", "subcontractorId"]],
  employees: [["payslips", "employeeId"], ["attendance", "employeeId"]],
  materials: [["stockMovements", "materialId"]],
};
/** Éléments dépendants supprimés en cascade. */
const CASCADE: Partial<Record<CollectionName, Array<[CollectionName, string]>>> = {
  projects: [["tasks", "projectId"], ["dailyReports", "projectId"]],
  markets: [["situations", "marketId"], ["ods", "marketId"]],
};
/** Références simplement détachées. */
const NULLIFY: Partial<Record<CollectionName, Array<[CollectionName, string]>>> = {
  projects: [["equipment", "projectId"], ["employees", "projectId"]],
  tasks: [["tasks", "dependsOn"]],
};

export function deleteDoc(store: Store, collection: CollectionName, id: string, actor: SessionUser) {
  store.transaction(() => {
    const existing = store.get<StoredDoc>(collection, id);
    if (!existing) throw new ApiError(404, "not_found");

    for (const [target, field] of BLOCKING[collection] ?? []) {
      const n = store.list<StoredDoc>(target).filter((d) => d[field] === id).length;
      if (n > 0) throw new ApiError(409, "in_use", { collection: target, count: n });
    }
    if (collection === "users") {
      if (existing.id === actor.id) throw new ApiError(400, "cannot_delete_self");
      const admins = store.list<StoredDoc>("users").filter((u) => u.role === "admin" && u.active !== false);
      if (existing.role === "admin" && admins.length <= 1) throw new ApiError(400, "last_admin");
    }
    for (const [target, field] of CASCADE[collection] ?? []) {
      for (const d of store.list<StoredDoc>(target)) if (d[field] === id) store.remove(target, d.id);
    }
    for (const [target, field] of NULLIFY[collection] ?? []) {
      for (const d of store.list<StoredDoc>(target)) {
        if (d[field] === id) store.update(target, d.id, { ...d, [field]: "" });
      }
    }
    store.remove(collection, id);
    logActivity(store, actor, "delete", collection, existing);
  });
}

/* ------------------------------------------------------------------ */
/* Journal d'activité                                                  */
/* ------------------------------------------------------------------ */

export function docLabel(doc: Data): string {
  const candidates = [
    doc.number,
    doc.reference,
    doc.code && doc.name ? `${doc.code} — ${doc.name}` : undefined,
    doc.name,
    doc.firstName ? `${doc.firstName} ${doc.lastName ?? ""}`.trim() : undefined,
    doc.object,
    doc.subject,
    doc.description,
    doc.period,
    doc.date,
  ];
  const found = candidates.find((c) => typeof c === "string" && c.trim() !== "") ?? candidates.find((c) => typeof c === "number");
  return String(found ?? "").slice(0, 120);
}

export function logActivity(store: Store, actor: SessionUser, action: string, collection: string, doc: Data) {
  store.insert("activity", {
    userId: actor.id,
    userName: actor.name,
    action,
    collection,
    label: docLabel(doc),
    at: new Date().toISOString(),
  });
  const count = store.count("activity");
  if (count > 600) {
    const old = store.list<StoredDoc>("activity").slice(500);
    for (const d of old) store.remove("activity", d.id);
  }
}
