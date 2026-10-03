import { test, expect } from "@playwright/test";

test.describe("importação de extrato", () => {
  test("faz a prévia de um CSV", async ({ page }) => {
    await page.goto("/import");
    await expect(page.getByText("Importar extrato")).toBeVisible();
    await page
      .getByLabel("Ou cole o conteúdo")
      .fill("data;valor;descrição\n01/03/2024;-10,50;Mercado\n05/03/2024;1.500,00;Salário");
    await page.getByRole("button", { name: /pré-visualizar/i }).click();
    await expect(page.getByText("Prévia")).toBeVisible();
    await expect(page.getByText("Mercado")).toBeVisible();
  });
});
