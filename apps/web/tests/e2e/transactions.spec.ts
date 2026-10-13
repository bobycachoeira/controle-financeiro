import { test, expect } from "./fixtures";

test.describe("lançamentos", () => {
  test("abre o formulário de novo lançamento", async ({ page, loginAs }) => {
    await loginAs("titular");
    await page.goto("/transactions/new");
    await expect(page.getByText("Novo lançamento")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("#amount")).toBeVisible();
  });

  test("lista lançamentos", async ({ page, loginAs }) => {
    await loginAs("titular");
    await page.goto("/transactions");
    await expect(page.getByRole("heading", { name: "Lançamentos" })).toBeVisible({
      timeout: 15_000,
    });
  });
});
