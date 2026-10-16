import { test, expect } from "./fixtures";

test.describe("revisar lançamentos", () => {
  test("categoriza pelo card do Início e pela tela Revisar", async ({ page, loginAs }) => {
    await loginAs("titular");
    const stamp = Date.now();
    const description = `Revisar ${stamp}`;

    // Despesa sem categoria (cai em "Outros").
    await page.goto("/transactions/new");
    await page.locator("#amount").fill("7,77");
    await page.locator("#description").fill(description);
    await page.locator("#account").selectOption({ label: "Conta Principal" });
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText(description)).toBeVisible({ timeout: 10_000 });

    // O Início avisa e leva para a fila.
    await page.goto("/");
    const card = page.getByTestId("review-card");
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(card).toContainText("para revisar");
    await card.getByRole("link", { name: "Revisar" }).click();

    await expect(page.getByRole("heading", { name: "Revisar" })).toBeVisible({ timeout: 15_000 });
    const row = page.getByTestId("review-row").filter({ hasText: description });
    await expect(row).toBeVisible();

    // Categoriza no próprio item.
    await row.getByTestId("review-category").getByRole("button").click();
    await page.getByPlaceholder(/Filtrar categoria/).fill("Supermercado");
    await page.getByRole("button", { name: /Supermercado/ }).first().click();

    await expect(row).toHaveCount(0, { timeout: 10_000 });

    // Confere no lançamento.
    await page.goto("/transactions");
    await expect(page.locator("li", { hasText: description })).toContainText("Supermercado", {
      timeout: 10_000,
    });
  });

  test("aplicar a categoria aos similares em um toque", async ({ page, loginAs }) => {
    await loginAs("titular");
    const stamp = Date.now();
    const first = `Padaria Central ${stamp}`;
    const second = `Padaria do Zé ${stamp}`;

    for (const description of [first, second]) {
      await page.goto("/transactions/new");
      await page.locator("#amount").fill("5,00");
      await page.locator("#description").fill(description);
      await page.locator("#account").selectOption({ label: "Conta Principal" });
      await page.getByRole("button", { name: "Salvar" }).click();
      await expect(page.getByText(description)).toBeVisible({ timeout: 10_000 });
    }

    await page.goto("/review");
    const row = page.getByTestId("review-row").filter({ hasText: first });
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.getByTestId("review-category").getByRole("button").click();
    await page.getByPlaceholder(/Filtrar categoria/).fill("Supermercado");
    await page.getByRole("button", { name: /Supermercado/ }).first().click();

    // O toast oferece aplicar aos similares; as duas padarias saem da fila.
    await page.locator("button", { hasText: /Aplicar aos similares/ }).click();
    await expect(page.getByTestId("review-row").filter({ hasText: second })).toHaveCount(0, {
      timeout: 10_000,
    });
    await expect(page.getByTestId("review-row").filter({ hasText: first })).toHaveCount(0);

    await page.goto("/transactions");
    await expect(page.locator("li", { hasText: second })).toContainText("Supermercado", {
      timeout: 10_000,
    });
  });
});
