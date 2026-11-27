import { test, expect } from "./fixtures";

function randId(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from(
    { length: 15 },
    () => alphabet[Math.floor(Math.random() * alphabet.length)],
  ).join("");
}

test.describe("importação de compras do cartão", () => {
  test("importa parcelas em andamento e alimenta a fatura", async ({ page, loginAs, backend }) => {
    const cardAccount = randId();
    const cardId = randId();
    const bank = `Itaú Black ${Date.now()}`;

    await backend.api("/sync/push", {
      token: backend.titular.token,
      body: {
        household: backend.household,
        operations: [
          {
            sync_id: crypto.randomUUID(),
            entity: "accounts",
            operation: "create",
            entity_id: cardAccount,
            payload: {
              id: cardAccount,
              household: backend.household,
              sync_id: crypto.randomUUID(),
              name: "Cartão Import",
              type: "cartao_credito",
              currency: "BRL",
              initial_balance_cents: 0,
              include_in_total: false,
              active: true,
              order: 9,
              owner: "indefinido",
              updated_by: null,
              deleted_at: null,
            },
            client_ts: new Date().toISOString(),
          },
          {
            sync_id: crypto.randomUUID(),
            entity: "credit_cards",
            operation: "create",
            entity_id: cardId,
            payload: {
              id: cardId,
              household: backend.household,
              sync_id: crypto.randomUUID(),
              account: cardAccount,
              bank,
              limit_cents: 0,
              currency: "BRL",
              closing_day: 4,
              due_day: 11,
              purchase_at_posting: false,
              uses_account_balance_for_invoice: false,
              active: true,
              order: 0,
              payment_account: null,
              owner: "indefinido",
              updated_by: null,
              deleted_at: null,
            },
            client_ts: new Date().toISOString(),
          },
        ],
      },
    });

    await loginAs("titular");
    await page.goto("/import");
    await page.getByRole("tab", { name: "Compras do cartão" }).click();
    await expect(page.getByRole("heading", { name: "Compras do cartão" })).toBeVisible({
      timeout: 15_000,
    });
    await page
      .locator("#card-import-text")
      .fill(
        [
          "data_proxima_parcela;valor_parcela;parcelas_total;parcelas_pagas;estabelecimento;categoria",
          "2026-11-20;100.00;10;6;LOJA TESTE;Moradia",
        ].join("\n"),
      );
    await page.getByRole("button", { name: "Pré-visualizar" }).click();
    await expect(page.getByText("LOJA TESTE")).toBeVisible();
    await expect(page.getByText(/Parcela 7\/10/)).toBeVisible();

    await page.getByRole("button", { name: "Confirmar importação" }).click();
    await expect(page.getByText(/1 compra\(s\) importada\(s\)/)).toBeVisible({ timeout: 15_000 });

    await page.goto("/cards");
    const card = page.getByTestId("card").filter({ hasText: bank });
    await expect(card).toBeVisible({ timeout: 15_000 });
    await card.locator("li a").first().click();
    await expect(page.getByText("Lançamentos (1)")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("LOJA TESTE")).toBeVisible();
  });
});
