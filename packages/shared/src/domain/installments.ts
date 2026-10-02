import { addMonths, clampDay, formatISOMonth, pad2, parseISODate, parseISOMonth } from "./dates";
import { splitCents } from "./money";
import { referenceMonthForPurchase } from "./invoice";

export interface GeneratedInstallment {
  number: number;
  total: number;
  amount_cents: number;
  expected_date: string;
  reference_month: string;
}

export function expectedDateForInstallment(
  purchaseDate: string,
  number: number,
): string {
  const { year, month } = parseISOMonth(purchaseDate.slice(0, 7));
  const day = Number(purchaseDate.slice(8, 10));
  const shifted = addMonths(year, month, number - 1);
  const clampedDay = clampDay(shifted.year, shifted.month, day);
  return `${formatISOMonth(shifted.year, shifted.month)}-${pad2(clampedDay)}`;
}

export function generateInstallments(
  purchaseDate: string,
  totalCents: number,
  count: number,
  closingDay: number,
): GeneratedInstallment[] {
  if (!Number.isInteger(count) || count < 1) return [];
  const amounts = splitCents(totalCents, count);
  const result: GeneratedInstallment[] = [];
  for (let index = 0; index < count; index += 1) {
    const number = index + 1;
    const expectedDate = expectedDateForInstallment(purchaseDate, number);
    result.push({
      number,
      total: count,
      amount_cents: amounts[index] ?? 0,
      expected_date: expectedDate,
      reference_month: referenceMonthForPurchase(expectedDate, closingDay),
    });
  }
  return result;
}

export function sumInstallments(installments: readonly { amount_cents: number }[]): number {
  return installments.reduce((total, item) => total + item.amount_cents, 0);
}

export function isValidPurchaseDate(value: string): boolean {
  const parsed = parseISODate(value);
  return parsed.getTime() === parseISODate(value).getTime() && /^\d{4}-\d{2}-\d{2}$/.test(value);
}
