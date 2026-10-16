import { test, expect, type Page } from "./fixtures";

async function createSimpleExpense(page: Page, description: string): Promise<void> {
  await page.goto("/?new=1");
  await page.locator("#amount").waitFor({ timeout: 15_000 });
  await page.locator("#amount").fill("12,50");
  await page.locator("#description").fill(description);
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
    await expect(page.locator("#qa-description")).toHaveValue(description);
    await expect(page.locator("#qa-amount")).not.toHaveValue("");

    const duplicate = `${description} (repetido)`;
    await page.locator("#qa-description").fill(duplicate);
    await page.getByTestId("qa-save").click();
    // O sheet fecha só depois do commit local — âncora determinística.
    await expect(page.getByTestId("quick-add-sheet")).toHaveCount(0, { timeout: 10_000 });
    await expect(page.getByText("Lançamento salvo.").last()).toBeVisible({ timeout: 10_000 });

    await page.goto("/transactions");
    await expect(page.getByText(description, { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(duplicate)).toBeVisible({ timeout: 10_000 });
  });

  test("salvar e continuar mantém o sheet aberto e limpa o valor", async ({ page, loginAs }) => {
    await loginAs("titular");
    await page.goto("/");
    await expect(page.getByText("Saldo total")).toBeVisible({ timeout: 15_000 });

    const stamp = Date.now();
    await page.getByTestId("quick-add-fab").click();
    await expect(page.getByTestId("quick-add-sheet")).toBeVisible({ timeout: 5_000 });
    await page.locator("#qa-amount").fill("5,00");
    await page.locator("#qa-description").fill(`Continuar A ${stamp}`);
    await page.getByTestId("qa-save-continue").click();
    await expect(page.getByText("Lançamento salvo.")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("quick-add-sheet")).toBeVisible();
    await expect(page.locator("#qa-amount")).toHaveValue("");
    await expect(page.locator("#qa-description")).toHaveValue("");

    await page.locator("#qa-amount").fill("6,00");
    await page.locator("#qa-description").fill(`Continuar B ${stamp}`);
    await page.getByTestId("qa-save").click();
    await expect(page.getByTestId("quick-add-sheet")).toHaveCount(0, { timeout: 10_000 });

    await page.goto("/transactions");
    await expect(page.getByText(`Continuar A ${stamp}`)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(`Continuar B ${stamp}`)).toBeVisible({ timeout: 10_000 });
  });
});
