import { test, expect } from "./fixtures";

test.describe("importação de extrato", () => {
  test("faz a prévia de um CSV", async ({ page, loginAs }) => {
    await loginAs("titular");
    await page.goto("/import");
    await expect(page.getByText("Importar extrato")).toBeVisible({ timeout: 15_000 });
    await page
      .locator("#import-text")
      .fill("data;valor;descricao\n01/03/2024;-10,50;Mercado\n05/03/2024;1.500,00;Salario");
    await page.getByRole("button", { name: /Pré-visualizar/i }).click();
    await expect(page.getByText("Prévia")).toBeVisible();
    await expect(page.getByText("Mercado")).toBeVisible();
  });
});
