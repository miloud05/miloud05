import { addDays, daysBetween, round2 } from "./money";

export interface DqeItem {
  id: string;
  code: string;
  designation: string;
  unit: string;
  quantity: number;
  unitPrice: number;
}

export interface DqeTotals {
  baseHT: number;
  amendmentsHT: number;
  totalHT: number;
  tva: number;
  totalTTC: number;
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);

export function dqeBaseHT(items: readonly DqeItem[]): number {
  return round2(items.reduce((acc, i) => acc + num(i.quantity) * num(i.unitPrice), 0));
}

export function computeDqeTotals(
  items: readonly DqeItem[],
  tvaRate: number,
  amendments: ReadonlyArray<{ amount: number }> = [],
): DqeTotals {
  const baseHT = dqeBaseHT(items);
  const amendmentsHT = round2(amendments.reduce((acc, a) => acc + num(a.amount), 0));
  const totalHT = round2(baseHT + amendmentsHT);
  const tva = round2((totalHT * num(tvaRate)) / 100);
  return { baseHT, amendmentsHT, totalHT, tva, totalTTC: round2(totalHT + tva) };
}

export interface SituationMarket {
  items: readonly DqeItem[];
  tvaRate: number;
  /** Retenue de garantie (%) appliquée au TTC de la situation */
  guaranteeRate: number;
  /** Avance forfaitaire (%) remboursée au prorata des travaux */
  advanceRate: number;
  /** Coefficient de révision des prix (1 = pas de révision) */
  revisionCoefficient: number;
}

export interface SituationLine {
  itemId: string;
  code: string;
  designation: string;
  unit: string;
  unitPrice: number;
  contractQty: number;
  previousQty: number;
  cumulativeQty: number;
  currentQty: number;
  previousAmount: number;
  currentAmount: number;
  cumulativeAmount: number;
}

export interface SituationResult {
  lines: SituationLine[];
  previousHT: number;
  currentHT: number;
  cumulativeHT: number;
  revision: number;
  tva: number;
  currentTTC: number;
  guarantee: number;
  advanceRepayment: number;
  penalties: number;
  netToPay: number;
  /** Avancement financier cumulé (%) par rapport au DQE */
  progress: number;
}

/**
 * Situation de travaux : quantités cumulées (plafonnées au DQE) moins quantités précédentes.
 * `cumulative` et `previous` sont indexés par identifiant d'article du DQE.
 */
export function computeSituation(
  market: SituationMarket,
  cumulative: Readonly<Record<string, number>>,
  previous: Readonly<Record<string, number>>,
  penalties = 0,
): SituationResult {
  const lines: SituationLine[] = market.items.map((item) => {
    const contractQty = num(item.quantity);
    const prevQty = Math.min(contractQty, Math.max(0, num(previous[item.id])));
    const cumQty = Math.max(prevQty, Math.min(contractQty, Math.max(0, num(cumulative[item.id]))));
    const pu = num(item.unitPrice);
    return {
      itemId: item.id,
      code: item.code,
      designation: item.designation,
      unit: item.unit,
      unitPrice: pu,
      contractQty,
      previousQty: prevQty,
      cumulativeQty: cumQty,
      currentQty: round2(cumQty - prevQty),
      previousAmount: round2(prevQty * pu),
      currentAmount: round2((cumQty - prevQty) * pu),
      cumulativeAmount: round2(cumQty * pu),
    };
  });

  const previousHT = round2(lines.reduce((a, l) => a + l.previousAmount, 0));
  const cumulativeHT = round2(lines.reduce((a, l) => a + l.cumulativeAmount, 0));
  const currentHT = round2(cumulativeHT - previousHT);
  const coefficient = num(market.revisionCoefficient) || 1;
  const revision = round2(currentHT * (coefficient - 1));
  const tva = round2(((currentHT + revision) * num(market.tvaRate)) / 100);
  const currentTTC = round2(currentHT + revision + tva);
  const guarantee = round2((currentTTC * num(market.guaranteeRate)) / 100);

  const contractHT = dqeBaseHT(market.items);
  const totalAdvance = (contractHT * num(market.advanceRate)) / 100;
  const alreadyRepaid = Math.min(totalAdvance, (previousHT * num(market.advanceRate)) / 100);
  const advanceRepayment = round2(
    Math.min(totalAdvance - alreadyRepaid, (currentHT * num(market.advanceRate)) / 100),
  );
  const pen = round2(num(penalties));
  const netToPay = round2(currentTTC - guarantee - advanceRepayment - pen);

  return {
    lines,
    previousHT,
    currentHT,
    cumulativeHT,
    revision,
    tva,
    currentTTC,
    guarantee,
    advanceRepayment,
    penalties: pen,
    netToPay,
    progress: contractHT > 0 ? (cumulativeHT / contractHT) * 100 : 0,
  };
}

export interface DelayInput {
  startDate: string;
  durationDays: number;
  suspendedDays: number;
  /** Date d'achèvement réelle ou date du jour */
  completionDate: string;
  amountTTC: number;
  /** Taux de pénalité par jour de retard (‰ du montant) */
  penaltyRatePerMille: number;
  /** Plafond des pénalités (% du montant) */
  penaltyCapPercent: number;
}

export function computeDelay(input: DelayInput) {
  const contractualEnd = addDays(input.startDate, num(input.durationDays) + num(input.suspendedDays));
  const lateDays = Math.max(0, daysBetween(contractualEnd, input.completionDate));
  const raw = (num(input.amountTTC) * num(input.penaltyRatePerMille) * lateDays) / 1000;
  const cap = (num(input.amountTTC) * num(input.penaltyCapPercent)) / 100;
  const elapsed = Math.max(0, daysBetween(input.startDate, input.completionDate));
  const totalDays = num(input.durationDays) + num(input.suspendedDays);
  return {
    contractualEnd,
    lateDays,
    penalty: round2(cap > 0 ? Math.min(raw, cap) : raw),
    timeConsumed: totalDays > 0 ? Math.min(100, (elapsed / totalDays) * 100) : 0,
  };
}

export interface RevisionIndex {
  weight: number;
  baseIndex: number;
  currentIndex: number;
}

/** Révision des prix : P = P0 × (a + Σ bᵢ × Iᵢ / I0ᵢ) avec a + Σ bᵢ = 1. */
export function computePriceRevision(baseAmount: number, fixedPart: number, indexes: readonly RevisionIndex[]) {
  const variable = indexes.reduce(
    (acc, i) => acc + (num(i.baseIndex) > 0 ? (num(i.weight) * num(i.currentIndex)) / num(i.baseIndex) : 0),
    0,
  );
  const coefficient = num(fixedPart) + variable;
  const weightSum = num(fixedPart) + indexes.reduce((acc, i) => acc + num(i.weight), 0);
  const revisedAmount = round2(num(baseAmount) * coefficient);
  return {
    coefficient,
    revisedAmount,
    difference: round2(revisedAmount - num(baseAmount)),
    weightsValid: Math.abs(weightSum - 1) < 0.0001,
  };
}

/** Quantités cumulées de la situation précédente (numéro immédiatement inférieur) du même marché. */
export function previousQuantities(
  situations: ReadonlyArray<{ id: string; marketId: string; number: number; quantities: Record<string, number> }>,
  marketId: string,
  number: number,
): Record<string, number> {
  const prev = situations
    .filter((s) => s.marketId === marketId && s.number < number)
    .sort((a, b) => b.number - a.number)[0];
  return prev ? { ...prev.quantities } : {};
}
