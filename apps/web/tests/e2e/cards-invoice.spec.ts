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

  test("mostra o cartão ao editar uma compra no cartão", async ({ page, loginAs }) => {
    await loginAs("titular");
    const stamp = Date.now();
    const bank = `BancoEdicao${stamp}`;
    const description = `Compra Cartão ${stamp}`;

    await page.goto("/cards");
    await expect(page.getByRole("heading", { name: "Cartões" })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /^Novo$/ }).click();
    await page.getByLabel("Nome").fill(`Cartão ${stamp}`);
    await page.getByLabel("Banco").fill(bank);
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByTestId("card").filter({ hasText: bank })).toBeVisible({ timeout: 15_000 });

    await page.goto("/transactions/new");
    await page.locator("#amount").fill("25,00");
    await page.locator("#description").fill(description);
    await page.locator("#category").click();
    await page.getByPlaceholder(/Filtrar categoria/).fill(`Categoria ${stamp}`);
    await page.getByRole("button", { name: /^Criar/ }).click();
    await page.locator("#card").selectOption({ label: `${bank} •••• 15/25` });
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText(description)).toBeVisible({ timeout: 10_000 });

    const row = page.locator("li", { hasText: description });
    await row.getByLabel("Editar lançamento").click();
    await expect(page.getByRole("heading", { name: "Editar lançamento" })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("#card")).toBeVisible();
    await expect(page.locator("#card")).toHaveValue(/.+/);
    await expect(page.locator("#card option:checked")).toHaveText(new RegExp(bank));
    await expect(page.locator("#account")).toBeDisabled();
  });
});
