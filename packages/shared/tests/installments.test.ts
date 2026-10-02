import { describe, expect, it } from "vitest";
import { generateInstallments, sumInstallments } from "../src/domain/installments";

describe("installments", () => {
  it("distributes one installment per cycle and sums to the purchase total", () => {
    const installments = generateInstallments("2024-03-20", 100000, 3, 15);
    expect(installments).toHaveLength(3);
    expect(sumInstallments(installments)).toBe(100000);
    expect(installments.map((item) => item.reference_month)).toEqual([
      "2024-04",
      "2024-05",
      "2024-06",
    ]);
  });

  it("puts the rounding remainder on the last installment", () => {
    const installments = generateInstallments("2024-03-10", 1000, 3, 15);
    expect(installments.map((item) => item.amount_cents)).toEqual([333, 333, 334]);
    expect(sumInstallments(installments)).toBe(1000);
  });

  it("clamps installment dates for shorter months", () => {
    const installments = generateInstallments("2024-01-31", 3000, 3, 20);
    expect(installments.map((item) => item.expected_date)).toEqual([
      "2024-01-31",
      "2024-02-29",
      "2024-03-31",
    ]);
  });

  it("returns an empty list for invalid counts", () => {
    expect(generateInstallments("2024-01-01", 1000, 0, 10)).toEqual([]);
  });
});
