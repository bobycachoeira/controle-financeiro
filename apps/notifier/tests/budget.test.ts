import { describe, expect, it } from "vitest";
import { budgetAlertKey, highestBudgetThreshold } from "../src/budget.js";
import { buildBudgetAlertPayload } from "../src/sender.js";

describe("alertas de orçamento", () => {
  it("devolve o maior limiar cruzado", () => {
    expect(highestBudgetThreshold(50)).toBeNull();
    expect(highestBudgetThreshold(70)).toBe(70);
    expect(highestBudgetThreshold(85)).toBe(70);
    expect(highestBudgetThreshold(90)).toBe(90);
    expect(highestBudgetThreshold(130)).toBe(100);
  });

  it("monta a chave idempotente por limiar e período", () => {
    expect(budgetAlertKey("b1", 90, "2026-10")).toBe("b1-90-2026-10");
  });

  it("monta o payload com nome, limiar e valores", () => {
    const payload = JSON.parse(
      buildBudgetAlertPayload({
        name: "Alimentação",
        threshold: 90,
        spentCents: 90000,
        totalCents: 100000,
        budgetId: "b1",
      }),
    ) as { title: string; body: string };
    expect(payload.title).toBe("Alimentação: 90% do orçamento");
    expect(payload.body).toContain("900,00");
    expect(payload.body).toContain("1.000,00");
  });
});
