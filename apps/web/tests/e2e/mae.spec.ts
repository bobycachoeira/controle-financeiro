import { test, expect } from "./fixtures";
import { createExpense } from "./flows";
import { MAE_NAME } from "./fixtures";

// Persona 2: a mãe — usa para lançar quando os gastos acontecem.
test.describe("Persona: Mãe", () => {
  test("entra e vê a família (Home)", async ({ page, loginAs }) => {
    await loginAs("mae");
    await page.goto("/");
    await expect(page.getByText(new RegExp(`Olá, ${MAE_NAME.split(" ")[0]}`))).toBeVisible({
      timeout: 15_000,
    });
  });

  test("lança uma despesa rápida quando acontece", async ({ page, loginAs }) => {
    await loginAs("mae");
    const stamp = Date.now();
    await createExpense(page, {
      amount: "87,90",
      description: `Farmácia E2E ${stamp}`,
      account: "Conta Principal",
      category: `Saúde E2E ${stamp}`,
    });
  });

  test("funciona offline e sincroniza ao reconectar", async ({ page, context, loginAs }) => {
    await loginAs("mae");
    // Carrega o chunk da tela de lançamento ainda online.
    await page.goto("/transactions/new");
    await expect(page.locator("#account option", { hasText: "Conta Principal" })).toHaveCount(1, {
      timeout: 15_000,
    });

    await context.setOffline(true);
    const stamp = Date.now();
    await page.locator("#amount").fill("10,00");
    await page.locator("#description").fill(`Padaria Offline E2E ${stamp}`);
    await page.locator("#account").selectOption({ label: "Conta Principal" });
    await page.locator("#category").click();
    await page.getByPlaceholder(/Filtrar categoria/).fill(`Alimentação E2E ${stamp}`);
    await page.getByRole("button", { name: /^Criar/ }).click();
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Lançamento salvo.")).toBeVisible({ timeout: 10_000 });

    await context.setOffline(false);
    await page.goto("/more");
    const syncButton = page.getByRole("button", { name: /Sincronizar agora/i });
    await expect(syncButton).toBeEnabled({ timeout: 15_000 });
    await syncButton.click();
    await expect(page.getByText("Sincronização concluída.")).toBeVisible({ timeout: 15_000 });
  });
});
