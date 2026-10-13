import { test, expect } from "./fixtures";
import { createAccount, createExpense } from "./flows";
import { TITULAR_NAME } from "./fixtures";

// Persona 1: o Titular (pai) — cria a família, controla e usa o app todo dia.
test.describe("Persona: Titular (pai)", () => {
  test("Home mostra seu nome e os blocos principais", async ({ page, loginAs }) => {
    await loginAs("titular");
    await page.goto("/");
    await expect(page.getByText(new RegExp(`Olá, ${TITULAR_NAME.split(" ")[0]}`))).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("Saldo total")).toBeVisible();
    await expect(page.getByText("Saldos por conta")).toBeVisible();
  });

  test("cria uma conta corrente e ela aparece na Carteira", async ({ page, loginAs }) => {
    await loginAs("titular");
    const name = `Conta Corrente ${Date.now()}`;
    await createAccount(page, name);
  });

  test("lança uma despesa criando a categoria na hora", async ({ page, loginAs }) => {
    await loginAs("titular");
    const stamp = Date.now();
    await createExpense(page, {
      amount: "123,45",
      description: `Mercado E2E ${stamp}`,
      account: "Conta Principal",
      category: `Categoria E2E ${stamp}`,
    });
  });

  test("atalho Transferir na Carteira abre a tela de transferências", async ({ page, loginAs }) => {
    await loginAs("titular");
    await page.goto("/wallet");
    await page.getByRole("button", { name: /Transferir/ }).click();
    await expect(page).toHaveURL(/\/transfers$/);
    await expect(page.getByText("Nova transferência")).toBeVisible();
  });

  test("transferência entre contas aparece no histórico", async ({ page, loginAs }) => {
    await loginAs("titular");
    await page.goto("/transfers");
    await expect(page.locator("#source option", { hasText: "Conta Principal" })).toHaveCount(1, {
      timeout: 15_000,
    });
    const options = await page
      .locator("#destination option")
      .evaluateAll((nodes) =>
        nodes.map((node) => ({ value: (node as HTMLOptionElement).value, text: node.textContent ?? "" })),
      );
    const source = await page
      .locator("#source option")
      .evaluateAll((nodes) =>
        nodes.map((node) => ({ value: (node as HTMLOptionElement).value, text: node.textContent ?? "" })),
      );
    const sourceValue = source.find((item) => item.text.trim() === "Conta Principal")?.value ?? "";
    const dest = options.find((item) => item.value && item.value !== sourceValue);
    test.skip(!dest, "precisa de uma segunda conta");

    const description = `Transferência E2E ${Date.now()}`;
    await page.locator("#source").selectOption(sourceValue);
    await page.locator("#destination").selectOption(dest!.value);
    await expect(page.locator("#destination")).toHaveValue(dest!.value);
    await page.locator("#transfer-amount").fill("50,00");
    await page.locator("#transfer-description").fill(description);
    await page.getByRole("button", { name: "Transferir" }).click();
    await expect(page.getByText(description)).toBeVisible({ timeout: 10_000 });
  });

  test("status de sincronização fica limpo (online)", async ({ page, loginAs }) => {
    await loginAs("titular");
    await page.goto("/");
    await expect(page.getByText(/sincronizado|Sincronizar/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });
});
