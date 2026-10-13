import { test, expect } from "./fixtures";

test.describe("dashboard", () => {
  test("exibe os blocos principais", async ({ page, loginAs }) => {
    await loginAs("titular");
    await page.goto("/");
    for (const block of ["Saldo total", "Saldos por conta", "Gastos do mês", "Faturas abertas"]) {
      await expect(page.getByText(block).first()).toBeVisible({ timeout: 15_000 });
    }
  });
});
