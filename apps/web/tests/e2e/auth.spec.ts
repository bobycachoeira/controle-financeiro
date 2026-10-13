import { test, expect } from "./fixtures";
import { login, uniqueEmail } from "./helpers";

test.describe("autenticação", () => {
  test("solicita magic link e mostra confirmação", async ({ page, backend }) => {
    void backend;
    await login(page, uniqueEmail("auth"));
    await expect(page.getByText(/enviamos um link/i)).toBeVisible({ timeout: 10_000 });
  });

  test("exibe erro para link inválido", async ({ page, backend }) => {
    void backend;
    await page.goto("/login?token=invalido");
    await expect(page.getByText(/expirou|inválido/i)).toBeVisible({ timeout: 10_000 });
  });

  test("protege rotas autenticadas", async ({ page, backend }) => {
    void backend;
    await page.goto("/transactions");
    await expect(page).toHaveURL(/\/login/);
  });
});
