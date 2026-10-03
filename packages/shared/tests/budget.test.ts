import { describe, expect, it } from "vitest";
import { budgetPeriodRange, computeBudgetUsage, type BudgetLike } from "../src/domain/budget";

const budget: BudgetLike = {
  id: "b1",
  total_cents: 100000,
  alert_pct: 80,
  period: "mensal",
  reference_month: "2024-03",
  categories: [{ category: "food" }, { category: "fun" }],
};

function expense(category: string, amount: number, date = "2024-03-10") {
  return { type: "despesa" as const, amount_cents: amount, category, date };
}

describe("budget", () => {
  it("computes period ranges", () => {
    expect(budgetPeriodRange("mensal", "2024-03")).toEqual({ start: "2024-03-01", end: "2024-03-31" });
    expect(budgetPeriodRange("trimestral", "2024-01")).toEqual({ start: "2024-01-01", end: "2024-03-31" });
    expect(budgetPeriodRange("anual", "2024-06")).toEqual({ start: "2024-06-01", end: "2025-05-31" });
  });

  it("sums spending for budgeted categories in the period", () => {
    const usage = computeBudgetUsage(budget, [
      expense("food", 30000),
      expense("fun", 20000),
      expense("other", 99999),
      expense("food", 50000, "2024-04-01"),
      { type: "receita", amount_cents: 5000, category: "food", date: "2024-03-10" },
      { type: "despesa", amount_cents: 1000, category: "food", date: "2024-03-10", deleted_at: "x" },
    ]);
    expect(usage.spentCents).toBe(50000);
    expect(usage.remainingCents).toBe(50000);
    expect(usage.percent).toBe(50);
    expect(usage.status).toBe("ok");
  });

  it("flags alerta and estouro", () => {
    expect(computeBudgetUsage(budget, [expense("food", 80000)]).status).toBe("alerta");
    expect(computeBudgetUsage(budget, [expense("food", 120000)]).status).toBe("estouro");
  });

  it("includes confirmed pending bills without double counting paid ones", () => {
    const usage = computeBudgetUsage(
      budget,
      [expense("food", 40000)],
      [
        {
          nature: "saida",
          status: "pendente",
          amount_cents: 20000,
          category: "food",
          due_date: "2024-03-20",
        },
        {
          nature: "saida",
          status: "pago",
          amount_cents: 99900,
          category: "food",
          due_date: "2024-03-21",
        },
      ],
    );
    expect(usage.spentCents).toBe(60000);
  });

  it("computes per-category breakdown", () => {
    const usage = computeBudgetUsage(budget, [expense("food", 40000), expense("fun", 10000)]);
    expect(usage.perCategory.find((c) => c.category === "food")?.spentCents).toBe(40000);
    expect(usage.perCategory.find((c) => c.category === "fun")?.spentCents).toBe(10000);
  });
});
