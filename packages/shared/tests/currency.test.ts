import { describe, expect, it } from "vitest";
import { consolidateToBRL, convertCents, pickRate } from "../src/domain/currency";

describe("currency", () => {
  it("converts using micros without float drift", () => {
    expect(convertCents(1000, 5_200_000)).toBe(5200);
    expect(convertCents(333, 5_200_000)).toBe(1732);
  });

  it("picks the latest rate on or before the date", () => {
    const rates = [
      { currency: "USD", date: "2024-01-01", rate_micros: 5_000_000 },
      { currency: "USD", date: "2024-03-01", rate_micros: 5_200_000 },
    ];
    expect(pickRate(rates, "USD", "2024-03-10")).toBe(5_200_000);
    expect(pickRate(rates, "USD", "2024-02-15")).toBe(5_000_000);
    expect(pickRate(rates, "USD", "2023-12-31")).toBeNull();
    expect(pickRate(rates, "BRL", "2024-03-10")).toBe(1_000_000);
  });

  it("consolidates to BRL and reports missing rates", () => {
    const result = consolidateToBRL(
      [
        { amountCents: 10000, currency: "BRL", date: "2024-03-10" },
        { amountCents: 1000, currency: "USD", date: "2024-03-10" },
        { amountCents: 2000, currency: "EUR", date: "2024-03-10" },
      ],
      [{ currency: "USD", date: "2024-03-01", rate_micros: 5_200_000 }],
    );
    expect(result.totalCents).toBe(10000 + 5200);
    expect(result.missing).toEqual(["EUR"]);
  });
});
