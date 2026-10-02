import { test, expect } from "@playwright/test";

test.describe("dashboard", () => {
  test("exibe os blocos principais", async ({ page }) => {
    await page.goto("/");
    for (const block of [
      "Saldo total",
      "Saldos por conta",
      "Gastos do mês",
      "Vencimentos próximos",
      "Faturas abertas",
      "Lançamentos recentes",
    ]) {
      await expect(page.getByText(block)).toBeVisible();
    }
  });
});
