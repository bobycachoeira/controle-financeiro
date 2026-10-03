import { test, expect } from "@playwright/test";

test.describe("PWA", () => {
  test("o atalho de novo lançamento abre o formulário", async ({ page }) => {
    await page.goto("/?new=1");
    await expect(page.getByText("Novo lançamento")).toBeVisible();
  });

  test("expõe o manifest instalável", async ({ page }) => {
    await page.goto("/");
    const manifestHref = await page.getAttribute('link[rel="manifest"]', "href");
    expect(manifestHref).toBeTruthy();
  });
});
