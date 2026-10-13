import { test, expect } from "./fixtures";

test.describe("família e convites", () => {
  test("mostra membros e formulário de convite", async ({ page, loginAs }) => {
    await loginAs("titular");
    await page.goto("/family");
    await expect(page.getByRole("heading", { name: "Família", exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("heading", { name: "Membros" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Convidar membro" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Enviar convite/i })).toBeVisible();
  });
});
