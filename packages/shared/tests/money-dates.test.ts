import { describe, expect, it } from "vitest";
import {
  clampDay,
  daysInMonth,
  addMonths,
  diffInDays,
  isLeapYear,
  monthRange,
} from "../src/domain/dates";
import {
  formatBRL,
  fromCents,
  parseAmountToCents,
  splitCents,
  sumCents,
  toCents,
} from "../src/domain/money";

describe("money", () => {
  it("converts reais to cents without floating point drift", () => {
    expect(toCents(10.1)).toBe(1010);
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(fromCents(1010)).toBe(10.1);
  });

  it("formats BRL in pt-BR", () => {
    const formatted = formatBRL(123456);
    expect(formatted).toContain("1.234,56");
    expect(formatted).toContain("R$");
  });

  it("parses pt-BR currency input", () => {
    expect(parseAmountToCents("R$ 1.234,56")).toBe(123456);
    expect(parseAmountToCents("10,50")).toBe(1050);
    expect(parseAmountToCents("abc")).toBeNull();
  });

  it("splits cents keeping the remainder in the last installment", () => {
    const parts = splitCents(1000, 3);
    expect(sumCents(parts)).toBe(1000);
    expect(parts).toEqual([333, 333, 334]);
  });
});

describe("dates and month boundaries", () => {
  it("knows leap years", () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2023)).toBe(false);
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2000)).toBe(true);
  });

  it("clamps day to the month length", () => {
    expect(clampDay(2023, 2, 31)).toBe(28);
    expect(clampDay(2024, 2, 31)).toBe(29);
    expect(clampDay(2024, 4, 31)).toBe(30);
    expect(clampDay(2024, 1, 31)).toBe(31);
  });

  it("returns the correct days in month", () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2023, 2)).toBe(28);
    expect(daysInMonth(2024, 12)).toBe(31);
  });

  it("adds months across year boundaries", () => {
    expect(addMonths(2024, 12, 1)).toEqual({ year: 2025, month: 1 });
    expect(addMonths(2024, 1, -1)).toEqual({ year: 2023, month: 12 });
    expect(addMonths(2024, 1, 13)).toEqual({ year: 2025, month: 2 });
  });

  it("computes day differences and month ranges", () => {
    expect(diffInDays("2024-01-01", "2024-01-31")).toBe(30);
    expect(monthRange("2024-02")).toEqual({ start: "2024-02-01", end: "2024-02-29" });
  });
});
