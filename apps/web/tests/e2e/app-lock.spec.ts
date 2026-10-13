import { test, expect } from "./fixtures";

test.describe("App Lock", () => {
  test("oferece ativação", async ({ page, loginAs }) => {
    await loginAs("titular");
    await page.goto("/app-lock");
    await expect(page.getByRole("heading", { name: "App Lock" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: /Ativar App Lock/i })).toBeVisible();
  });
});
