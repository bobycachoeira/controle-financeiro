import { test, expect } from "@playwright/test";
import { login, uniqueEmail } from "./helpers";

test.describe("autenticação", () => {
  test("solicita magic link e mostra confirmação", async ({ page }) => {
    await login(page, uniqueEmail("auth"));
  });

  test("exibe erro para link inválido", async ({ page }) => {
    await page.goto("/login?token=invalido");
    await expect(page.getByText(/expirou|inválido/i)).toBeVisible();
  });

  test("protege rotas autenticadas", async ({ page }) => {
    await page.goto("/transactions");
    await expect(page).toHaveURL(/\/login/);
  });
});
