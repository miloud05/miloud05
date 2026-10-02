import type { DqeItem } from "./market";
import { newId, parseNumber } from "./paste";

type Field = "code" | "designation" | "unit" | "quantity" | "unitPrice" | "amount";

/** Libellés d'en-tête reconnus (français / arabe), testés dans cet ordre. */
const HEADER_PATTERNS: Array<[Field, RegExp]> = [
  ["unitPrice", /prix\s*unit|^p\.?\s*u\.?(\s|$)|^pu$|السعر|ثمن الوحد/],
  ["amount", /montant|prix\s*total|^total|المبلغ|المجموع/],
  ["quantity", /quantit|^qt[e]?s?\.?$|^qte|qty|الكمية/],
  ["unit", /^u\.?$|^u\.?m\.?$|unite|^unit|الوحدة/],
  ["designation", /designation|libelle|description|ouvrage|nature des|intitule|التعيين|البيان|الوصف|طبيعة/],
  ["code", /^n[°o]?\.?$|^n°|^num|code|^art|^ref|^item|^poste|رقم|الرمز/],
  ["unitPrice", /^prix/],
];

const SKIP_DESIGNATION = /^(sous[\s-]*)?total|^montant|^t\.?v\.?a|^t\.?t\.?c|^h\.?t\.?$|^report|^a reporter|المجموع|الرسم/;

function normalize(cell: unknown): string {
  return String(cell ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function isNumeric(cell: unknown): boolean {
  const s = String(cell ?? "").replace(/[\s  ]/g, "");
  return s !== "" && /^-?\d+([.,]\d+)?$/.test(s);
}

function detectHeader(rows: string[][]): { index: number; columns: Partial<Record<Field, number>> } | null {
  for (let r = 0; r < Math.min(rows.length, 40); r++) {
    const columns: Partial<Record<Field, number>> = {};
    rows[r].forEach((cell, c) => {
      const text = normalize(cell);
      if (!text) return;
      for (const [field, pattern] of HEADER_PATTERNS) {
        if (columns[field] === undefined && pattern.test(text)) {
          columns[field] = c;
          break;
        }
      }
    });
    const extras = [columns.quantity, columns.unitPrice, columns.unit].filter((v) => v !== undefined).length;
    if (columns.designation !== undefined && extras >= 2) return { index: r, columns };
  }
  return null;
}

/**
 * Convertit les lignes d'une feuille (Excel, CSV ou copier-coller) en articles de DQE.
 * Avec en-tête : colonnes reconnues par leur libellé. Sans en-tête : ordre
 * Code · Désignation · Unité · Quantité · Prix unitaire (le code est facultatif).
 * Les titres de lots, sous-totaux et lignes vides sont ignorés.
 */
export function rowsToDqeItems(rows: string[][]): { items: DqeItem[]; headerRow: number | null } {
  const header = detectHeader(rows);
  const items: DqeItem[] = [];

  const push = (code: unknown, designation: unknown, unit: unknown, qty: unknown, pu: unknown) => {
    const label = String(designation ?? "").replace(/\s+/g, " ").trim();
    if (!label || SKIP_DESIGNATION.test(normalize(label))) return;
    if (!isNumeric(qty) && !isNumeric(pu)) return;
    const quantity = parseNumber(String(qty ?? ""));
    const unitPrice = parseNumber(String(pu ?? ""));
    if (quantity <= 0 && unitPrice <= 0) return;
    items.push({ id: newId(), code: String(code ?? "").trim(), designation: label, unit: String(unit ?? "").trim(), quantity, unitPrice });
  };

  if (header) {
    const col = header.columns;
    const at = (row: string[], c: number | undefined) => (c === undefined ? "" : row[c]);
    for (const row of rows.slice(header.index + 1)) {
      push(at(row, col.code), at(row, col.designation), at(row, col.unit), at(row, col.quantity), at(row, col.unitPrice));
    }
    return { items, headerRow: header.index };
  }

  for (const row of rows) {
    const start = row.findIndex((c) => String(c ?? "").trim() !== "");
    if (start < 0) continue;
    const cells = row.slice(start);
    const last = cells.length - 1 - [...cells].reverse().findIndex((c) => String(c ?? "").trim() !== "");
    const used = cells.slice(0, last + 1);
    if (used.length >= 5) push(used[0], used[1], used[2], used[3], used[4]);
    else if (used.length === 4) push("", used[0], used[1], used[2], used[3]);
  }
  return { items, headerRow: null };
}
