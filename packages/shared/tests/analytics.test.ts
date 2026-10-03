import { describe, expect, it } from "vitest";
import {
  balanceEvolution,
  monthlyCashflow,
  spendingByCategory,
  type AnalyticsTransaction,
} from "../src/domain/analytics";

const tx = (partial: Partial<AnalyticsTransaction> & { date: string; amount_cents: number }): AnalyticsTransaction => ({
  type: "despesa",
  status: "pago",
  deleted_at: null,
  ...partial,
});

const transactions: AnalyticsTransaction[] = [
  tx({ date: "2024-01-10", amount_cents: 10000, type: "receita" }),
  tx({ date: "2024-01-15", amount_cents: 4000 }),
  tx({ date: "2024-02-05", amount_cents: 5000, type: "receita" }),
  tx({ date: "2024-02-20", amount_cents: 3000, category: "food" }),
  tx({ date: "2024-03-01", amount_cents: 2000, category: "food" }),
  tx({ date: "2024-03-02", amount_cents: 9999, status: "a_pagar" }),
  tx({ date: "2024-03-03", amount_cents: 8888, deleted_at: "x" }),
];

describe("monthlyCashflow", () => {
  it("aggregates receitas/despesas per month", () => {
    const series = monthlyCashflow(transactions, "2024-03", 3);
    expect(series.map((item) => item.month)).toEqual(["2024-01", "2024-02", "2024-03"]);
    expect(series[0]).toMatchObject({ receitasCents: 10000, despesasCents: 4000, netCents: 6000 });
    expect(series[2]).toMatchObject({ receitasCents: 0, despesasCents: 11999 });
  });
});

describe("balanceEvolution", () => {
  it("computes cumulative balance including paid only", () => {
    const series = balanceEvolution(
      [{ id: "a1", initial_balance_cents: 1000 }],
      transactions,
      "2024-03",
      3,
    );
    expect(series[0]?.balanceCents).toBe(1000 + 6000);
    expect(series[1]?.balanceCents).toBe(1000 + 6000 + 2000);
    expect(series[2]?.balanceCents).toBe(1000 + 6000 + 2000 - 2000);
  });
});

describe("spendingByCategory", () => {
  it("ranks categories for the month", () => {
    const result = spendingByCategory(
      transactions,
      [{ id: "food", name: "Alimentação", color: "#f97316" }],
      "2024-02",
    );
    expect(result[0]).toMatchObject({ categoryId: "food", name: "Alimentação", totalCents: 3000 });
  });

  it("groups categorized-less spending", () => {
    const result = spendingByCategory(transactions, [], "2024-01");
    expect(result[0]).toMatchObject({ categoryId: null, name: "Sem categoria", totalCents: 4000 });
  });
});
