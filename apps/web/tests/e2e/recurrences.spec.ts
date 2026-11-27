import { test, expect } from "./fixtures";

test.describe("recorrências", () => {
  test("cria uma conta recorrente (a pagar)", async ({ page, loginAs }) => {
    await loginAs("titular");
    await page.goto("/recurrences");
    await expect(page.getByRole("heading", { name: "Recorrências", exact: true })).toBeVisible({
      timeout: 15_000,
    });
    const name = `Aluguel E2E ${Date.now()}`;
    await page.locator("#rec-name").fill(name);
    await page.locator("#rec-amount").fill("1000,00");
    await page.getByRole("button", { name: /Criar recorrência/i }).click();
    await expect(page.getByTestId("recurrence-row").filter({ hasText: name })).toBeVisible({
      timeout: 10_000,
    });

    const pageFixed = page.getByTestId("fixed-costs");
    await expect(pageFixed).toContainText(name, { timeout: 15_000 });
    await expect(pageFixed).toContainText("R$ 1.000,00");

    await page.goto("/");
    const fixed = page.getByTestId("fixed-costs");
    await expect(fixed).toContainText(name, { timeout: 15_000 });
    await expect(fixed).toContainText("R$ 1.000,00");
    await fixed.getByRole("button", { name: "Próximo mês" }).click();
    await expect(fixed).toContainText(name);
  });
});
