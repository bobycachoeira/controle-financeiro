import { test, expect } from "@playwright/test";

test.describe("offline e sincronização", () => {
  test("mostra indicador offline e mantém a UI navegável", async ({ page, context }) => {
    await context.setOffline(true);
    await page.goto("/");
    await expect(page.getByText(/offline/i)).toBeVisible();
  });

  test("reconecta e permite sincronizar manualmente", async ({ page, context }) => {
    await context.setOffline(true);
    await page.goto("/");
    await page.goto("/more");
    await expect(page.getByRole("button", { name: /sincronizar agora/i })).toBeDisabled();
    await context.setOffline(false);
    await expect(page.getByRole("button", { name: /sincronizar agora/i })).toBeEnabled();
  });
});
