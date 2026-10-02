import { test, expect } from "@playwright/test";

test.describe("cartões de crédito", () => {
  test("cria um cartão com fechamento e vencimento", async ({ page }) => {
    await page.goto("/cards");
    await expect(page.getByText("Cartões de crédito")).toBeVisible();
    await page.getByRole("button", { name: /novo cartão/i }).click();
    await page.getByLabel("Nome").fill("Cartão Teste");
    await page.getByRole("button", { name: /^criar$/i }).click();
    await expect(page.getByText(/fecha dia/i)).toBeVisible();
  });
});
