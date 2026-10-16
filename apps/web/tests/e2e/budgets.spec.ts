import { test, expect } from "./fixtures";

test.describe("orçamentos", () => {
  test("mostra o formulário e lista orçamentos", async ({ page, loginAs }) => {
    await loginAs("titular");
    await page.goto("/budgets");
    await expect(page.getByRole("heading", { name: "Orçamentos" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Novo orçamento")).toBeVisible();
    await expect(page.getByRole("button", { name: /Criar orçamento/i })).toBeVisible();
  });

  test("alerta do orçamento no Início leva aos lançamentos filtrados", async ({ page, loginAs }) => {
    await loginAs("titular");
    const stamp = Date.now();

    // Gasto de 90 numa categoria, com orçamento de 100 (alerta em 80%).
    await page.goto("/?new=1");
    await page.locator("#amount").waitFor({ timeout: 15_000 });
    await page.locator("#amount").fill("90,00");
    await page.locator("#description").fill(`Orçamento ${stamp}`);
    await page.locator("#category").click();
    await page.getByPlaceholder(/Filtrar categoria/).fill("Supermercado");
    await page.locator("li button", { hasText: "Supermercado" }).first().click();
    await page.locator("#account").selectOption({ index: 1 });
    await page.getByRole("button", { name: "Salvar" }).click();
    await page.getByText(`Orçamento ${stamp}`).first().waitFor({ timeout: 10_000 });

    await page.goto("/budgets");
    await page.locator("#budget-name").fill(`Mercado ${stamp}`);
    await page.locator("#budget-total").fill("10000");
    await page.locator("#budget-alert").fill("80");
    await page.getByPlaceholder("Filtrar categoria…").fill("Supermercado");
    await page.getByText("Supermercado", { exact: true }).click();
    await page.getByRole("button", { name: "Criar orçamento" }).click();
    await expect(page.getByText("Orçamento criado.")).toBeVisible({ timeout: 10_000 });

    // O Início mostra o alerta acionável.
    await page.goto("/");
    const alert = page
      .getByTestId("decide-card")
      .getByText(new RegExp(`Mercado ${stamp} em \\d+% do orçamento`));
    await expect(alert).toBeVisible({ timeout: 15_000 });
    await alert.click();

    // Cai nos lançamentos já filtrados pela categoria.
    await expect(page).toHaveURL(/category=/);
    await expect(page.getByTestId("filters-panel")).toBeVisible();
    await expect(page.locator("#filter-category option:checked")).toHaveText(/Supermercado/);
  });
});
