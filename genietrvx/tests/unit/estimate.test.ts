import { describe, expect, it } from "vitest";
import { estimateProject } from "@/lib/calc/estimate";
import { WILAYAS, wilayaZone } from "@/lib/wilayas";

describe("WILAYAS", () => {
  it("contient les 58 wilayas avec un code unique", () => {
    expect(WILAYAS).toHaveLength(58);
    expect(new Set(WILAYAS.map((w) => w.code)).size).toBe(58);
    expect(wilayaZone(16)).toBe("north");
    expect(wilayaZone(17)).toBe("highlands");
    expect(wilayaZone(11)).toBe("south");
  });
});

describe("estimateProject", () => {
  const base = { buildingType: "villa", standing: "standard", surface: 200, floors: 2, wilaya: 16 } as const;

  it("ventile le coût total par lots (somme = 100 %)", () => {
    const e = estimateProject(base);
    const lotsTotal = e.lots.reduce((a, l) => a + l.amount, 0);
    expect(Math.abs(lotsTotal - e.totalHT)).toBeLessThan(1);
    expect(e.totalHT).toBe(200 * 60000);
    expect(e.totalTTC).toBeCloseTo(e.totalHT * 1.19, 2);
    expect(e.low).toBeLessThan(e.totalHT);
    expect(e.high).toBeGreaterThan(e.totalHT);
  });

  it("majore les coûts dans le Sud et pour le haut standing", () => {
    const north = estimateProject(base).totalHT;
    const south = estimateProject({ ...base, wilaya: 11 }).totalHT;
    const luxury = estimateProject({ ...base, standing: "luxury" }).totalHT;
    expect(south).toBeGreaterThan(north);
    expect(luxury).toBeGreaterThan(north);
  });

  it("estime les matériaux, la durée et l'effectif", () => {
    const e = estimateProject(base);
    expect(e.materials.find((m) => m.key === "cement")?.quantity).toBeGreaterThan(0);
    expect(e.durationMonths).toBeGreaterThan(3);
    expect(e.workforce).toBeGreaterThanOrEqual(4);
  });

  it("rejette les surfaces invalides", () => {
    expect(() => estimateProject({ ...base, surface: 0 })).toThrow();
  });
});
