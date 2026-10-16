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

  test("troca o cartão de uma compra e move a fatura", async ({ page, loginAs }) => {
    await loginAs("titular");
    const stamp = Date.now();
    const bankA = `BancoA${stamp}`;
    const bankB = `BancoB${stamp}`;
    const description = `Compra ${stamp}`;

    for (const bank of [bankA, bankB]) {
      await page.goto("/wallet");
      await page.getByRole("button", { name: "Cartões" }).click();
      await page.getByRole("button", { name: /^Novo$/ }).click();
      await page.getByLabel("Nome").fill(`Cartão ${bank}`);
      await page.getByLabel("Banco").fill(bank);
      await page.getByRole("button", { name: "Salvar" }).click();
      await expect(page.getByTestId("card").filter({ hasText: bank })).toBeVisible({ timeout: 15_000 });
    }

    await page.goto("/transactions/new");
    await page.locator("#amount").fill("25,00");
    await page.locator("#description").fill(description);
    await page.locator("#category").click();
    await page.getByPlaceholder(/Filtrar categoria/).fill(`Categoria ${stamp}`);
    await page.getByRole("button", { name: /^Criar/ }).click();
    await page.locator("#card").selectOption({ label: `${bankA} •••• 15/25` });
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText(description)).toBeVisible({ timeout: 10_000 });

    await page.goto("/wallet");
    await page.getByRole("button", { name: "Cartões" }).click();
    const cardA = page.getByTestId("card").filter({ hasText: bankA });
    const cardB = page.getByTestId("card").filter({ hasText: bankB });
    await expect(cardA.getByText("R$ 25,00")).toBeVisible({ timeout: 15_000 });

    await page.goto("/transactions");
    const row = page.locator("li", { hasText: description });
    await row.getByLabel("Editar lançamento").click();
    await expect(page.getByRole("heading", { name: "Editar lançamento" })).toBeVisible({ timeout: 15_000 });
    await page.locator("#card").selectOption({ label: `${bankB} •••• 15/25` });
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByText(description)).toBeVisible({ timeout: 10_000 });

    await page.goto("/wallet");
    await page.getByRole("button", { name: "Cartões" }).click();
    await expect(cardB.getByText("R$ 25,00")).toBeVisible({ timeout: 15_000 });
    await expect(cardA.getByText("R$ 25,00")).toHaveCount(0);
  });

  test("lança parcelas em andamento pelo atalho do cartão", async ({ page, loginAs }) => {
    await loginAs("titular");
    const stamp = Date.now();
    const bank = `BancoAntigo${stamp}`;
    const description = `TV ${stamp}`;

    await page.goto("/wallet");
    await page.getByRole("button", { name: "Cartões" }).click();
    await page.getByRole("button", { name: /^Novo$/ }).click();
    await page.getByLabel("Nome").fill(`Cartão ${bank}`);
    await page.getByLabel("Banco").fill(bank);
    await page.getByRole("button", { name: "Salvar" }).click();
    const card = page.getByTestId("card").filter({ hasText: bank });
    await expect(card).toBeVisible({ timeout: 15_000 });

    // Atalho já abre o formulário com o cartão escolhido.
    await card.getByRole("link", { name: /Lançar compras anteriores/ }).click();
    await expect(page.getByText("Novo lançamento")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("#card option:checked")).toHaveText(new RegExp(bank), {
      timeout: 15_000,
    });

    await page.locator("#amount").fill("100,00");
    await page.locator("#description").fill(description);
    await page.locator("#category").click();
    await page.getByPlaceholder(/Filtrar categoria/).fill(`Categoria ${stamp}`);
    await page.getByRole("button", { name: /^Criar/ }).click();
    await page.locator("#installments").selectOption({ label: "3x" });
    await page.locator("#paid-installments").fill("2");
    await expect(page.getByText(/valor digitado é cada parcela/i)).toBeVisible();
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText(description)).toBeVisible({ timeout: 10_000 });

    // A lista de lançamentos mostra a parcela.
    const row = page.locator("li", { hasText: description });
    await expect(row).toContainText("parcela 3/3");

    // E o detalhe da fatura também.
    await page.goto("/wallet");
    await page.getByRole("button", { name: "Cartões" }).click();
    await expect(card.getByText("R$ 100,00")).toBeVisible({ timeout: 15_000 });
    await card.getByRole("link").filter({ hasText: "de 2026" }).first().click();
    await expect(page.locator("li", { hasText: description })).toContainText("parcela 3/3", {
      timeout: 15_000,
    });
  });

  test("remover a compra parcelada apaga todas as parcelas e as faturas futuras", async ({
    page,
    loginAs,
  }) => {
    await loginAs("titular");
    const stamp = Date.now();
    const bank = `BancoRemover${stamp}`;
    const description = `Fone ${stamp}`;

    await page.goto("/wallet");
    await page.getByRole("button", { name: "Cartões" }).click();
    await page.getByRole("button", { name: /^Novo$/ }).click();
    await page.getByLabel("Nome").fill(`Cartão ${bank}`);
    await page.getByLabel("Banco").fill(bank);
    await page.getByRole("button", { name: "Salvar" }).click();
    const card = page.getByTestId("card").filter({ hasText: bank });
    await expect(card).toBeVisible({ timeout: 15_000 });

    await card.getByRole("link", { name: /Lançar compras anteriores/ }).click();
    await page.locator("#amount").fill("100,00");
    await page.locator("#description").fill(description);
    await page.locator("#category").click();
    await page.getByPlaceholder(/Filtrar categoria/).fill(`Categoria ${stamp}`);
    await page.getByRole("button", { name: /^Criar/ }).click();
    await page.locator("#installments").selectOption({ label: "3x" });
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText(description)).toBeVisible({ timeout: 10_000 });

    // Excluir qualquer parcela pergunta se é só ela ou a compra toda.
    const row = page.locator("li", { hasText: description });
    await row.getByLabel("Excluir lançamento").click();
    await expect(page.getByText(/parcela 1 de 3/)).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: /Remover todas \(3\)/ }).click();
    await expect(page.getByText(description)).toHaveCount(0, { timeout: 10_000 });

    await page.goto("/wallet");
    await page.getByRole("button", { name: "Cartões" }).click();
    await expect(card.getByText("R$ 100,00")).toHaveCount(0, { timeout: 15_000 });
  });
});
