import { test, expect } from "@playwright/test";

test.describe("contas a pagar e receber", () => {
  test("adiciona uma conta e lista", async ({ page }) => {
    await page.goto("/bills");
    await expect(page.getByText("Contas a pagar e receber")).toBeVisible();
    await expect(page.getByLabel("Título")).toBeVisible();
    await page.getByLabel("Título").fill("Internet");
    await page.getByLabel(/valor/i).fill("120,00");
    await page.getByRole("button", { name: /adicionar/i }).click();
    await expect(page.getByText("Internet")).toBeVisible();
  });
});
