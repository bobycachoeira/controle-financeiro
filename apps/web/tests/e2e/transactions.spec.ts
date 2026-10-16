import { test, expect } from "./fixtures";

test.describe("lançamentos", () => {
  test("abre o formulário de novo lançamento", async ({ page, loginAs }) => {
    await loginAs("titular");
    await page.goto("/transactions/new");
    await expect(page.getByText("Novo lançamento")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("#amount")).toBeVisible();
  });

  test("lista lançamentos", async ({ page, loginAs }) => {
    await loginAs("titular");
    await page.goto("/transactions");
    await expect(page.getByRole("heading", { name: "Lançamentos" })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("cria despesa com etiquetas, busca e filtra por etiqueta", async ({ page, loginAs }) => {
    await loginAs("titular");
    const stamp = Date.now();
    const description = `Tag E2E ${stamp}`;

    await page.goto("/transactions/new");
    await page.locator("#amount").fill("10,00");
    await page.locator("#description").fill(description);
    await page.locator("#tags").fill("viagem, trabalho");
    await page.locator("#category").click();
    await page.getByPlaceholder(/Filtrar categoria/).fill(`Categoria ${stamp}`);
    await page.getByRole("button", { name: /^Criar/ }).click();
    await page.locator("#account").selectOption({ label: "Conta Principal" });
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText(description)).toBeVisible({ timeout: 10_000 });

    const row = page.locator("li", { hasText: description });
    await expect(row).toContainText("#viagem");
    await expect(row).toContainText("#trabalho");

    await page.locator("#filter-query").fill(String(stamp));
    await expect(page.getByText(description)).toBeVisible({ timeout: 10_000 });
    await page.locator("#filter-query").fill("");

    await page.locator("#filter-tag").selectOption({ label: "viagem" });
    await expect(page.getByText(description)).toBeVisible({ timeout: 10_000 });
  });

  test("anexa comprovante (foto) no lançamento", async ({ page, loginAs }) => {
    await loginAs("titular");
    const stamp = Date.now();
    const description = `Cupom E2E ${stamp}`;
    const png =
      "iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAEElEQVR4nGN4Eq4HRwzEcQBWUhaRV1WeswAAAABJRU5ErkJggg==";

    await page.goto("/transactions/new");
    await page.locator("#amount").fill("9,90");
    await page.locator("#description").fill(description);
    await page.locator("#category").click();
    await page.getByPlaceholder(/Filtrar categoria/).fill(`Categoria ${stamp}`);
    await page.getByRole("button", { name: /^Criar/ }).click();
    await page.locator("#account").selectOption({ label: "Conta Principal" });
    await page.locator("#photo").setInputFiles({
      name: "cupom.png",
      mimeType: "image/png",
      buffer: Buffer.from(png, "base64"),
    });
    await expect(page.getByText(/Foto anexada/)).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText(description)).toBeVisible({ timeout: 10_000 });

    const row = page.locator("li", { hasText: description });
    await expect(row.getByTestId("tx-photo")).toBeVisible();
    await row.getByTestId("tx-photo").click();
    await expect(page.getByText("Comprovante")).toBeVisible({ timeout: 10_000 });
  });

  test("categoria opcional: regra por descrição e fallback Outros", async ({ page, loginAs }) => {
    await loginAs("titular");
    const stamp = Date.now();

    // Cria a regra em Categorias.
    await page.goto("/categories");
    await expect(page.getByText("Regras de categorização")).toBeVisible({ timeout: 15_000 });
    await page.getByPlaceholder(/Texto na descrição/).fill(`padaria${stamp}`);
    await page.locator("#rule-category").click();
    await page.getByPlaceholder(/Filtrar categoria/).fill("Supermercado");
    await page.getByRole("button", { name: /Supermercado/ }).first().click();
    await page.getByRole("button", { name: /Adicionar regra/ }).click();
    await expect(page.getByText(`padaria${stamp}`)).toBeVisible({ timeout: 10_000 });

    // Descrição que casa a regra: categoria sugerida sozinha.
    await page.goto("/transactions/new");
    await page.locator("#amount").fill("12,34");
    await page.locator("#description").fill(`Padaria${stamp} do Zé`);
    await page.locator("#account").selectOption({ label: "Conta Principal" });
    await expect(page.getByText(/Sugerida pela regra/)).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText(`Padaria${stamp} do Zé`)).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("li", { hasText: `Padaria${stamp}` })).toContainText("Supermercado");

    // Sem categoria e sem regra: vai para Outros.
    await page.goto("/transactions/new");
    await page.locator("#amount").fill("5,00");
    await page.locator("#description").fill(`Sem categoria ${stamp}`);
    await page.locator("#account").selectOption({ label: "Conta Principal" });
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText(`Sem categoria ${stamp}`)).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("li", { hasText: `Sem categoria ${stamp}` })).toContainText("Outros");
  });
});
