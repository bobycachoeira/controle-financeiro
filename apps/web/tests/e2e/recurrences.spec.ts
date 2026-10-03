import { test, expect } from "@playwright/test";

test.describe("recorrências", () => {
  test("cria uma recorrência mensal", async ({ page }) => {
    await page.goto("/recurrences");
    await expect(page.getByText("Recorrências")).toBeVisible();
    await page.getByLabel("Nome").fill("Aluguel");
    await page.getByLabel(/valor/i).fill("1000,00");
    await page.getByRole("button", { name: /criar recorrência/i }).click();
    await expect(page.getByText("Aluguel")).toBeVisible();
  });
});
