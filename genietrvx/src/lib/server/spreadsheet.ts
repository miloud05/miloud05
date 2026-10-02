import { strFromU8, unzipSync } from "fflate";

/**
 * Lecture de tableurs sans dépendance lourde : .xlsx (Office Open XML) et .csv/.tsv/.txt.
 * Retourne les lignes de la feuille la plus remplie sous forme de tableaux de chaînes.
 */

const MAX_ROWS = 10000;

function decodeXml(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) => {
    const k = e.toLowerCase();
    if (k === "amp") return "&";
    if (k === "lt") return "<";
    if (k === "gt") return ">";
    if (k === "quot") return '"';
    if (k === "apos") return "'";
    const code = k.startsWith("#x") ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10);
    return Number.isFinite(code) ? String.fromCodePoint(code) : "";
  });
}

/** Texte d'un nœud <si> ou <is> : concaténation des <t>, sans la phonétique <rPh>. */
function richText(xml: string): string {
  return [...xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "").matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((m) => decodeXml(m[1])).join("");
}

function columnIndex(ref: string): number {
  const letters = /^[A-Z]+/i.exec(ref)?.[0].toUpperCase() ?? "A";
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function readSheet(xml: string, shared: string[]): string[][] {
  const rows: string[][] = [];
  let implicitRow = 0;
  for (const rowMatch of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const rAttr = /\br="(\d+)"/.exec(rowMatch[1])?.[1];
    const rowIndex = rAttr ? Number(rAttr) - 1 : implicitRow;
    implicitRow = rowIndex + 1;
    if (rowIndex >= MAX_ROWS) break;
    const cells: string[] = [];
    let implicitCol = 0;
    for (const c of (rowMatch[2] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1];
      const ref = /\br="([A-Z]+\d*)"/i.exec(attrs)?.[1];
      const col = ref ? columnIndex(ref) : implicitCol;
      implicitCol = col + 1;
      const type = /\bt="(\w+)"/.exec(attrs)?.[1];
      const body = c[2] ?? "";
      const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      let value = "";
      if (type === "s") value = shared[Number(v)] ?? "";
      else if (type === "inlineStr") value = richText(body);
      else if (type === "b") value = v === "1" ? "TRUE" : "FALSE";
      else if (v !== undefined) value = decodeXml(v);
      while (cells.length < col) cells.push("");
      cells[col] = value.trim();
    }
    while (rows.length < rowIndex) rows.push([]);
    rows[rowIndex] = cells;
  }
  return rows;
}

export function readXlsx(data: Uint8Array): string[][] {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(data, { filter: (f) => f.name.startsWith("xl/") && f.name.endsWith(".xml") || f.name.endsWith(".rels") });
  } catch {
    throw new Error("unsupported_file");
  }
  const text = (name: string) => (files[name] ? strFromU8(files[name]) : "");

  const shared = [...text("xl/sharedStrings.xml").matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((m) => richText(m[1]));

  // Feuilles déclarées dans le classeur, dans l'ordre ; à défaut toutes les feuilles présentes.
  const rels = new Map(
    [...text("xl/_rels/workbook.xml.rels").matchAll(/<Relationship\b[^>]*\bId="([^"]+)"[^>]*\bTarget="([^"]+)"/g)].map((m) => [
      m[1],
      m[2].replace(/^\/?(xl\/)?/, "xl/"),
    ]),
  );
  let sheets = [...text("xl/workbook.xml").matchAll(/<sheet\b[^>]*\br:id="([^"]+)"/g)]
    .map((m) => rels.get(m[1]))
    .filter((p): p is string => !!p && !!files[p]);
  if (!sheets.length) sheets = Object.keys(files).filter((n) => /^xl\/worksheets\/[^/]+\.xml$/.test(n)).sort();
  if (!sheets.length) throw new Error("unsupported_file");

  let best: string[][] = [];
  let bestCount = -1;
  for (const path of sheets) {
    const rows = readSheet(text(path), shared);
    const count = rows.filter((r) => r.some((c) => c !== "")).length;
    if (count > bestCount) {
      best = rows;
      bestCount = count;
    }
  }
  return best;
}

/** CSV : séparateur détecté (; , tabulation), guillemets doublés, BOM ignoré. */
export function readCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const counts = [";", ",", "\t"].map((d) => [d, firstLine.split(d).length - 1] as const);
  const sep = counts.sort((a, b) => b[1] - a[1])[0][1] > 0 ? counts[0][0] : ";";

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === sep) {
      row.push(cell.trim());
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = "";
      if (rows.length >= MAX_ROWS) break;
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell.trim());
    rows.push(row);
  }
  return rows;
}

/** UTF-8 si valide, sinon Windows-1252 (CSV enregistrés par Excel en français). */
function decodeText(data: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(data);
  } catch {
    return new TextDecoder("windows-1252").decode(data);
  }
}

export function readSpreadsheet(fileName: string, data: Uint8Array): string[][] {
  const ext = fileName.toLowerCase().split(".").pop();
  if (ext === "xlsx" || ext === "xlsm") return readXlsx(data);
  if (ext === "csv" || ext === "tsv" || ext === "txt") return readCsv(decodeText(data));
  throw new Error("unsupported_file");
}
