import { test, expect } from "./fixtures";

function randId(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 15 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

test.describe("faturas do cartão", () => {
  test("mostra as duas últimas, expande e abre os lançamentos da fatura", async ({
    page,
    loginAs,
    backend,
  }) => {
    const stamp = Date.now();
    const bank = `BancoFatura${stamp}`;
    const cardAccount = randId();
    const cardId = randId();
    const invoiceIds = ["2026-01", "2026-02", "2026-03"].map(() => randId());
    const txId = randId();

    const operations = [
      {
        sync_id: crypto.randomUUID(),
        entity: "accounts",
        operation: "create",
        entity_id: cardAccount,
        payload: {
          id: cardAccount,
          household: backend.household,
          sync_id: crypto.randomUUID(),
          name: "Cartão Fatura",
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
          closing_day: 15,
          due_day: 25,
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
      ...["2026-01", "2026-02", "2026-03"].map((month, index) => ({
        sync_id: crypto.randomUUID(),
        entity: "invoices",
        operation: "create",
        entity_id: invoiceIds[index],
        payload: {
          id: invoiceIds[index],
          household: backend.household,
          sync_id: crypto.randomUUID(),
          credit_card: cardId,
          account: cardAccount,
          reference_month: month,
          closing_date: `${month}-15`,
          due_date: `${month}-25`,
          total_cents: 0,
          paid_cents: 0,
          status: "aberta",
          note: "",
          updated_by: null,
          deleted_at: null,
        },
        client_ts: new Date().toISOString(),
      })),
      {
        sync_id: crypto.randomUUID(),
        entity: "transactions",
        operation: "create",
        entity_id: txId,
        payload: {
          id: txId,
          household: backend.household,
          sync_id: crypto.randomUUID(),
          account: cardAccount,
          credit_card: cardId,
          amount_cents: 2590,
          currency: "BRL",
          type: "despesa",
          date: "2026-03-10",
          attribution: "ambos",
          payer_user: null,
          category: null,
          description: "Livro Fatura",
          status: "a_pagar",
          recurrence: null,
          installment: null,
          invoice: invoiceIds[2],
          transfer: null,
          tags: [],
          note: "",
          origin: "manual",
          updated_by: null,
          deleted_at: null,
        },
        client_ts: new Date().toISOString(),
      },
    ];
    await backend.api("/sync/push", {
      token: backend.titular.token,
      body: { household: backend.household, operations },
    });

    await loginAs("titular");
    await page.goto("/wallet");
    await page.getByRole("button", { name: "Cartões" }).click();
    const card = page.getByTestId("card").filter({ hasText: bank });
    await expect(card).toBeVisible({ timeout: 15_000 });

    // Só as duas últimas faturas ficam à vista.
    await expect(card.locator("li")).toHaveCount(2);
    const toggle = card.getByTestId("invoices-toggle");
    await expect(toggle).toContainText("Ver todas");
    await toggle.click();
    await expect(card.locator("li")).toHaveCount(4);

    // Clicar na fatura abre os lançamentos.
    await card.getByText("2026-03").click();
    await expect(page).toHaveURL(/\/invoices\//);
    await expect(page.getByText("Lançamentos (1)")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Livro Fatura")).toBeVisible();
    await expect(page.getByText("R$ 25,90").first()).toBeVisible();

    // Pagar direto da tela da fatura.
    await page.getByTestId("invoice-detail-pay").click();
    await page.locator("#pay-account").selectOption({ label: "Conta Principal" });
    const payForm = page.locator("form", { has: page.locator("#pay-amount") });
    await payForm.getByRole("button", { name: "Confirmar pagamento" }).click();
    await expect(page.getByText("paga", { exact: true })).toBeVisible({ timeout: 15_000 });

    // Voltar cai na aba Cartões (e não em Contas).
    await page.getByLabel("Voltar").click();
    await expect(page.getByRole("heading", { name: "Cartões" })).toBeVisible({ timeout: 15_000 });
  });
});
