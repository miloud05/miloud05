import { round2 } from "./money";

export interface MovementLike {
  id?: string;
  materialId: string;
  type: string;
  quantity: number;
}

/** Stock courant = stock initial + entrées − sorties ± ajustements. */
export function currentStock(
  material: { id: string; initialStock: number },
  movements: readonly MovementLike[],
  excludeId?: string,
): number {
  let qty = Number(material.initialStock) || 0;
  for (const m of movements) {
    if (m.materialId !== material.id || (excludeId && m.id === excludeId)) continue;
    const q = Number(m.quantity) || 0;
    if (m.type === "in") qty += Math.abs(q);
    else if (m.type === "out") qty -= Math.abs(q);
    else qty += q;
  }
  return round2(qty);
}
