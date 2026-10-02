import { describe, expect, it } from "vitest";
import { computeDocumentTotals, invoiceBalance } from "@/lib/calc/documents";
import { amountInWordsFr } from "@/lib/calc/words";

describe("computeDocumentTotals", () => {
  const lines = [
    { designation: "Béton", unit: "m3", quantity: 10, unitPrice: 12000 },
    { designation: "Acier", unit: "kg", quantity: 500, unitPrice: 180 },
  ];

  it("calcule HT, remise, TVA et TTC", () => {
    const t = computeDocumentTotals(lines, { discountRate: 10, tvaRate: 19 });
    expect(t.subtotal).toBe(210000);
    expect(t.discount).toBe(21000);
    expect(t.totalHT).toBe(189000);
    expect(t.tva).toBe(35910);
    expect(t.totalTTC).toBe(224910);
    expect(t.stamp).toBe(0);
    expect(t.totalDue).toBe(224910);
  });

  it("applique le droit de timbre plafonné pour un paiement en espèces", () => {
    const t = computeDocumentTotals(lines, {
      discountRate: 0,
      tvaRate: 19,
      stamp: { enabled: true, rate: 1, max: 2500 },
    });
    expect(t.totalTTC).toBe(249900);
    expect(t.stamp).toBe(2499);
    const big = computeDocumentTotals([{ designation: "x", unit: "u", quantity: 1, unitPrice: 1_000_000 }], {
      discountRate: 0,
      tvaRate: 19,
      stamp: { enabled: true, rate: 1, max: 2500 },
    });
    expect(big.stamp).toBe(2500);
  });

  it("ignore les lignes invalides", () => {
    const t = computeDocumentTotals(
      [{ designation: "", unit: "", quantity: Number.NaN, unitPrice: 100 }],
      { discountRate: 0, tvaRate: 19 },
    );
    expect(t.totalTTC).toBe(0);
  });
});

describe("invoiceBalance", () => {
  it("calcule le payé, le reste et le statut", () => {
    expect(invoiceBalance(1000, [])).toEqual({ paid: 0, remaining: 1000, status: "unpaid" });
    expect(invoiceBalance(1000, [{ amount: 400 }])).toEqual({ paid: 400, remaining: 600, status: "partial" });
    expect(invoiceBalance(1000, [{ amount: 400 }, { amount: 600 }])).toEqual({
      paid: 1000,
      remaining: 0,
      status: "paid",
    });
  });
});

describe("amountInWordsFr", () => {
  it("écrit les montants en toutes lettres", () => {
    expect(amountInWordsFr(0)).toBe("zéro dinar algérien");
    expect(amountInWordsFr(1)).toBe("un dinar algérien");
    expect(amountInWordsFr(21)).toBe("vingt et un dinars algériens");
    expect(amountInWordsFr(80)).toBe("quatre-vingts dinars algériens");
    expect(amountInWordsFr(91)).toBe("quatre-vingt-onze dinars algériens");
    expect(amountInWordsFr(200)).toBe("deux cents dinars algériens");
    expect(amountInWordsFr(1250.5)).toBe("mille deux cent cinquante dinars algériens et cinquante centimes");
    expect(amountInWordsFr(2_000_000)).toBe("deux millions de dinars algériens");
    expect(amountInWordsFr(224910)).toBe("deux cent vingt-quatre mille neuf cent dix dinars algériens");
  });
});
