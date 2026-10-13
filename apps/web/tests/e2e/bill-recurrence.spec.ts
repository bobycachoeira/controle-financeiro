import { test, expect } from "./fixtures";

test.describe("Recorrência → a confirmar → pagar", () => {
  test("gera conta a confirmar, confirma o valor e paga", async ({ page, loginAs }) => {
    await loginAs("titular");
    const stamp = Date.now();
    const name = `Condomínio E2E ${stamp}`;

    await page.goto("/recurrences");
    await expect(page.getByRole("heading", { name: "Recorrências", exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await page.locator("#rec-name").fill(name);
    await page.locator("#rec-amount").fill("300,00");
    await page.locator("#rec-due-day").fill("20");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: /Criar recorrência/i }).click();
    await expect(page.getByText(name)).toBeVisible({ timeout: 10_000 });

    await page.goto("/bills");
    await expect(page.getByRole("heading", { name: "Contas" })).toBeVisible({ timeout: 15_000 });

    // Gera a emissão (a confirmar) e confirma o valor.
    const confirmRow = page.getByTestId("bill-confirm-row").filter({ hasText: name });
    await expect(confirmRow).toBeVisible({ timeout: 20_000 });
    await confirmRow.getByTestId("bill-confirm").click();
    await page.locator("#confirm-amount").fill("320,00");
    const confirmForm = page.locator("form", { has: page.locator("#confirm-amount") });
    await confirmForm.getByRole("button", { name: "Confirmar" }).click();

    // Agora aparece em "A pagar / receber" e é paga.
    const payRow = page.getByTestId("bill-pay-row").filter({ hasText: name });
    await expect(payRow).toBeVisible({ timeout: 15_000 });
    await payRow.getByTestId("bill-pay").click();
    await page.locator("#pay-account").selectOption({ label: "Conta Principal" });
    const payForm = page.locator("form", { has: page.locator("#pay-account") });
    await payForm.getByRole("button", { name: "Pagar", exact: true }).click();
    await expect(page.getByText(/Conta paga/i)).toBeVisible({ timeout: 10_000 });
    await expect(payRow).toHaveCount(0, { timeout: 10_000 });
  });
});
