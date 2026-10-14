import { describe, expect, it } from "vitest";
import { buildMonthGrid, nextMonth, previousMonth } from "@/features/calendar/calendar";

describe("calendário", () => {
  it("monta semanas completas de domingo a sábado", () => {
    const grid = buildMonthGrid("2026-10");
    expect(grid.every((week) => week.length === 7)).toBe(true);
    expect(new Date(`${grid[0]![0]!.date}T00:00:00Z`).getUTCDay()).toBe(0);
  });

  it("inclui todos os dias do mês em ordem", () => {
    const grid = buildMonthGrid("2026-10");
    const daysInMonth = grid
      .flat()
      .filter((day) => day.inMonth)
      .map((day) => Number(day.date.slice(8)));
    expect(daysInMonth).toEqual(Array.from({ length: 31 }, (_, index) => index + 1));
  });

  it("mantém as datas contíguas (sem buracos)", () => {
    const flat = buildMonthGrid("2024-02").flat();
    for (let index = 1; index < flat.length; index += 1) {
      const previous = new Date(`${flat[index - 1]!.date}T00:00:00Z`).getTime();
      const current = new Date(`${flat[index]!.date}T00:00:00Z`).getTime();
      expect(current - previous).toBe(86_400_000);
    }
  });

  it("navega entre meses, inclusive virando o ano", () => {
    expect(previousMonth("2026-01")).toBe("2025-12");
    expect(nextMonth("2026-12")).toBe("2027-01");
    expect(previousMonth("2026-10")).toBe("2026-09");
  });
});
