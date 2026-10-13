import { test, expect } from "./fixtures";

test.describe("contas a pagar e receber", () => {
  test("mostra a tela e o seletor de nova conta", async ({ page, loginAs }) => {
    await loginAs("titular");
    await page.goto("/bills");
    await expect(page.getByRole("heading", { name: "Contas" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("A pagar / receber")).toBeVisible();
    await page.getByRole("button", { name: /^Nova$/ }).click();
    await expect(page.getByText("O que você quer criar?")).toBeVisible();
  });
});
