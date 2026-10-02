import { wilayaZone, type Zone } from "../wilayas";
import { round2 } from "./money";

export type BuildingType = "villa" | "apartments" | "public" | "commercial" | "warehouse";
export type Standing = "economic" | "standard" | "luxury";

export interface EstimateInput {
  buildingType: BuildingType;
  standing: Standing;
  /** Surface hors œuvre totale (m²) */
  surface: number;
  floors: number;
  wilaya: number;
  tvaRate?: number;
}

/** Coût de référence au m² (DA HT, zone Nord) — paramètres indicatifs 2026. */
export const COST_PER_M2: Record<BuildingType, Record<Standing, number>> = {
  villa: { economic: 45000, standard: 60000, luxury: 90000 },
  apartments: { economic: 50000, standard: 65000, luxury: 95000 },
  public: { economic: 55000, standard: 72000, luxury: 100000 },
  commercial: { economic: 52000, standard: 68000, luxury: 95000 },
  warehouse: { economic: 30000, standard: 38000, luxury: 50000 },
};

export const ZONE_FACTOR: Record<Zone, number> = { north: 1, highlands: 1.05, south: 1.15 };

export const LOT_KEYS = [
  "site",
  "earthworks",
  "structure",
  "masonry",
  "waterproofing",
  "plumbing",
  "electricity",
  "joinery",
  "finishes",
  "painting",
  "external",
] as const;
export type LotKey = (typeof LOT_KEYS)[number];

const BUILDING_LOTS: Record<LotKey, number> = {
  site: 2,
  earthworks: 4,
  structure: 38,
  masonry: 9,
  waterproofing: 4,
  plumbing: 6,
  electricity: 7,
  joinery: 10,
  finishes: 10,
  painting: 5,
  external: 5,
};

const WAREHOUSE_LOTS: Record<LotKey, number> = {
  site: 3,
  earthworks: 6,
  structure: 52,
  masonry: 6,
  waterproofing: 7,
  plumbing: 3,
  electricity: 8,
  joinery: 6,
  finishes: 4,
  painting: 2,
  external: 3,
};

/** Ratios de matériaux par m² et prix unitaires indicatifs (DA). */
const MATERIALS = [
  { key: "concrete", unit: "m3", building: 0.35, warehouse: 0.15, price: 0 },
  { key: "cement", unit: "t", building: 0.3, warehouse: 0.12, price: 26000 },
  { key: "steel", unit: "kg", building: 40, warehouse: 45, price: 160 },
  { key: "sand", unit: "m3", building: 0.45, warehouse: 0.2, price: 3000 },
  { key: "gravel", unit: "m3", building: 0.6, warehouse: 0.25, price: 3500 },
  { key: "bricks", unit: "u", building: 80, warehouse: 20, price: 45 },
] as const;
export type MaterialKey = (typeof MATERIALS)[number]["key"];

export interface EstimateResult {
  costPerM2: number;
  totalHT: number;
  tva: number;
  totalTTC: number;
  low: number;
  high: number;
  lots: Array<{ key: LotKey; percent: number; amount: number }>;
  materials: Array<{ key: MaterialKey; unit: string; quantity: number; unitPrice: number; amount: number }>;
  durationMonths: number;
  workforce: number;
  zone: Zone;
}

export function estimateProject(input: EstimateInput): EstimateResult {
  const surface = Number(input.surface);
  const floors = Math.max(1, Math.floor(Number(input.floors) || 1));
  if (!Number.isFinite(surface) || surface <= 0) throw new Error("La surface doit être positive");
  if (!COST_PER_M2[input.buildingType]) throw new Error("Type d'ouvrage inconnu");

  const zone = wilayaZone(input.wilaya);
  const floorFactor = 1 + 0.02 * Math.max(0, floors - 2);
  const costPerM2 = round2(COST_PER_M2[input.buildingType][input.standing] * ZONE_FACTOR[zone] * floorFactor);
  const totalHT = round2(costPerM2 * surface);
  const tvaRate = input.tvaRate ?? 19;
  const tva = round2((totalHT * tvaRate) / 100);

  const split = input.buildingType === "warehouse" ? WAREHOUSE_LOTS : BUILDING_LOTS;
  const lots = LOT_KEYS.map((key) => ({ key, percent: split[key], amount: round2((totalHT * split[key]) / 100) }));
  const drift = round2(totalHT - lots.reduce((a, l) => a + l.amount, 0));
  lots[2].amount = round2(lots[2].amount + drift);

  const kind = input.buildingType === "warehouse" ? "warehouse" : "building";
  const materials = MATERIALS.map((m) => {
    const quantity = round2(m[kind] * surface);
    return { key: m.key, unit: m.unit, quantity, unitPrice: m.price, amount: round2(quantity * m.price) };
  });

  const standingFactor = input.standing === "luxury" ? 1.25 : input.standing === "economic" ? 0.9 : 1;
  const durationMonths = Math.max(3, Math.round((3 + Math.sqrt(surface) * 0.45 + floors * 0.8) * standingFactor));
  const workforce = Math.min(120, Math.max(4, Math.ceil(surface / 40)));

  return {
    costPerM2,
    totalHT,
    tva,
    totalTTC: round2(totalHT + tva),
    low: round2(totalHT * 0.9),
    high: round2(totalHT * 1.1),
    lots,
    materials,
    durationMonths,
    workforce,
    zone,
  };
}
