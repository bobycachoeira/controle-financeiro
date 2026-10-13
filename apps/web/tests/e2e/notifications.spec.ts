import { test, expect } from "./fixtures";

test.describe("notificações", () => {
  test("abre a tela de notificações com preferências", async ({ page, loginAs }) => {
    await loginAs("titular");
    await page.goto("/notifications");
    await expect(page.getByRole("heading", { name: "Notificações" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("Preferências de lembrete")).toBeVisible();
  });
});
