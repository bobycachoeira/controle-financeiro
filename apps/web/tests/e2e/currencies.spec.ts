import { test, expect } from "@playwright/test";

test.describe("moedas e cotações", () => {
  test("cadastra uma cotação", async ({ page }) => {
    await page.goto("/currencies");
    await expect(page.getByText("Moedas e cotações")).toBeVisible();
    await page.getByLabel("Cotação para BRL").fill("5,20");
    await page.getByRole("button", { name: /salvar cotação/i }).click();
    await expect(page.getByText(/USD|R\$/)).toBeVisible();
  });
});
