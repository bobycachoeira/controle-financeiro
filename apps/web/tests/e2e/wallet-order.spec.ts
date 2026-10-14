import { test, expect } from "./fixtures";

test.describe("ordenação da carteira", () => {
  test("move uma conta para cima e a ordem persiste", async ({ page, loginAs }) => {
    await loginAs("titular");
    const stamp = Date.now();
    const first = `Conta A ${stamp}`;
    const second = `Conta B ${stamp}`;

    await page.goto("/wallet");
    await expect(page.getByRole("heading", { name: "Contas" })).toBeVisible({ timeout: 15_000 });
    for (const name of [first, second]) {
      await page.getByRole("button", { name: /^Nova$/ }).click();
      await page.locator("#account-name").fill(name);
      await page.getByRole("button", { name: "Salvar" }).click();
      await expect(page.getByText(name)).toBeVisible({ timeout: 10_000 });
    }

    const rowFirst = page.locator("li", { hasText: first });
    const rowSecond = page.locator("li", { hasText: second });
    await rowSecond.getByLabel("Mover conta para cima").click();
    await expect(async () => {
      const boxFirst = await rowFirst.boundingBox();
      const boxSecond = await rowSecond.boundingBox();
      expect(boxSecond!.y).toBeLessThan(boxFirst!.y);
    }).toPass();

    await page.reload();
    await expect(page.getByRole("heading", { name: "Contas" })).toBeVisible({ timeout: 15_000 });
    await expect(async () => {
      const boxFirst = await rowFirst.boundingBox();
      const boxSecond = await rowSecond.boundingBox();
      expect(boxSecond!.y).toBeLessThan(boxFirst!.y);
    }).toPass();
  });

  test("move um cartão para cima e a ordem persiste", async ({ page, loginAs }) => {
    await loginAs("titular");
    const stamp = Date.now();
    const bankFirst = `Banco A ${stamp}`;
    const bankSecond = `Banco B ${stamp}`;

    await page.goto("/wallet");
    await page.getByRole("button", { name: "Cartões" }).click();
    for (const bank of [bankFirst, bankSecond]) {
      await page.getByRole("button", { name: /^Novo$/ }).click();
      await page.getByLabel("Nome").fill(`Cartão ${bank}`);
      await page.getByLabel("Banco").fill(bank);
      await page.getByRole("button", { name: "Salvar" }).click();
      await expect(page.getByTestId("card").filter({ hasText: bank })).toBeVisible({ timeout: 15_000 });
    }

    const cardFirst = page.getByTestId("card").filter({ hasText: bankFirst });
    const cardSecond = page.getByTestId("card").filter({ hasText: bankSecond });
    await cardSecond.getByLabel("Mover cartão para cima").click();
    await expect(async () => {
      const boxFirst = await cardFirst.boundingBox();
      const boxSecond = await cardSecond.boundingBox();
      expect(boxSecond!.y).toBeLessThan(boxFirst!.y);
    }).toPass();

    await page.goto("/wallet");
    await page.getByRole("button", { name: "Cartões" }).click();
    await expect(async () => {
      const boxFirst = await cardFirst.boundingBox();
      const boxSecond = await cardSecond.boundingBox();
      expect(boxSecond!.y).toBeLessThan(boxFirst!.y);
    }).toPass({ timeout: 15_000 });
  });
});
