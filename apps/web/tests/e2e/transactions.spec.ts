import { test, expect } from "@playwright/test";

test.describe("lançamentos", () => {
  test("abre o formulário de novo lançamento", async ({ page }) => {
    await page.goto("/transactions/new");
    await expect(page.getByText("Novo lançamento")).toBeVisible();
    await expect(page.getByLabel(/valor/i)).toBeVisible();
  });

  test("lista lançamentos com filtros", async ({ page }) => {
    await page.goto("/transactions");
    await expect(page.getByText("Lançamentos")).toBeVisible();
    await expect(page.getByLabel("Mês")).toBeVisible();
  });
});
