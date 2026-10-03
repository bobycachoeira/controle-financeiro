import { test, expect } from "@playwright/test";

test.describe("notificações", () => {
  test("abre a tela de notificações com ativação e preferências", async ({ page }) => {
    await page.goto("/notifications");
    await expect(page.getByText("Notificações")).toBeVisible();
    await expect(page.getByText("Preferências de lembrete")).toBeVisible();
    await expect(page.getByRole("button", { name: /salvar preferências/i })).toBeVisible();
  });

  test("avisa quando o dispositivo não suporta push", async ({ page }) => {
    await page.addInitScript(() => {
      // remove PushManager to simulate an unsupported browser
      delete (window as unknown as Record<string, unknown>).PushManager;
    });
    await page.goto("/notifications");
    await expect(page.getByText(/não suporta notificações|indisponíveis/i)).toBeVisible();
  });
});
