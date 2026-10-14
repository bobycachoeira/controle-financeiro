import { daysInMonth, pad2, parseISOMonth } from "@cf/shared";

export interface CalendarDay {
  date: string;
  inMonth: boolean;
}

function isoFromDay(year: number, month1based: number, day: number): string {
  return new Date(Date.UTC(year, month1based - 1, day)).toISOString().slice(0, 10);
}

/** Semanas do mês (domingo a sábado), com dias vizinhos para completar. */
export function buildMonthGrid(month: string): CalendarDay[][] {
  const { year, month: monthNumber } = parseISOMonth(month);
  const total = daysInMonth(year, monthNumber);
  const firstWeekday = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay();
  const weeks: CalendarDay[][] = [];
  let current: CalendarDay[] = [];

  for (let index = 0; index < firstWeekday; index += 1) {
    current.push({ date: isoFromDay(year, monthNumber, index - firstWeekday + 1), inMonth: false });
  }
  for (let day = 1; day <= total; day += 1) {
    current.push({ date: `${month}-${pad2(day)}`, inMonth: true });
    if (current.length === 7) {
      weeks.push(current);
      current = [];
    }
  }
  let nextDay = 1;
  while (current.length > 0 && current.length < 7) {
    current.push({ date: isoFromDay(year, monthNumber + 1, nextDay), inMonth: false });
    nextDay += 1;
  }
  if (current.length > 0) weeks.push(current);
  return weeks;
}

export function previousMonth(month: string): string {
  const { year, month: monthNumber } = parseISOMonth(month);
  return isoFromDay(year, monthNumber, 0).slice(0, 7);
}

export function nextMonth(month: string): string {
  const { year, month: monthNumber } = parseISOMonth(month);
  return isoFromDay(year, monthNumber + 1, 1).slice(0, 7);
}
