import { test, expect } from "./fixtures";

test.describe("PWA", () => {
  test("o atalho de novo lançamento abre o lançamento rápido", async ({ page, loginAs, backend }) => {
    void backend;
    await loginAs("titular");
    await page.goto("/?new=1");
    await expect(page.getByTestId("quick-add-sheet")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Novo lançamento")).toBeVisible();
  });

  test("o atalho carrega os estabelecimentos do histórico", async ({ page, loginAs }) => {
    await loginAs("titular");
    const merchant = `Atalho ${Date.now()}`;

    await page.goto("/transactions/new");
    await page.locator("#amount").waitFor({ timeout: 15_000 });
    await page.locator("#amount").fill("9,00");
    await page.locator("#merchant").fill(merchant);
    await page.locator("#account").selectOption({ index: 1 });
    await page.getByRole("button", { name: "Salvar" }).click();
    await page.getByText(merchant).first().waitFor({ timeout: 10_000 });

    await page.goto("/?new=1");
    await expect(page.getByTestId("quick-add-sheet")).toBeVisible({ timeout: 15_000 });
    await page.locator("#qa-merchant").fill("Atalho");
    await expect(
      page.getByTestId("qa-merchant-suggestion").filter({ hasText: merchant }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("o atalho reidrata os estabelecimentos após cold start", async ({
    page,
    loginAs,
    backend,
  }) => {
    await loginAs("titular");
    const merchant = `Cold ${Date.now()}`;

    await page.goto("/transactions/new");
    await page.locator("#amount").waitFor({ timeout: 15_000 });
    await page.locator("#amount").fill("7,00");
    await page.locator("#merchant").fill(merchant);
    await page.locator("#account").selectOption({ index: 1 });
    await page.getByRole("button", { name: "Salvar" }).click();
    await page.getByText(merchant).first().waitFor({ timeout: 10_000 });

    // Garante que o lançamento chegou ao servidor antes de apagar o banco local.
    await expect
      .poll(
        async () => {
          const response = await backend.api<{
            changes: Array<{ record?: { merchant?: string } }>;
          }>("/sync/pull?since=0&limit=2000", { token: backend.titular.token });
          return (
            response.data.changes?.some((change) => change.record?.merchant === merchant) ?? false
          );
        },
        { timeout: 15_000 },
      )
      .toBe(true);

    // Simula instalação/cold start do PWA sem dados locais: o sync repõe o histórico.
    await page.goto("/manifest.webmanifest");
    await page.evaluate(
      () =>
        new Promise<void>((resolve, reject) => {
          const request = indexedDB.deleteDatabase("cf");
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
          request.onblocked = () => resolve();
        }),
    );

    await page.goto("/?new=1");
    await expect(page.getByTestId("quick-add-sheet")).toBeVisible({ timeout: 15_000 });
    await page.locator("#qa-merchant").fill("Cold");
    await expect(
      page.getByTestId("qa-merchant-suggestion").filter({ hasText: merchant }),
    ).toBeVisible({ timeout: 15_000 });
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
