import { test, expect } from "./fixtures";

test.describe("mais", () => {
  test("busca opções e abre Metas e cofrinhos", async ({ page, loginAs }) => {
    await loginAs("titular");
    await page.goto("/more");
    await expect(page.getByRole("heading", { name: "Mais" })).toBeVisible({ timeout: 15_000 });

    await page.locator("#more-search").fill("cofrinho");
    await expect(page.getByRole("link", { name: "Metas e cofrinhos" })).toBeVisible();
    await expect(page.getByText("Aparência")).toHaveCount(0);

    await page.getByRole("link", { name: "Metas e cofrinhos" }).click();
    await expect(page.getByRole("heading", { name: "Metas" })).toBeVisible({ timeout: 15_000 });
  });
});
