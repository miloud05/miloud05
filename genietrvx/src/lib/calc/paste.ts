import type { DqeItem } from "./market";
import { rowsToDqeItems } from "./dqe-import";

export const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** Convertit un nombre saisi à la française (« 1 250,50 ») ou à l'anglaise. */
export function parseNumber(s: string | undefined): number {
  const v = Number(String(s ?? "").replace(/[\s\u00a0\u202f]/g, "").replace(",", "."));
  return Number.isFinite(v) ? v : 0;
}

/** Lit des lignes collées depuis Excel (colonnes séparées par des tabulations), avec ou sans en-tête. */
export function parsePastedItems(text: string): DqeItem[] {
  return rowsToDqeItems(text.split(/\r?\n/).map((line) => line.split("\t"))).items;
}
