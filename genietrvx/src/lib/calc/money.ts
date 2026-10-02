export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function sum<T>(items: readonly T[], pick: (item: T) => number): number {
  return round2(items.reduce((acc, item) => acc + (Number(pick(item)) || 0), 0));
}

export function formatMoney(value: number, locale = "fr"): string {
  const n = Number.isFinite(value) ? value : 0;
  return `${new Intl.NumberFormat(locale === "ar" ? "ar-DZ" : "fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    numberingSystem: "latn",
  }).format(n)} DA`;
}

export function formatNumber(value: number, digits = 2, locale = "fr"): string {
  const n = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat(locale === "ar" ? "ar-DZ" : "fr-FR", {
    maximumFractionDigits: digits,
    numberingSystem: "latn",
  }).format(n);
}

export function formatDate(value: string | undefined | null, locale = "fr"): string {
  if (!value) return "—";
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : "fr-FR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    numberingSystem: "latn",
  }).format(d);
}

export function todayIso(): string {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(`${fromIso}T00:00:00Z`);
  const b = Date.parse(`${toIso}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}
