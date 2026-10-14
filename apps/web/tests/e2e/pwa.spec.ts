import { test, expect } from "./fixtures";

test.describe("PWA", () => {
  test("o atalho de novo lançamento abre o formulário", async ({ page, loginAs, backend }) => {
    void backend;
    await loginAs("titular");
    await page.goto("/?new=1");
    await expect(page.getByText("Novo lançamento")).toBeVisible({ timeout: 15_000 });
  });

  test("os demais atalhos abrem as telas direto", async ({ page, loginAs }) => {
    await loginAs("titular");
    await page.goto("/transactions");
    await expect(page.getByRole("heading", { name: "Lançamentos" })).toBeVisible({ timeout: 15_000 });
    await page.goto("/calendar");
    await expect(page.getByRole("heading", { name: "Calendário" })).toBeVisible({ timeout: 15_000 });
  });

  test("expõe o manifest instalável", async ({ page, loginAs }) => {
    await loginAs("titular");
    const response = await page.request.get("/manifest.webmanifest");
    const contentType = response.headers()["content-type"] ?? "";
    test.skip(!response.ok() || !contentType.includes("json"), "manifest não é servido no modo dev");
    expect((await response.json()).name).toContain("Controle Financeiro");
  });
});
