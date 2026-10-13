import { test, expect } from "./fixtures";

test.describe("cartões de crédito", () => {
  test("cria um cartão com fechamento e vencimento", async ({ page, loginAs }) => {
    await loginAs("titular");
    await page.goto("/cards");
    await expect(page.getByRole("heading", { name: "Cartões" })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /^Novo$/ }).click();
    await page.getByLabel("Nome").fill(`Cartão Teste ${Date.now()}`);
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText(/Limite/).first()).toBeVisible({ timeout: 10_000 });
  });
});
