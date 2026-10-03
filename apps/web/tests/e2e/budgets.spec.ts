import { test, expect } from "@playwright/test";

test.describe("orçamentos", () => {
  test("mostra o formulário e lista orçamentos", async ({ page }) => {
    await page.goto("/budgets");
    await expect(page.getByText("Orçamentos")).toBeVisible();
    await expect(page.getByText("Novo orçamento")).toBeVisible();
    await expect(page.getByRole("button", { name: /criar orçamento/i })).toBeVisible();
  });
});
