import { addMonths, clampDay, daysInMonth, formatISOMonth, pad2, parseISOMonth } from "./dates";

export function closingDateForMonth(referenceMonth: string, closingDay: number): string {
  const { year, month } = parseISOMonth(referenceMonth);
  const day = clampDay(year, month, closingDay);
  return `${referenceMonth}-${pad2(day)}`;
}

export function dueDateForMonth(referenceMonth: string, dueDay: number): string {
  const { year, month } = parseISOMonth(referenceMonth);
  const maxDay = daysInMonth(year, month);
  const day = Math.min(Math.max(1, dueDay), maxDay);
  return `${referenceMonth}-${pad2(day)}`;
}

export function referenceMonthForPurchase(purchaseDate: string, closingDay: number): string {
  const currentMonth = purchaseDate.slice(0, 7);
  const closing = closingDateForMonth(currentMonth, closingDay);
  if (purchaseDate <= closing) return currentMonth;
  const { year, month } = parseISOMonth(currentMonth);
  const next = addMonths(year, month, 1);
  return formatISOMonth(next.year, next.month);
}

export function isPurchaseInInvoice(
  purchaseDate: string,
  referenceMonth: string,
  closingDay: number,
): boolean {
  return referenceMonthForPurchase(purchaseDate, closingDay) === referenceMonth;
}

export type InvoiceStatusValue = "aberta" | "fechada" | "paga" | "vencida";

export function resolveInvoiceStatus(input: {
  current: InvoiceStatusValue;
  closingDate: string;
  dueDate: string;
  today: string;
  paidCents: number;
  totalCents: number;
  closedAt?: string | null;
  paidAt?: string | null;
}): InvoiceStatusValue {
  if (input.paidAt || (input.totalCents > 0 && input.paidCents >= input.totalCents)) {
    return "paga";
  }
  if (input.dueDate < input.today) return "vencida";
  if (input.closedAt || input.today >= input.closingDate) return "fechada";
  return "aberta";
}

/**
 * Aplica um pagamento (total ou parcial) à fatura: acumula em `paid_cents`,
 * mantém o `total_cents` intacto e só marca "paga" quando quitar tudo.
 */
export function applyInvoicePayment(
  invoice: {
    total_cents: number;
    paid_cents: number;
    status: InvoiceStatusValue;
    paid_at?: string | null;
  },
  cents: number,
  paidAtISO: string,
): { paid_cents: number; status: InvoiceStatusValue; paid_at: string | null } {
  const paid = (invoice.paid_cents ?? 0) + cents;
  const fullyPaid = paid >= invoice.total_cents;
  return {
    paid_cents: paid,
    status: fullyPaid ? "paga" : invoice.status,
    paid_at: fullyPaid ? invoice.paid_at || paidAtISO : invoice.paid_at ?? null,
  };
}
