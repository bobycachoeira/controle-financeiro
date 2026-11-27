import { test, expect } from "./fixtures";

test.describe("dashboard", () => {
  test("exibe os blocos principais", async ({ page, loginAs }) => {
    await loginAs("titular");
    await page.goto("/");
    for (const block of ["Saldo total", "Saldos por conta", "Gastos do mês", "Faturas abertas"]) {
      await expect(page.getByText(block).first()).toBeVisible({ timeout: 15_000 });
    }
  });
});

test.describe("relatórios", () => {
  test("lançamento fora dos relatórios sai dos gastos por estabelecimento", async ({
    page,
    loginAs,
  }) => {
    await loginAs("titular");
    const stamp = Date.now();
    const merchant = `Cofrinho Teste ${stamp}`;
    const category = `Fora ${stamp}`;

    await page.goto("/transactions/new");
    await page.locator("#amount").fill("123,45");
    await page.locator("#merchant").fill(merchant);
    await page.locator("#account").selectOption({ label: "Conta Principal" });
    await page.locator("#category").click();
    await page.getByPlaceholder(/Filtrar categoria/).fill(category);
    await page.getByRole("button", { name: /^Criar/ }).click();
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.locator("li", { hasText: merchant })).toBeVisible({ timeout: 10_000 });

    await page.goto("/");
    const spend = page.getByTestId("merchant-spend");
    await expect(spend).toBeVisible({ timeout: 15_000 });
    await page.locator("#merchant-category").selectOption({ label: category });
    await expect(spend.getByText(merchant, { exact: true })).toBeVisible({ timeout: 10_000 });

    await page.goto("/transactions");
    const row = page.locator("li", { hasText: merchant });
    await row.getByLabel("Editar lançamento").click();
    await expect(page.getByRole("heading", { name: "Editar lançamento" })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByTestId("tx-more").click();
    await page.getByTestId("exclude-reports-toggle").click();
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.locator("li", { hasText: merchant })).toBeVisible({ timeout: 10_000 });

    await page.goto("/");
    await expect(page.getByTestId("merchant-spend")).toBeVisible({ timeout: 15_000 });
    await page.locator("#merchant-category").selectOption({ label: category });
    await expect(
      page.getByTestId("merchant-spend").getByText("Sem despesas nesse filtro."),
    ).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("atalhos", () => {
  test("personaliza e usa um atalho no Início", async ({ page, loginAs }) => {
    await loginAs("titular");
    await page.goto("/");
    await expect(page.getByTestId("shortcuts-card")).toBeVisible({ timeout: 15_000 });

    await page.getByTestId("shortcuts-edit").click();
    await page.getByRole("button", { name: "Orçamentos" }).click();
    const selected = page.locator("li", { hasText: "Orçamentos" });
    for (let index = 0; index < 4; index += 1) {
      await selected.getByLabel("Mover para cima").click();
    }
    await page.getByRole("button", { name: "Salvar" }).click();

    const shortcut = page.getByTestId("shortcut").filter({ hasText: "Orçamentos" });
    await expect(shortcut).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("shortcut").first()).toContainText("Orçamentos");
    await shortcut.click();
    await expect(page.getByRole("heading", { name: "Orçamentos" })).toBeVisible({
      timeout: 15_000,
    });
  });
});
