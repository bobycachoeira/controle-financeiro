import { test, expect } from "./fixtures";

/**
 * Harness de métricas de UX do lançamento.
 *
 * Cada interação de usuário (tap/clique/preenchimento) conta 1. Os limites
 * travam regressões: se o fluxo ficar mais longo ou mais lento, o teste falha.
 */

test.describe("métricas de UX", () => {
  test("baseline: lançar gasto pelo formulário completo (/transactions/new)", async ({
    page,
    loginAs,
  }) => {
    await loginAs("titular");
    await page.goto("/");
    await expect(page.getByText("Saldo total")).toBeVisible({ timeout: 15_000 });

    let interactions = 0;
    const description = `Métrica completa ${Date.now()}`;
    const t0 = Date.now();

    await page.goto("/transactions/new");
    await page.locator("#amount").waitFor({ timeout: 15_000 });
    const formVisibleMs = Date.now() - t0;

    await expect(page.locator("#amount")).toBeFocused();
    await page.locator("#amount").fill("7,50");
    interactions += 1;
    await page.locator("#description").fill(description);
    interactions += 1;
    await page.locator("#account").selectOption({ index: 1 });
    interactions += 1;
    await page.getByRole("button", { name: "Salvar" }).click();
    interactions += 1;
    await expect(page.getByText(description)).toBeVisible({ timeout: 10_000 });
    const totalMs = Date.now() - t0;

    console.log(
      `[métricas] formulário completo: interações=${interactions} formVisível=${formVisibleMs}ms total=${totalMs}ms`,
    );
    expect(formVisibleMs).toBeLessThan(3_000);
    expect(interactions).toBeLessThanOrEqual(6);
  });

  test("meta: lançar gasto pelo quick add em até 5 interações", async ({ page, loginAs }) => {
    await loginAs("titular");

    // Uso real: a família já tem histórico — é dele que saem os chips.
    await page.goto("/transactions/new");
    await page.locator("#amount").waitFor({ timeout: 15_000 });
    await page.locator("#amount").fill("10,00");
    await page.locator("#description").fill("Mercado aquecimento");
    await page.locator("#category").click();
    await page.getByPlaceholder(/Filtrar categoria/).fill("Supermercado");
    await page.locator("li button", { hasText: "Supermercado" }).first().click();
    await page.locator("#account").selectOption({ index: 1 });
    await page.getByRole("button", { name: "Salvar" }).click();
    await page.getByText("Mercado aquecimento").first().waitFor({ timeout: 10_000 });

    await page.goto("/");
    await expect(page.getByText("Saldo total")).toBeVisible({ timeout: 15_000 });

    let interactions = 0;
    const description = `Métrica quick ${Date.now()}`;
    const t0 = Date.now();

    await page.getByTestId("quick-add-fab").click();
    interactions += 1;
    await expect(page.getByTestId("quick-add-sheet")).toBeVisible({ timeout: 5_000 });
    const formVisibleMs = Date.now() - t0;

    await expect(page.locator("#qa-amount")).toBeFocused();
    await page.locator("#qa-amount").fill("7,50");
    interactions += 1;
    await page.locator("#qa-merchant").fill(description);
    interactions += 1;
    await page.getByTestId("qa-category-chip").filter({ hasText: "Supermercado" }).first().click();
    interactions += 1;
    await page.getByTestId("qa-save").click();
    interactions += 1;
    await expect(page.getByText("Lançamento salvo.")).toBeVisible({ timeout: 10_000 });
    const totalMs = Date.now() - t0;

    // O lançamento precisa existir de verdade.
    await page.goto("/transactions");
    const row = page.locator("li", { hasText: description });
    await expect(row).toContainText("Supermercado", { timeout: 10_000 });

    console.log(
      `[métricas] quick add: interações=${interactions} formVisível=${formVisibleMs}ms total=${totalMs}ms`,
    );
    expect(formVisibleMs).toBeLessThan(1_500);
    expect(interactions).toBeLessThanOrEqual(5);
  });
});
