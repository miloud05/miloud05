import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { rowsToDqeItems } from "@/lib/calc/dqe-import";
import { readCsv, readSpreadsheet, readXlsx } from "@/lib/server/spreadsheet";

describe("rowsToDqeItems", () => {
  it("détecte l'en-tête français et ignore titres, sections et totaux", () => {
    const rows = [
      ["MARCHÉ N° 12/2026 — Réalisation d'un CEM"],
      [],
      ["N°", "Désignation des ouvrages", "Unité", "Quantité", "Prix unitaire", "Montant"],
      ["", "LOT 1 : TERRASSEMENTS"],
      ["1.1", "Fouilles en pleine masse", "m3", "1 200,5", "650", "780325"],
      ["1.2", "Remblais compactés", "m3", "300", "480,00", "144000"],
      ["", "Total lot 1", "", "", "", "924325"],
      ["2.1", "Béton armé en fondations", "m3", "95", "24 000", ""],
    ];
    const r = rowsToDqeItems(rows);
    expect(r.headerRow).toBe(2);
    expect(r.items).toHaveLength(3);
    expect(r.items[0]).toMatchObject({ code: "1.1", designation: "Fouilles en pleine masse", unit: "m3", quantity: 1200.5, unitPrice: 650 });
    expect(r.items[2]).toMatchObject({ code: "2.1", quantity: 95, unitPrice: 24000 });
    expect(new Set(r.items.map((i) => i.id)).size).toBe(3);
  });

  it("reconnaît un en-tête en arabe et un ordre de colonnes différent", () => {
    const rows = [
      ["التعيين", "الكمية", "الوحدة", "السعر الوحدوي", "الرقم"],
      ["حفر", "100", "م3", "700", "01"],
    ];
    const r = rowsToDqeItems(rows);
    expect(r.items).toEqual([expect.objectContaining({ code: "01", designation: "حفر", unit: "م3", quantity: 100, unitPrice: 700 })]);
  });

  it("utilise l'ordre Code · Désignation · Unité · Quantité · PU sans en-tête", () => {
    const r = rowsToDqeItems([
      ["1", "Maçonnerie", "m2", "50", "2400"],
      ["Enduit", "m2", "80", "650"],
    ]);
    expect(r.headerRow).toBeNull();
    expect(r.items).toHaveLength(2);
    expect(r.items[1]).toMatchObject({ code: "", designation: "Enduit", quantity: 80, unitPrice: 650 });
  });

  it("retourne une liste vide si rien n'est exploitable", () => {
    expect(rowsToDqeItems([["Bonjour"], [], ["Total", "", "", "", ""]]).items).toEqual([]);
  });
});

describe("readCsv", () => {
  it("détecte le séparateur et gère les guillemets", () => {
    expect(readCsv('Code;Désignation;Unité;Quantité;PU\n1;"Béton; dosé à 350";m3;10;"24 000,50"\n')).toEqual([
      ["Code", "Désignation", "Unité", "Quantité", "PU"],
      ["1", "Béton; dosé à 350", "m3", "10", "24 000,50"],
    ]);
    expect(readCsv("a,b\n1,2")).toEqual([["a", "b"], ["1", "2"]]);
    expect(readCsv("﻿a\tb")).toEqual([["a", "b"]]);
  });
});

function makeXlsx(): Uint8Array {
  const sharedStrings = `<?xml version="1.0" encoding="UTF-8"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="5" uniqueCount="5">
<si><t>Désignation</t></si><si><t>Unité</t></si><si><t>Qté</t></si><si><t>P.U</t></si>
<si><r><t>Béton &amp; </t></r><r><t>acier</t></r></si></sst>`;
  const sheet = `<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
<row r="2"><c r="B2" t="s"><v>0</v></c><c r="C2" t="s"><v>1</v></c><c r="D2" t="s"><v>2</v></c><c r="E2" t="s"><v>3</v></c></row>
<row r="3"><c r="B3" t="s"><v>4</v></c><c r="C3" t="inlineStr"><is><t>m3</t></is></c><c r="D3"><v>12.5</v></c><c r="E3"><v>24000</v></c></row>
</sheetData></worksheet>`;
  const workbook = `<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="DQE" sheetId="1" r:id="rId1"/></sheets></workbook>`;
  const rels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`;
  return zipSync({
    "xl/workbook.xml": strToU8(workbook),
    "xl/_rels/workbook.xml.rels": strToU8(rels),
    "xl/sharedStrings.xml": strToU8(sharedStrings),
    "xl/worksheets/sheet1.xml": strToU8(sheet),
  });
}

describe("readXlsx", () => {
  it("lit les chaînes partagées, le texte enrichi, les cellules inline et les colonnes vides", () => {
    const rows = readXlsx(makeXlsx());
    expect(rows).toEqual([
      [],
      ["", "Désignation", "Unité", "Qté", "P.U"],
      ["", "Béton & acier", "m3", "12.5", "24000"],
    ]);
    const r = rowsToDqeItems(rows);
    expect(r.items).toEqual([expect.objectContaining({ designation: "Béton & acier", unit: "m3", quantity: 12.5, unitPrice: 24000 })]);
  });

  it("choisit le lecteur selon le nom du fichier et refuse les formats inconnus", () => {
    expect(readSpreadsheet("dqe.xlsx", makeXlsx())[1][1]).toBe("Désignation");
    expect(readSpreadsheet("dqe.csv", strToU8("a;b"))).toEqual([["a", "b"]]);
    expect(() => readSpreadsheet("dqe.pdf", strToU8("x"))).toThrow("unsupported_file");
    expect(() => readSpreadsheet("dqe.xlsx", strToU8("pas un zip"))).toThrow("unsupported_file");
  });
});
