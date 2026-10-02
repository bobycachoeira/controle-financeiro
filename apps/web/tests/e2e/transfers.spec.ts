import { test, expect } from "@playwright/test";

test.describe("transferências", () => {
  test("mostra o formulário de transferência", async ({ page }) => {
    await page.goto("/transfers");
    await expect(page.getByText("Transferências")).toBeVisible();
    await expect(page.getByLabel("Conta de origem")).toBeVisible();
    await expect(page.getByLabel("Conta de destino")).toBeVisible();
  });
});
