import { test, expect } from "./fixtures";

test.describe("investimentos", () => {
  test("aporta e registra rendimento em uma conta de investimento", async ({ page, loginAs }) => {
    await loginAs("titular");
    const stamp = Date.now();
    const name = `Tesouro ${stamp}`;

    await page.goto("/investments");
    await expect(page.getByRole("heading", { name: "Investimentos" })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: /^Novo$/ }).click();
    await page.locator("#inv-name").fill(name);
    await page.getByRole("button", { name: "Salvar" }).click();

    const card = page.getByTestId("investment").filter({ hasText: name });
    await expect(card).toBeVisible({ timeout: 15_000 });

    await card.getByRole("button", { name: "Aportar" }).click();
    await page.locator("#aporte-source").selectOption({ label: "Conta Principal" });
    await page.locator("#aporte-amount").fill("1.000,00");
    const aporteForm = page.locator("form", { has: page.locator("#aporte-amount") });
    await aporteForm.getByRole("button", { name: "Aportar" }).click();
    await expect(card).toContainText("R$ 1.000,00", { timeout: 15_000 });

    await card.getByRole("button", { name: "Rendimento" }).click();
    await page.locator("#yield-amount").fill("10,00");
    const yieldForm = page.locator("form", { has: page.locator("#yield-amount") });
    await yieldForm.getByRole("button", { name: "Registrar" }).click();
    await expect(card).toContainText("R$ 1.010,00", { timeout: 15_000 });
    await expect(card).toContainText("R$ 10,00");

    // Resgatar parte do investimento de volta para a conta.
    await card.getByRole("button", { name: "Retirar" }).click();
    await page.locator("#retirar-destination").selectOption({ label: "Conta Principal" });
    await page.locator("#retirar-amount").fill("10,00");
    const retirarForm = page.locator("form", { has: page.locator("#retirar-amount") });
    await retirarForm.getByRole("button", { name: "Retirar" }).click();
    await expect(card).toContainText("R$ 1.000,00", { timeout: 15_000 });
  });

  test("cria tirando da conta e exclui depois de retirar tudo", async ({ page, loginAs }) => {
    await loginAs("titular");
    const stamp = Date.now();
    const name = `CDB ${stamp}`;

    await page.goto("/investments");
    await page.getByRole("button", { name: /^Novo$/ }).click();
    await page.locator("#inv-name").fill(name);
    await page.locator("#inv-initial").fill("300,00");
    await page.locator("#inv-source").selectOption({ label: "Conta Principal" });
    await page.getByRole("button", { name: "Salvar" }).click();

    const card = page.getByTestId("investment").filter({ hasText: name });
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(card.getByTestId("investment-balance")).toHaveText("R$ 300,00", { timeout: 15_000 });

    // Com saldo, a exclusão é bloqueada.
    await card.getByTestId("investment-delete").click();
    await expect(card).toBeVisible();

    await card.getByRole("button", { name: "Retirar" }).click();
    await page.locator("#retirar-destination").selectOption({ label: "Conta Principal" });
    await page.locator("#retirar-amount").fill("300,00");
    const retirarForm = page.locator("form", { has: page.locator("#retirar-amount") });
    await retirarForm.getByRole("button", { name: "Retirar" }).click();
    await expect(card.getByTestId("investment-balance")).toHaveText("R$ 0,00", { timeout: 15_000 });

    await card.getByTestId("investment-delete").click();
    await expect(card).toHaveCount(0, { timeout: 15_000 });
  });
});
