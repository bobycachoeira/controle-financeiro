import { test, expect, type Page } from "./fixtures";

async function createSimpleExpense(page: Page, description: string): Promise<void> {
  await page.goto("/transactions/new");
  await page.locator("#amount").waitFor({ timeout: 15_000 });
  await page.locator("#amount").fill("12,50");
  await page.locator("#merchant").fill(description);
  await page.locator("#account").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText(description)).toBeVisible({ timeout: 10_000 });
}

test.describe("ações rápidas nos lançamentos", () => {
  test("desfazer a exclusão restaura o lançamento", async ({ page, loginAs }) => {
    await loginAs("titular");
    const description = `Desfazer ${Date.now()}`;
    await createSimpleExpense(page, description);

    const row = page.locator("li", { hasText: description });
    await row.getByLabel("Excluir lançamento").click();
    await expect(page.getByText(description)).toHaveCount(0, { timeout: 10_000 });

    await page.getByRole("button", { name: "Desfazer", exact: true }).click();
    await expect(page.getByText(description)).toBeVisible({ timeout: 10_000 });
  });

  test("duplicar abre o quick add pré-preenchido", async ({ page, loginAs }) => {
    await loginAs("titular");
    const stamp = Date.now();
    const description = `Duplicar ${stamp}`;
    await createSimpleExpense(page, description);

    const row = page.locator("li", { hasText: description });
    await row.getByLabel("Editar lançamento").click();
    await expect(page.getByRole("heading", { name: "Editar lançamento" })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByTestId("tx-duplicate").click();

    await expect(page.getByTestId("quick-add-sheet")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("#qa-merchant")).toHaveValue(description);
    await expect(page.locator("#qa-amount")).not.toHaveValue("");

    const duplicate = `${description} (repetido)`;
    await page.locator("#qa-merchant").fill(duplicate);
    await page.getByTestId("qa-save").click();
    // O sheet fecha só depois do commit local — âncora determinística.
    await expect(page.getByTestId("quick-add-sheet")).toHaveCount(0, { timeout: 10_000 });
    await expect(page.getByText("Lançamento salvo.").last()).toBeVisible({ timeout: 10_000 });

    await page.goto("/transactions");
    await expect(page.getByText(description, { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(duplicate)).toBeVisible({ timeout: 10_000 });
  });

  test("sugestão de descrição preenche descrição e categoria em 1 toque", async ({ page, loginAs }) => {
    await loginAs("titular");
    const stamp = Date.now();
    const description = `Farmácia São João ${stamp}`;

    // Histórico com categoria: é dele que sai a sugestão.
    await page.goto("/transactions/new");
    await page.locator("#amount").waitFor({ timeout: 15_000 });
    await page.locator("#amount").fill("18,00");
    await page.locator("#merchant").fill(description);
    await page.locator("#category").click();
    await page.getByPlaceholder(/Filtrar categoria/).fill("Farmácia");
    await page.locator("li button", { hasText: "Farmácia" }).first().click();
    await page.locator("#account").selectOption({ index: 1 });
    await page.getByRole("button", { name: "Salvar" }).click();
    await page.getByText(description).first().waitFor({ timeout: 10_000 });

    await page.goto("/");
    await expect(page.getByText("Saldo total")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("quick-add-fab").click();
    await expect(page.getByTestId("quick-add-sheet")).toBeVisible({ timeout: 5_000 });

    await page.locator("#qa-merchant").fill("Farm");
    const suggestion = page.getByTestId("qa-merchant-suggestion").filter({ hasText: description });
    await expect(suggestion).toBeVisible({ timeout: 5_000 });
    await suggestion.click();

    await expect(page.locator("#qa-merchant")).toHaveValue(description);
    await expect(page.locator("#qa-category")).toContainText("Farmácia");
  });

  test("Pagar com agrupa contas/cartões e o seletor cobre muitas opções", async ({
    page,
    loginAs,
  }) => {
    await loginAs("titular");

    // Terceira conta: garante o atalho "Mais contas".
    const extra = `Conta Extra ${Date.now()}`;
    await page.goto("/wallet");
    await page.getByRole("button", { name: /^Nova$/ }).click();
    await page.locator("#account-name").fill(extra);
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText(extra)).toBeVisible({ timeout: 10_000 });

    await page.goto("/");
    await expect(page.getByText("Saldo total")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("quick-add-fab").click();
    await expect(page.getByTestId("quick-add-sheet")).toBeVisible({ timeout: 5_000 });

    const more = page.getByTestId("qa-more-payers").first();
    await expect(more).toBeVisible();
    await more.click();
    await expect(page.getByTestId("payer-picker")).toBeVisible({ timeout: 5_000 });
    await page.getByTestId("payer-picker").getByRole("button", { name: new RegExp(extra) }).click();
    await expect(page.getByTestId("payer-picker")).toHaveCount(0, { timeout: 5_000 });

    // A conta escolhida vira o chip selecionado.
    await expect(page.getByTestId("qa-payer-chip").filter({ hasText: extra })).toHaveClass(
      /border-primary/,
    );
  });

  test("salvar e continuar mantém o sheet aberto e limpa o valor", async ({ page, loginAs }) => {
    await loginAs("titular");
    await page.goto("/");
    await expect(page.getByText("Saldo total")).toBeVisible({ timeout: 15_000 });

    const stamp = Date.now();
    await page.getByTestId("quick-add-fab").click();
    await expect(page.getByTestId("quick-add-sheet")).toBeVisible({ timeout: 5_000 });
    await page.locator("#qa-amount").fill("5,00");
    await page.locator("#qa-merchant").fill(`Continuar A ${stamp}`);
    await page.getByTestId("qa-save-continue").click();
    await expect(page.getByText("Lançamento salvo.")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("quick-add-sheet")).toBeVisible();
    await expect(page.locator("#qa-amount")).toHaveValue("");
    await expect(page.locator("#qa-merchant")).toHaveValue("");

    await page.locator("#qa-amount").fill("6,00");
    await page.locator("#qa-merchant").fill(`Continuar B ${stamp}`);
    await page.getByTestId("qa-save").click();
    await expect(page.getByTestId("quick-add-sheet")).toHaveCount(0, { timeout: 10_000 });

    await page.goto("/transactions");
    await expect(page.getByText(`Continuar A ${stamp}`)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(`Continuar B ${stamp}`)).toBeVisible({ timeout: 10_000 });
  });
});
