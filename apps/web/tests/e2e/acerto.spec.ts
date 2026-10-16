import { test, expect } from "./fixtures";

test.describe("acerto do casal", () => {
  test("modo dividir: sugere e registra o acerto do mês", async ({ page, loginAs }) => {
    await loginAs("titular");
    const stamp = Date.now();

    // Define o titular das contas (base para o acerto saber quem paga quem).
    await page.goto("/wallet");
    await expect(page.getByRole("heading", { name: "Contas" })).toBeVisible({ timeout: 15_000 });
    for (const [accountName, owner] of [
      ["Conta Principal", "Paulo Souza (você)"],
      ["Poupança", "Maria Souza"],
    ] as const) {
      const row = page.locator("li", { hasText: accountName });
      await row.getByLabel("Editar conta").click();
      const form = page.locator("form", { has: page.locator("#account-owner") });
      await page.locator("#account-owner").selectOption({ label: owner });
      await form.getByRole("button", { name: "Salvar" }).click();
      await expect(form).toBeHidden({ timeout: 10_000 });
    }

    // Ativa o modo dividir.
    await page.goto("/family");
    await expect(page.getByRole("heading", { name: "Família" })).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("split-mode-dividir").click();
    await expect(page.getByTestId("split-mode-dividir")).toHaveClass(/border-primary/, {
      timeout: 10_000,
    });

    // Zera qualquer resíduo de testes anteriores nesta família (backend do
    // worker é compartilhado): registra o acerto pendente, se houver.
    await page.goto("/settle");
    await expect(page.getByRole("heading", { name: "Acerto do mês" })).toBeVisible({ timeout: 15_000 });
    if ((await page.getByTestId("settle-suggestion").count()) > 0) {
      await page.getByTestId("settle-suggestion").first().getByRole("button", { name: "Registrar" }).click();
      const resetForm = page.locator("form", { has: page.locator("#settle-amount") });
      await resetForm.getByRole("button", { name: "Registrar" }).click();
      await expect(page.getByText("Tudo acertado neste mês.")).toBeVisible({ timeout: 15_000 });
    }

    // Despesa do casal paga pelo titular.
    await page.goto("/transactions/new");
    await page.locator("#amount").fill("100,00");
    await page.locator("#description").fill(`Jantar ${stamp}`);
    await page.locator("#category").click();
    await page.getByPlaceholder(/Filtrar categoria/).fill(`Categoria ${stamp}`);
    await page.getByRole("button", { name: /^Criar/ }).click();
    await page.locator("#account").selectOption({ label: "Conta Principal" });
    await page.getByTestId("tx-more").click();
    await page.locator("#attribution").selectOption({ label: "Ambos" });
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText(`Jantar ${stamp}`)).toBeVisible({ timeout: 10_000 });

    // O acerto sugere Maria → Paulo de R$ 50,00.
    await page.goto("/settle");
    await expect(page.getByRole("heading", { name: "Acerto do mês" })).toBeVisible({ timeout: 15_000 });
    const suggestion = page.getByTestId("settle-suggestion");
    await expect(suggestion).toContainText("Maria Souza");
    await expect(suggestion).toContainText("Paulo Souza");
    await expect(suggestion).toContainText("R$ 50,00");

    await suggestion.getByRole("button", { name: "Registrar" }).click();
    const payForm = page.locator("form", { has: page.locator("#settle-amount") });
    await expect(page.locator("#settle-amount")).toHaveValue("50,00");
    await payForm.getByRole("button", { name: "Registrar" }).click();

    await expect(page.getByText("Tudo acertado neste mês.")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Acerto do mês/).last()).toBeVisible();
  });
});
