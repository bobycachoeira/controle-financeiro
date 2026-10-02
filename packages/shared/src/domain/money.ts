export const CENTS_IN_REAL = 100;

export function toCents(real: number): number {
  return Math.round(real * CENTS_IN_REAL);
}

export function fromCents(cents: number): number {
  return cents / CENTS_IN_REAL;
}

export function formatBRL(cents: number, locale = "pt-BR"): string {
  const value = fromCents(cents);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function sumCents(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function parseAmountToCents(input: string): number | null {
  const normalized = input
    .trim()
    .replace(/\s/g, "")
    .replace(/R\$/i, "")
    .replace(/\./g, "")
    .replace(",", ".");
  if (normalized === "" || Number.isNaN(Number(normalized))) return null;
  return toCents(Number(normalized));
}

export function splitCents(total: number, parts: number): number[] {
  if (parts <= 0) return [];
  const base = Math.floor(total / parts);
  const remainder = total - base * parts;
  const result = new Array<number>(parts).fill(base);
  result[parts - 1] = base + remainder;
  return result;
}
