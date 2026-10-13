import { test, expect } from "./fixtures";

test.describe("offline e sincronização", () => {
  test("mostra indicador offline", async ({ page, context, loginAs }) => {
    await loginAs("titular");
    await page.goto("/");
    await expect(page.getByText("Saldo total")).toBeVisible({ timeout: 15_000 });
    await context.setOffline(true);
    await expect(page.getByText(/offline/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test("reconecta e permite sincronizar manualmente", async ({ page, context, loginAs }) => {
    await loginAs("titular");
    await page.goto("/more");
    const syncButton = page.getByRole("button", { name: /Sincronizar agora/i });
    await expect(syncButton).toBeVisible({ timeout: 15_000 });
    await context.setOffline(true);
    await expect(syncButton).toBeDisabled();
    await context.setOffline(false);
    await expect(syncButton).toBeEnabled({ timeout: 15_000 });
  });
});
