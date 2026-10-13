import { test, expect } from "./fixtures";

test.describe("Cartão → fatura → pagamento", () => {
  test("gera a fatura do mês (mesmo 0) e paga informando o valor", async ({ page, loginAs }) => {
    await loginAs("titular");
    const stamp = Date.now();
    const bank = `BancoE2E${stamp}`;

    await page.goto("/cards");
    await expect(page.getByRole("heading", { name: "Cartões" })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /^Novo$/ }).click();
    await page.getByLabel("Nome").fill(`Cartão ${stamp}`);
    await page.getByLabel("Banco").fill(bank);
    await page.getByRole("button", { name: "Salvar" }).click();

    const card = page.getByTestId("card").filter({ hasText: bank });
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(card.getByText(/Fecha .* Vence/)).toBeVisible({ timeout: 15_000 });

    await card.getByTestId("invoice-pay").click();
    await page.locator("#pay-amount").fill("150,00");
    await page.locator("#pay-account").selectOption({ label: "Conta Principal" });
    const payForm = page.locator("form", { has: page.locator("#pay-amount") });
    await payForm.getByRole("button", { name: /Confirmar pagamento/i }).click();

    await expect(page.getByText(/Fatura paga/i)).toBeVisible({ timeout: 10_000 });
    await expect(card.getByText("paga")).toBeVisible({ timeout: 10_000 });
  });
});
