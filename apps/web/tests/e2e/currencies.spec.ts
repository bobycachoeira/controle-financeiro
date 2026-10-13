import { test, expect } from "./fixtures";

test.describe("moedas e cotações", () => {
  test("cadastra uma cotação", async ({ page, loginAs }) => {
    await loginAs("titular");
    await page.goto("/currencies");
    await expect(page.getByText("Moedas e cotações")).toBeVisible({ timeout: 15_000 });
    await page.locator("#rate-value").fill("5,20");
    await page.getByRole("button", { name: /Salvar cotação/i }).click();
    await expect(page.getByText("Cotação salva.")).toBeVisible({ timeout: 10_000 });
  });
});
