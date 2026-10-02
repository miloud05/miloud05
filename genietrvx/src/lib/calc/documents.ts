import { round2 } from "./money";

export interface DocumentLine {
  designation: string;
  unit: string;
  quantity: number;
  unitPrice: number;
}

export interface StampOptions {
  enabled: boolean;
  /** Taux du droit de timbre (%) */
  rate: number;
  /** Plafond (DA) */
  max: number;
}

export interface DocumentTotals {
  subtotal: number;
  discount: number;
  totalHT: number;
  tva: number;
  totalTTC: number;
  stamp: number;
  totalDue: number;
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);

export function lineTotal(line: Pick<DocumentLine, "quantity" | "unitPrice">): number {
  return round2(num(line.quantity) * num(line.unitPrice));
}

export function computeDocumentTotals(
  lines: readonly DocumentLine[],
  options: { discountRate: number; tvaRate: number; stamp?: StampOptions },
): DocumentTotals {
  const subtotal = round2(lines.reduce((acc, l) => acc + lineTotal(l), 0));
  const discount = round2((subtotal * num(options.discountRate)) / 100);
  const totalHT = round2(subtotal - discount);
  const tva = round2((totalHT * num(options.tvaRate)) / 100);
  const totalTTC = round2(totalHT + tva);
  const stamp = options.stamp?.enabled
    ? round2(Math.min(num(options.stamp.max) || Infinity, (totalTTC * num(options.stamp.rate)) / 100))
    : 0;
  return { subtotal, discount, totalHT, tva, totalTTC, stamp, totalDue: round2(totalTTC + stamp) };
}

export type PaymentStatus = "unpaid" | "partial" | "paid";

export function invoiceBalance(
  totalDue: number,
  payments: ReadonlyArray<{ amount: number }>,
): { paid: number; remaining: number; status: PaymentStatus } {
  const paid = round2(payments.reduce((acc, p) => acc + num(p.amount), 0));
  const remaining = round2(Math.max(0, totalDue - paid));
  const status: PaymentStatus = paid <= 0 ? "unpaid" : remaining <= 0.009 ? "paid" : "partial";
  return { paid, remaining, status };
}

/** Totaux et solde d'une facture selon les paramètres de droit de timbre. */
export function invoiceFigures(
  inv: {
    lines: readonly DocumentLine[];
    discountRate: number;
    tvaRate: number;
    stampEnabled: boolean;
    payments: ReadonlyArray<{ amount: number }>;
  },
  stamp: { stampRate: number; stampMax: number },
) {
  const totals = computeDocumentTotals(inv.lines, {
    discountRate: inv.discountRate,
    tvaRate: inv.tvaRate,
    stamp: { enabled: inv.stampEnabled, rate: stamp.stampRate, max: stamp.stampMax },
  });
  return { totals, balance: invoiceBalance(totals.totalDue, inv.payments) };
}
