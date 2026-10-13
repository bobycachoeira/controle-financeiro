import { test, expect } from "./fixtures";

test.describe("categorias", () => {
  test("lista categorias de sistema", async ({ page, loginAs }) => {
    await loginAs("titular");
    await page.goto("/categories");
    await expect(page.getByRole("heading", { name: "Categorias" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Salário").first()).toBeVisible();
  });
});
