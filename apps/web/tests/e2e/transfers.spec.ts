import { test, expect } from "./fixtures";

test.describe("transferências", () => {
  test("mostra o formulário e o dash", async ({ page, loginAs }) => {
    await loginAs("titular");
    await page.goto("/transfers");
    await expect(page.getByRole("heading", { name: "Transferências" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator("#source")).toBeVisible();
    await expect(page.locator("#destination")).toBeVisible();
  });

  test("registra uma transferência e atualiza o dash", async ({ page, loginAs }) => {
    await loginAs("titular");
    await page.goto("/transfers");
    await expect(page.locator("#source option", { hasText: "Conta Principal" })).toHaveCount(1, {
      timeout: 15_000,
    });

    const source = await page
      .locator("#source option")
      .evaluateAll((nodes) =>
        nodes.map((node) => ({ value: (node as HTMLOptionElement).value, text: node.textContent ?? "" })),
      );
    const sourceValue = source.find((item) => item.text.trim() === "Conta Principal")?.value ?? "";
    const options = await page
      .locator("#destination option")
      .evaluateAll((nodes) =>
        nodes.map((node) => ({ value: (node as HTMLOptionElement).value, text: node.textContent ?? "" })),
      );
    const dest = options.find((item) => item.value && item.value !== sourceValue);
    test.skip(!dest, "precisa de uma segunda conta");

    const description = `Transferência Dash ${Date.now()}`;
    await page.locator("#source").selectOption(sourceValue);
    await page.locator("#destination").selectOption(dest!.value);
    await page.locator("#transfer-amount").fill("75,00");
    await page.locator("#transfer-description").fill(description);
    await page.getByRole("button", { name: "Transferir" }).click();

    await expect(page.getByText(description)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Movimentações por mês")).toBeVisible();
    await expect(page.getByText("Principais rotas do mês")).toBeVisible();
  });
});
