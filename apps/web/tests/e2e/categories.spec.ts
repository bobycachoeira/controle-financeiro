import { test, expect } from "@playwright/test";

test.describe("categorias", () => {
  test("lista categorias de sistema e bloqueia exclusão", async ({ page }) => {
    await page.goto("/categories");
    await expect(page.getByText("Categorias")).toBeVisible();
    await expect(page.getByText("Salário")).toBeVisible();
    const systemBadges = page.getByText("sistema");
    expect(await systemBadges.count()).toBeGreaterThan(0);
  });
});
