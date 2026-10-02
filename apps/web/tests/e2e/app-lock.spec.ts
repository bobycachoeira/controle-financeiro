import { test, expect } from "@playwright/test";

test.describe("App Lock", () => {
  test("oferece ativação e trata indisponibilidade de biometria", async ({ page }) => {
    await page.goto("/app-lock");
    await expect(page.getByText("App Lock")).toBeVisible();
    await page.getByRole("button", { name: /ativar app lock/i }).click();
    await expect(page.getByText(/biometria|app lock ativado/i)).toBeVisible();
  });
});
