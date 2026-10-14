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
  });
});
