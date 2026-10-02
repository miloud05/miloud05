import type { DqeItem } from "./market";

export const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** Convertit un nombre saisi à la française (« 1 250,50 ») ou à l'anglaise. */
export function parseNumber(s: string | undefined): number {
  const v = Number(String(s ?? "").replace(/[\s\u00a0\u202f]/g, "").replace(",", "."));
  return Number.isFinite(v) ? v : 0;
}

/** Lit des lignes collées depuis Excel : Code ⇥ Désignation ⇥ Unité ⇥ Quantité ⇥ PU (le code est facultatif). */
export function parsePastedItems(text: string): DqeItem[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.split("\t"))
    .filter((cols) => cols.some((c) => c.trim()))
    .map((cols) => {
      const [code, designation, unit, qty, pu] = cols.length >= 5 ? cols : ["", ...cols];
      return {
        id: newId(),
        code: code?.trim() ?? "",
        designation: designation?.trim() ?? "",
        unit: unit?.trim() ?? "",
        quantity: parseNumber(qty),
        unitPrice: parseNumber(pu),
      };
    })
    .filter((i) => i.designation);
}
