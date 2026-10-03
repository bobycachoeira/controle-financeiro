import { addMonths, clampDay, pad2, parseISODate, toISODate } from "./dates";

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
    const { year, month } = addMonths(start.getUTCFullYear(), start.getUTCMonth() + 1, index * parsed.interval);
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
