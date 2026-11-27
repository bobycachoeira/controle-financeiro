import {
  addMonths,
  clampDay,
  daysInMonth,
  pad2,
  parseISODate,
  parseISOMonth,
  toISODate,
} from "./dates";
import { billDueDate } from "./bills";

export type RecurrenceFrequency = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

export interface ParsedRRule {
  freq: RecurrenceFrequency;
  interval: number;
  count?: number;
  until?: string;
  byMonthDay?: number;
  byDay?: string[];
}

const FREQUENCIES: RecurrenceFrequency[] = ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"];

export function parseRRule(rrule: string): ParsedRRule | null {
  if (!rrule) return null;
  const parts = rrule.replace(/^RRULE:/i, "").split(";");
  const map: Record<string, string> = {};
  for (const part of parts) {
    const [key, value] = part.split("=");
    if (key && value) map[key.toUpperCase()] = value.toUpperCase();
  }
  const freq = map.FREQ as RecurrenceFrequency;
  if (!freq || !FREQUENCIES.includes(freq)) return null;
  const interval = map.INTERVAL ? Number(map.INTERVAL) : 1;
  if (!Number.isInteger(interval) || interval < 1) return null;
  const result: ParsedRRule = { freq, interval };
  if (map.COUNT) {
    const count = Number(map.COUNT);
    if (!Number.isInteger(count) || count < 1) return null;
    result.count = count;
  }
  if (map.UNTIL) {
    const until = map.UNTIL.slice(0, 8);
    if (!/^\d{8}$/.test(until)) return null;
    result.until = `${until.slice(0, 4)}-${until.slice(4, 6)}-${until.slice(6, 8)}`;
  }
  if (map.BYMONTHDAY) {
    const day = Number(map.BYMONTHDAY);
    if (!Number.isInteger(day) || day < 1 || day > 31) return null;
    result.byMonthDay = day;
  }
  if (map.BYDAY) {
    result.byDay = map.BYDAY.split(",");
  }
  return result;
}

export function isValidRRule(rrule: string): boolean {
  return parseRRule(rrule) !== null;
}

function buildOccurrence(parsed: ParsedRRule, dtstart: string, index: number): string {
  const start = parseISODate(dtstart);
  if (parsed.freq === "DAILY") {
    const date = new Date(start.getTime());
    date.setUTCDate(date.getUTCDate() + index * parsed.interval);
    return toISODate(date);
  }
  if (parsed.freq === "WEEKLY") {
    const date = new Date(start.getTime());
    date.setUTCDate(date.getUTCDate() + index * parsed.interval * 7);
    return toISODate(date);
  }
  if (parsed.freq === "MONTHLY") {
    const { year, month } = addMonths(
      start.getUTCFullYear(),
      start.getUTCMonth() + 1,
      index * parsed.interval,
    );
    const day = parsed.byMonthDay ?? start.getUTCDate();
    return `${year}-${pad2(month)}-${pad2(clampDay(year, month, day))}`;
  }
  const year = start.getUTCFullYear() + index * parsed.interval;
  const month = start.getUTCMonth() + 1;
  const day = parsed.byMonthDay ?? start.getUTCDate();
  return `${year}-${pad2(month)}-${pad2(clampDay(year, month, day))}`;
}

const MAX_ITERATIONS = 1000;

export function occurrencesBetween(
  rrule: string,
  dtstart: string,
  afterISO: string,
  untilISO: string,
): string[] {
  const parsed = parseRRule(rrule);
  if (!parsed) return [];
  const occurrences: string[] = [];
  for (let index = 0; index < MAX_ITERATIONS; index += 1) {
    if (parsed.count !== undefined && index >= parsed.count) break;
    const occurrence = buildOccurrence(parsed, dtstart, index);
    if (parsed.until && occurrence > parsed.until) break;
    if (occurrence > untilISO) break;
    if (occurrence > afterISO) occurrences.push(occurrence);
  }
  return occurrences;
}

export function nextOccurrence(rrule: string, dtstart: string, fromISO: string): string | null {
  const parsed = parseRRule(rrule);
  if (!parsed) return null;
  for (let index = 0; index < MAX_ITERATIONS; index += 1) {
    if (parsed.count !== undefined && index >= parsed.count) return null;
    const occurrence = buildOccurrence(parsed, dtstart, index);
    if (parsed.until && occurrence > parsed.until) return null;
    if (occurrence > fromISO) return occurrence;
  }
  return null;
}

export interface FixedCostRecurrence {
  id: string;
  name: string;
  rrule: string;
  start_date: string;
  end_date?: string | null;
  count?: number | null;
  active?: boolean;
  deleted_at?: string | null;
  target: "transaction" | "bill";
  template: {
    amount_cents: number;
    default_amount_cents?: number | null;
    nature?: "entrada" | "saida" | null;
    type?: "receita" | "despesa" | "transferencia";
    due_day?: number | null;
    account?: string | null;
  };
}

export interface FixedCostBill {
  id: string;
  recurrence?: string | null;
  emission_date?: string | null;
  due_date: string;
  amount_cents: number;
  nature: "entrada" | "saida";
  status: "a_confirmar" | "pendente" | "pago" | "cancelado";
  deleted_at?: string | null;
}

export interface FixedCostTransaction {
  id: string;
  recurrence?: string | null;
  date: string;
  amount_cents: number;
  type: "receita" | "despesa" | "transferencia";
  status: "pago" | "a_pagar";
  deleted_at?: string | null;
}

export interface FixedCostItem {
  key: string;
  recurrenceId: string;
  name: string;
  occurrence: string;
  dueDate: string | null;
  amountCents: number;
  nature: "entrada" | "saida";
  target: "transaction" | "bill";
  status: "pago" | "pendente" | "a_confirmar" | "previsto";
}

export interface FixedCostsInput {
  recurrences: readonly FixedCostRecurrence[];
  bills: readonly FixedCostBill[];
  transactions: readonly FixedCostTransaction[];
  month: string;
}

/**
 * Custos/receitas fixos previstos para um mês, a partir das recorrências.
 * Usa a conta/transação já gerada quando existe (valor e status reais) e o
 * template da recorrência como previsão quando ainda não foi gerada.
 */
export function fixedCostsForMonth(input: FixedCostsInput): FixedCostItem[] {
  const { year, month: monthNumber } = parseISOMonth(input.month);
  const start = `${input.month}-01`;
  const end = `${input.month}-${pad2(daysInMonth(year, monthNumber))}`;
  const before = parseISODate(start);
  before.setUTCDate(before.getUTCDate() - 1);
  const after = toISODate(before);

  const items: FixedCostItem[] = [];
  for (const recurrence of input.recurrences) {
    if (recurrence.deleted_at || recurrence.active === false) continue;
    const dtstart = recurrence.start_date.slice(0, 10);
    const occurrences = occurrencesBetween(recurrence.rrule, dtstart, after, end);
    for (const occurrence of occurrences) {
      if (occurrence < start || occurrence > end) continue;
      if (recurrence.target === "bill") {
        const bill = input.bills.find(
          (item) =>
            item.recurrence === recurrence.id &&
            !item.deleted_at &&
            (item.emission_date ?? "").slice(0, 10) === occurrence,
        );
        if (bill) {
          if (bill.status === "cancelado") continue;
          items.push({
            key: `${recurrence.id}:${occurrence}`,
            recurrenceId: recurrence.id,
            name: recurrence.name,
            occurrence,
            dueDate: bill.due_date.slice(0, 10),
            amountCents: bill.amount_cents,
            nature: bill.nature,
            target: "bill",
            status:
              bill.status === "pago"
                ? "pago"
                : bill.status === "a_confirmar"
                  ? "a_confirmar"
                  : "pendente",
          });
          continue;
        }
        items.push({
          key: `${recurrence.id}:${occurrence}`,
          recurrenceId: recurrence.id,
          name: recurrence.name,
          occurrence,
          dueDate: billDueDate(
            occurrence,
            recurrence.template.due_day ?? Number(occurrence.slice(8, 10)),
          ),
          amountCents:
            recurrence.template.default_amount_cents ?? recurrence.template.amount_cents ?? 0,
          nature: recurrence.template.nature ?? "saida",
          target: "bill",
          status: "previsto",
        });
        continue;
      }

      const tx = input.transactions.find(
        (item) =>
          item.recurrence === recurrence.id &&
          !item.deleted_at &&
          item.date.slice(0, 10) === occurrence,
      );
      if (tx) {
        items.push({
          key: `${recurrence.id}:${occurrence}`,
          recurrenceId: recurrence.id,
          name: recurrence.name,
          occurrence,
          dueDate: null,
          amountCents: tx.amount_cents,
          nature: tx.type === "receita" ? "entrada" : "saida",
          target: "transaction",
          status: tx.status === "pago" ? "pago" : "pendente",
        });
        continue;
      }
      items.push({
        key: `${recurrence.id}:${occurrence}`,
        recurrenceId: recurrence.id,
        name: recurrence.name,
        occurrence,
        dueDate: null,
        amountCents: recurrence.template.amount_cents ?? 0,
        nature: recurrence.template.type === "receita" ? "entrada" : "saida",
        target: "transaction",
        status: "previsto",
      });
    }
  }
  return items.sort((a, b) => {
    const left = a.dueDate ?? a.occurrence;
    const right = b.dueDate ?? b.occurrence;
    return left === right ? a.name.localeCompare(b.name) : left < right ? -1 : 1;
  });
}
