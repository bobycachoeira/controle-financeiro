export const BUSINESS_TZ = "America/Sao_Paulo";
export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
export const ISO_MONTH = /^\d{4}-\d{2}$/;

export function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function clampDay(year: number, month: number, day: number): number {
  const max = daysInMonth(year, month);
  return Math.min(Math.max(1, day), max);
}

export function toISODate(date: Date): string {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

export function parseISODate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1));
}

export function isISODate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const date = parseISODate(value);
  return toISODate(date) === value;
}

export function parseISOMonth(value: string): { year: number; month: number } {
  const [year, month] = value.split("-").map(Number);
  return { year: year ?? 0, month: month ?? 1 };
}

export function formatISOMonth(year: number, month: number): string {
  return `${year}-${pad2(month)}`;
}

export function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const zeroBased = month - 1 + delta;
  const newYear = year + Math.floor(zeroBased / 12);
  const newMonth = ((zeroBased % 12) + 12) % 12;
  return { year: newYear, month: newMonth + 1 };
}

export function diffInDays(fromISO: string, toISO: string): number {
  const from = parseISODate(fromISO).getTime();
  const to = parseISODate(toISO).getTime();
  return Math.round((to - from) / 86_400_000);
}

export function addDays(iso: string, days: number): string {
  const date = parseISODate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return toISODate(date);
}

export function compareISODate(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function todayISO(tz = BUSINESS_TZ, now: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(now);
}

export function monthRange(monthISO: string): { start: string; end: string } {
  const { year, month } = parseISOMonth(monthISO);
  const last = daysInMonth(year, month);
  return { start: `${monthISO}-01`, end: `${monthISO}-${pad2(last)}` };
}

export function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}
