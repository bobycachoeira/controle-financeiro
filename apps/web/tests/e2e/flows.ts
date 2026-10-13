import { expect, type Page } from "@playwright/test";

/** Aguarda o app carregar a sessão/família e o backend responder. */
export async function openApp(page: Page, path = "/"): Promise<void> {
  await page.goto(path);
  await expect(page.getByText("Saldo total")).toBeVisible({ timeout: 15_000 });
}

export async function createAccount(page: Page, name: string): Promise<void> {
  await page.goto("/wallet");
  await page.getByRole("button", { name: /^Nova$/ }).click();
  await page.locator("#account-name").fill(name);
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText(name)).toBeVisible({ timeout: 10_000 });
}

export interface ExpenseInput {
  amount: string;
  description: string;
  account: string;
  category?: string;
}

export async function createExpense(page: Page, input: ExpenseInput): Promise<void> {
  await page.goto("/transactions/new");
  await page.locator("#amount").fill(input.amount);
  await page.locator("#description").fill(input.description);
  await expect(page.locator("#account option", { hasText: input.account })).toHaveCount(1, {
    timeout: 15_000,
  });
  await page.locator("#account").selectOption({ label: input.account });
  if (input.category) {
    await page.locator("#category").click();
    await page.getByPlaceholder(/Filtrar categoria/).fill(input.category);
    await page.getByRole("button", { name: /^Criar/ }).click();
  }
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText(input.description)).toBeVisible({ timeout: 10_000 });
}
