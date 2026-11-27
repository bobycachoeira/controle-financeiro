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

test.describe("conta interna do cartão", () => {
  test("edita o nome da conta vinculada ao cartão", async ({ page, loginAs }) => {
    await loginAs("titular");
    await page.goto("/cards");
    await expect(page.getByRole("heading", { name: "Cartões" })).toBeVisible({ timeout: 15_000 });

    const stamp = Date.now();
    const bank = `Banco Conta ${stamp}`;
    const initialAccount = `Cartão Bçack ${stamp}`;
    const fixedAccount = `Cartão Black ${stamp}`;

    await page.getByRole("button", { name: /^Novo$/ }).click();
    await page.locator("#card-name").fill(`Bçack ${stamp}`);
    await page.locator("#card-bank").fill(bank);
    await page.getByRole("button", { name: "Salvar" }).click();

    const card = page.getByTestId("card").filter({ hasText: bank });
    await expect(card).toBeVisible({ timeout: 15_000 });
    await card.getByLabel("Editar cartão").click();
    await expect(page.locator("#card-account-name")).toHaveValue(initialAccount);

    await page.locator("#card-account-name").fill(fixedAccount);
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.locator("#card-account-name")).toBeHidden();

    await card.getByLabel("Editar cartão").click();
    await expect(page.locator("#card-account-name")).toHaveValue(fixedAccount);
  });
});
