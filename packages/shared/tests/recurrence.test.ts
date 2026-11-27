import { describe, expect, it } from "vitest";
import {
  fixedCostsForMonth,
  isValidRRule,
  nextOccurrence,
  occurrencesBetween,
  parseRRule,
} from "../src/domain/recurrence";

describe("rrule subset", () => {
  it("validates rules", () => {
    expect(isValidRRule("FREQ=MONTHLY;INTERVAL=1")).toBe(true);
    expect(isValidRRule("RRULE:FREQ=WEEKLY;BYDAY=MO")).toBe(true);
    expect(isValidRRule("INTERVAL=2")).toBe(false);
    expect(isValidRRule("FREQ=HOURLY")).toBe(false);
  });

  it("parses frequency, interval, count and until", () => {
    const parsed = parseRRule("FREQ=MONTHLY;INTERVAL=2;COUNT=3;UNTIL=20241231T000000Z");
    expect(parsed?.freq).toBe("MONTHLY");
    expect(parsed?.interval).toBe(2);
    expect(parsed?.count).toBe(3);
    expect(parsed?.until).toBe("2024-12-31");
  });

  it("generates monthly occurrences strictly after the cursor", () => {
    const occurrences = occurrencesBetween(
      "FREQ=MONTHLY;INTERVAL=1",
      "2024-01-10",
      "2024-02-01",
      "2024-04-30",
    );
    expect(occurrences).toEqual(["2024-02-10", "2024-03-10", "2024-04-10"]);
  });

  it("clamps day 31 to the last day of shorter months", () => {
    const occurrences = occurrencesBetween(
      "FREQ=MONTHLY;INTERVAL=1",
      "2024-01-31",
      "2024-01-01",
      "2024-04-30",
    );
    expect(occurrences).toEqual(["2024-01-31", "2024-02-29", "2024-03-31", "2024-04-30"]);
  });

  it("respects COUNT", () => {
    const occurrences = occurrencesBetween(
      "FREQ=DAILY;COUNT=3",
      "2024-03-01",
      "2024-02-28",
      "2024-03-31",
    );
    expect(occurrences).toEqual(["2024-03-01", "2024-03-02", "2024-03-03"]);
  });

  it("respects UNTIL", () => {
    const occurrences = occurrencesBetween(
      "FREQ=DAILY;UNTIL=20240303T000000Z",
      "2024-03-01",
      "2024-02-28",
      "2024-03-31",
    );
    expect(occurrences).toEqual(["2024-03-01", "2024-03-02", "2024-03-03"]);
  });

  it("computes the next occurrence", () => {
    expect(nextOccurrence("FREQ=WEEKLY;INTERVAL=1", "2024-03-01", "2024-03-05")).toBe("2024-03-08");
  });
});

describe("fixedCostsForMonth", () => {
  const base = {
    id: "r1",
    name: "Aluguel",
    rrule: "FREQ=MONTHLY;INTERVAL=1",
    start_date: "2026-01-05",
    active: true,
    target: "bill" as const,
    template: {
      amount_cents: 100000,
      nature: "saida" as const,
      due_day: 10,
    },
  };

  it("prevê a conta do mês quando ainda não foi gerada", () => {
    const items = fixedCostsForMonth({
      recurrences: [base],
      bills: [],
      transactions: [],
      month: "2026-11",
    });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      name: "Aluguel",
      occurrence: "2026-11-05",
      dueDate: "2026-11-10",
      amountCents: 100000,
      nature: "saida",
      status: "previsto",
    });
  });

  it("usa o valor e o status da conta já gerada", () => {
    const items = fixedCostsForMonth({
      recurrences: [base],
      bills: [
        {
          id: "b1",
          recurrence: "r1",
          emission_date: "2026-11-05",
          due_date: "2026-11-10",
          amount_cents: 120000,
          nature: "saida",
          status: "pendente",
        },
      ],
      transactions: [],
      month: "2026-11",
    });
    expect(items[0]).toMatchObject({ amountCents: 120000, status: "pendente" });
  });

  it("não conta conta cancelada no mês", () => {
    const items = fixedCostsForMonth({
      recurrences: [base],
      bills: [
        {
          id: "b1",
          recurrence: "r1",
          emission_date: "2026-11-05",
          due_date: "2026-11-10",
          amount_cents: 120000,
          nature: "saida",
          status: "cancelado",
        },
      ],
      transactions: [],
      month: "2026-11",
    });
    expect(items).toEqual([]);
  });

  it("usa o lançamento gerado quando a recorrência é de lançamento", () => {
    const items = fixedCostsForMonth({
      recurrences: [
        {
          ...base,
          target: "transaction",
          template: { amount_cents: 5000, type: "despesa", account: "a1" },
        },
      ],
      bills: [],
      transactions: [
        {
          id: "t1",
          recurrence: "r1",
          date: "2026-11-05",
          amount_cents: 5500,
          type: "despesa",
          status: "a_pagar",
        },
      ],
      month: "2026-11",
    });
    expect(items[0]).toMatchObject({
      amountCents: 5500,
      status: "pendente",
      dueDate: null,
      target: "transaction",
    });
  });

  it("projeta o próximo mês a partir da recorrência", () => {
    const items = fixedCostsForMonth({
      recurrences: [base],
      bills: [],
      transactions: [],
      month: "2026-12",
    });
    expect(items[0]).toMatchObject({ occurrence: "2026-12-05", dueDate: "2026-12-10" });
  });
});
