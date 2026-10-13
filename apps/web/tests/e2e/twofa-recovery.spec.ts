import { test, expect } from "./fixtures";

// Cobre a correção: com 2FA ativo, dá para gerar novos códigos de recuperação.
test.describe("2FA — códigos de recuperação", () => {
  test("gera novos códigos com o 2FA ativo", async ({ page, loginAs, backend }) => {
    await loginAs("titular");
    await page.goto("/devices");
    await expect(page.getByText("2FA está ativo")).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Gerar novos códigos de recuperação" }).click();
    await page.getByLabel("Código do autenticador", { exact: true }).fill(backend.stepUpCode(backend.titular));
    await page.getByRole("button", { name: "Gerar códigos" }).click();

    await expect(page.getByText("Guarde estes códigos")).toBeVisible({ timeout: 10_000 });
    const block = page.locator("div", { hasText: "Guarde estes códigos" }).last();
    await expect(block.locator("li")).toHaveCount(10);
    await page.getByRole("button", { name: "Já guardei" }).click();
    await expect(page.getByText("Guarde estes códigos")).toBeHidden();
  });

  test("recusa código inválido", async ({ page, loginAs }) => {
    await loginAs("titular");
    await page.goto("/devices");
    await expect(page.getByText("2FA está ativo")).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Gerar novos códigos de recuperação" }).click();
    await page.getByLabel("Código do autenticador", { exact: true }).fill("000000");
    await page.getByRole("button", { name: "Gerar códigos" }).click();
    await expect(page.getByText(/inválido/i)).toBeVisible({ timeout: 10_000 });
  });
});
