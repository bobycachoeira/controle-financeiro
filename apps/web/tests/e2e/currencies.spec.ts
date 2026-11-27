import { test, expect } from "./fixtures";

test.describe("moedas e cotações", () => {
  test("cadastra uma cotação", async ({ page, loginAs }) => {
    await loginAs("titular");
    await page.goto("/currencies");
    await expect(page.getByText("Moedas e cotações")).toBeVisible({ timeout: 15_000 });
    await page.locator("#rate-value").fill("5,20");
    await page.getByRole("button", { name: /Salvar cotação/i }).click();
    await expect(page.getByText("Cotação salva.")).toBeVisible({ timeout: 10_000 });
  });

  test("busca a cotação atual e salva", async ({ page, loginAs }) => {
    await loginAs("titular");
    await page.route("**/api/rates/quote**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          currency: "USD",
          rate_micros: 5430000,
          source: "AwesomeAPI",
          date: "2026-11-27",
          fetched_at: "2026-11-27T12:00:00.000Z",
        }),
      }),
    );
    await page.goto("/currencies");
    await expect(page.getByText("Moedas e cotações")).toBeVisible({ timeout: 15_000 });

    await page.locator("#rate-currency").fill("USD");
    await page.getByTestId("rate-fetch").click();
    await expect(page.locator("#rate-value")).toHaveValue("5,43");
    await expect(page.getByText(/Cotação USD\/BRL preenchida/)).toBeVisible();

    await page.getByRole("button", { name: /Salvar cotação/i }).click();
    await expect(page.getByText("Cotação salva.")).toBeVisible({ timeout: 10_000 });

    await page.getByTestId("rate-fetch").click();
    await page.getByRole("button", { name: /Salvar cotação/i }).click();
    await expect(page.getByText(/USD · 27\/11\/2026/)).toHaveCount(1, { timeout: 10_000 });
  });
});
