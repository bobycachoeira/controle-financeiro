import { test, expect } from "./fixtures";

test.describe("orçamentos", () => {
  test("mostra o formulário e lista orçamentos", async ({ page, loginAs }) => {
    await loginAs("titular");
    await page.goto("/budgets");
    await expect(page.getByRole("heading", { name: "Orçamentos" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Novo orçamento")).toBeVisible();
    await expect(page.getByRole("button", { name: /Criar orçamento/i })).toBeVisible();
  });
});
