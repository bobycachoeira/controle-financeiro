import { test, expect } from "./fixtures";

test.describe("metas", () => {
  test("cria meta, guarda e resgata com histórico", async ({ page, loginAs }) => {
    await loginAs("titular");
    const stamp = Date.now();
    const name = `Viagem ${stamp}`;

    await page.goto("/goals");
    await expect(page.getByRole("heading", { name: "Metas" })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /^Nova$/ }).click();
    await page.locator("#goal-name").fill(name);
    await page.locator("#goal-target").fill("1.000,00");
    await page.getByRole("button", { name: "Salvar" }).click();

    const card = page.getByTestId("goal").filter({ hasText: name });
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(card).toContainText("faltam R$ 1.000,00");

    await card.getByTestId("goal-save").click();
    await page.locator("#entry-amount").fill("300,00");
    await page.locator("#entry-note").fill("13º salário");
    const entryForm = page.locator("form", { has: page.locator("#entry-amount") });
    await entryForm.getByRole("button", { name: "Guardar" }).click();

    await expect(card).toContainText("R$ 300,00", { timeout: 15_000 });
    await expect(card).toContainText("30%");
    await expect(card).toContainText("13º salário");

    await card.getByRole("button", { name: "Resgatar" }).click();
    await page.locator("#entry-amount").fill("100,00");
    const withdrawForm = page.locator("form", { has: page.locator("#entry-amount") });
    await withdrawForm.getByRole("button", { name: "Resgatar" }).click();
    await expect(card).toContainText("R$ 200,00", { timeout: 15_000 });

    // Persiste no servidor (sync da nova entidade "goals").
    await expect(page.getByText("Sincronizado")).toBeVisible({ timeout: 20_000 });
  });
});
