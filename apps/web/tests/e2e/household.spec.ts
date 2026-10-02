import { test, expect } from "@playwright/test";

test.describe("família e convites", () => {
  test("mostra membros e formulário de convite", async ({ page }) => {
    await page.goto("/invites");
    await expect(page.getByText("Família e convites")).toBeVisible();
    await expect(page.getByText("Membros")).toBeVisible();
    await expect(page.getByRole("button", { name: /enviar convite/i })).toBeVisible();
  });
});
