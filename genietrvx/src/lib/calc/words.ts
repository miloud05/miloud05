const UNITS = [
  "zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf",
  "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize",
];
const TENS = ["", "dix", "vingt", "trente", "quarante", "cinquante", "soixante"];

/** 0 – 99 (orthographe traditionnelle avec traits d'union). */
function below100(n: number, pluralEighty: boolean): string {
  if (n < 17) return UNITS[n];
  if (n < 20) return `dix-${UNITS[n - 10]}`;
  if (n < 70) {
    const t = Math.floor(n / 10);
    const u = n % 10;
    if (u === 0) return TENS[t];
    if (u === 1) return `${TENS[t]} et un`;
    return `${TENS[t]}-${UNITS[u]}`;
  }
  if (n < 80) {
    const u = n - 60;
    if (u === 11) return "soixante et onze";
    return `soixante-${below100(u, false)}`;
  }
  const u = n - 80;
  if (u === 0) return pluralEighty ? "quatre-vingts" : "quatre-vingt";
  return `quatre-vingt-${below100(u, false)}`;
}

/** 0 – 999. `final` = vrai si le groupe n'est suivi d'aucun « mille » (accord de cent / quatre-vingt). */
function below1000(n: number, final: boolean): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const parts: string[] = [];
  if (h > 0) {
    if (h === 1) parts.push("cent");
    else parts.push(`${UNITS[h]} ${r === 0 && final ? "cents" : "cent"}`);
  }
  if (r > 0 || h === 0) parts.push(below100(r, final));
  return parts.join(" ");
}

export function integerToWordsFr(value: number): string {
  let n = Math.floor(Math.abs(value));
  if (n === 0) return "zéro";
  const scales: Array<[number, string, string]> = [
    [1_000_000_000, "milliard", "milliards"],
    [1_000_000, "million", "millions"],
  ];
  const parts: string[] = [];
  for (const [size, singular, plural] of scales) {
    const q = Math.floor(n / size);
    if (q > 0) {
      parts.push(`${below1000(q, true)} ${q > 1 ? plural : singular}`);
      n %= size;
    }
  }
  const thousands = Math.floor(n / 1000);
  if (thousands > 0) {
    parts.push(thousands === 1 ? "mille" : `${below1000(thousands, false)} mille`);
    n %= 1000;
  }
  if (n > 0) parts.push(below1000(n, true));
  return parts.join(" ");
}

/** Montant en toutes lettres pour les factures algériennes (dinars et centimes). */
export function amountInWordsFr(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.abs(amount) : 0;
  const dinars = Math.floor(safe);
  const centimes = Math.round((safe - dinars) * 100);
  const words = integerToWordsFr(dinars);
  const roundMillions = dinars >= 1_000_000 && dinars % 1_000_000 === 0;
  let text: string;
  if (dinars <= 1) text = `${words} dinar algérien`;
  else text = `${words} ${roundMillions ? "de " : ""}dinars algériens`;
  if (centimes > 0) text += ` et ${integerToWordsFr(centimes)} centime${centimes > 1 ? "s" : ""}`;
  return text;
}
