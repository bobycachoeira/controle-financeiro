export interface ExchangeRateLike {
  currency: string;
  date: string;
  rate_micros: number;
}

export const BASE_CURRENCY = "BRL";
export const BASE_RATE_MICROS = 1_000_000;

export interface CurrencyEntry {
  amountCents: number;
  currency: string;
  date: string;
}

export function convertCents(cents: number, rateMicros: number): number {
  return Math.round((cents * rateMicros) / 1_000_000);
}

export function pickRate(
  rates: readonly ExchangeRateLike[],
  currency: string,
  date: string,
): number | null {
  if (currency === BASE_CURRENCY) return BASE_RATE_MICROS;
  const candidates = rates
    .filter((rate) => rate.currency === currency && rate.date <= date)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  return candidates[0]?.rate_micros ?? null;
}

export interface ConsolidationResult {
  totalCents: number;
  missing: string[];
}

export function consolidateToBRL(
  entries: readonly CurrencyEntry[],
  rates: readonly ExchangeRateLike[],
): ConsolidationResult {
  let total = 0;
  const missing = new Set<string>();
  for (const entry of entries) {
    const rate = pickRate(rates, entry.currency, entry.date);
    if (rate === null) {
      missing.add(entry.currency);
      continue;
    }
    total += convertCents(entry.amountCents, rate);
  }
  return { totalCents: total, missing: [...missing] };
}
