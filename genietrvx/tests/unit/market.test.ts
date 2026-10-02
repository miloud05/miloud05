import { describe, expect, it } from "vitest";
import {
  computeDqeTotals,
  computeSituation,
  computeDelay,
  computePriceRevision,
  previousQuantities,
} from "@/lib/calc/market";

const items = [
  { id: "a", code: "1.1", designation: "Terrassement", unit: "m3", quantity: 100, unitPrice: 1000 },
  { id: "b", code: "1.2", designation: "Béton armé", unit: "m3", quantity: 50, unitPrice: 20000 },
];

describe("computeDqeTotals", () => {
  it("additionne le DQE et les avenants", () => {
    const t = computeDqeTotals(items, 19, [{ amount: 100000 }]);
    expect(t.baseHT).toBe(1_100_000);
    expect(t.amendmentsHT).toBe(100000);
    expect(t.totalHT).toBe(1_200_000);
    expect(t.tva).toBe(228000);
    expect(t.totalTTC).toBe(1_428_000);
  });
});

describe("computeSituation", () => {
  const market = { items, tvaRate: 19, guaranteeRate: 5, advanceRate: 10, revisionCoefficient: 1 };

  it("calcule une première situation", () => {
    const s = computeSituation(market, { a: 100, b: 10 }, {});
    expect(s.cumulativeHT).toBe(300000);
    expect(s.previousHT).toBe(0);
    expect(s.currentHT).toBe(300000);
    expect(s.revision).toBe(0);
    expect(s.tva).toBe(57000);
    expect(s.currentTTC).toBe(357000);
    expect(s.guarantee).toBe(17850);
    expect(s.advanceRepayment).toBe(30000);
    expect(s.netToPay).toBe(357000 - 17850 - 30000);
    expect(s.progress).toBeCloseTo((300000 / 1_100_000) * 100, 4);
  });

  it("déduit les quantités précédentes et plafonne au DQE", () => {
    const s = computeSituation(market, { a: 150, b: 30 }, { a: 100, b: 10 });
    // a est plafonnée à 100 → aucune nouvelle quantité
    expect(s.lines.find((l) => l.itemId === "a")?.currentQty).toBe(0);
    expect(s.currentHT).toBe(400000);
  });

  it("applique le coefficient de révision et les pénalités", () => {
    const s = computeSituation({ ...market, revisionCoefficient: 1.05 }, { a: 100 }, {}, 1000);
    expect(s.revision).toBe(5000);
    expect(s.penalties).toBe(1000);
    expect(s.netToPay).toBe(round(s.currentTTC - s.guarantee - s.advanceRepayment - 1000));
  });
});

describe("computeDelay", () => {
  it("détecte le retard et calcule les pénalités plafonnées", () => {
    const d = computeDelay({
      startDate: "2026-01-01",
      durationDays: 30,
      suspendedDays: 5,
      completionDate: "2026-02-10",
      amountTTC: 1_000_000,
      penaltyRatePerMille: 1,
      penaltyCapPercent: 10,
    });
    expect(d.contractualEnd).toBe("2026-02-05");
    expect(d.lateDays).toBe(5);
    expect(d.penalty).toBe(5000);
  });

  it("plafonne les pénalités", () => {
    const d = computeDelay({
      startDate: "2026-01-01",
      durationDays: 10,
      suspendedDays: 0,
      completionDate: "2026-12-31",
      amountTTC: 100000,
      penaltyRatePerMille: 5,
      penaltyCapPercent: 10,
    });
    expect(d.penalty).toBe(10000);
  });
});

describe("computePriceRevision", () => {
  it("applique la formule paramétrique P = P0 × (a + Σ bi·Ii/I0i)", () => {
    const r = computePriceRevision(1_000_000, 0.15, [
      { weight: 0.5, baseIndex: 100, currentIndex: 110 },
      { weight: 0.35, baseIndex: 200, currentIndex: 200 },
    ]);
    expect(r.coefficient).toBeCloseTo(1.05, 6);
    expect(r.revisedAmount).toBe(1_050_000);
    expect(r.difference).toBe(50000);
    expect(r.weightsValid).toBe(true);
  });
});

function round(v: number) {
  return Math.round(v * 100) / 100;
}


describe("previousQuantities", () => {
  it("retourne les quantités de la situation précédente du même marché", () => {
    const list = [
      { id: "1", marketId: "m", number: 1, quantities: { a: 10 } },
      { id: "2", marketId: "m", number: 2, quantities: { a: 25 } },
      { id: "3", marketId: "x", number: 2, quantities: { a: 99 } },
    ];
    expect(previousQuantities(list, "m", 3)).toEqual({ a: 25 });
    expect(previousQuantities(list, "m", 2)).toEqual({ a: 10 });
    expect(previousQuantities(list, "m", 1)).toEqual({});
  });
});
