import { test, expect } from "./fixtures";

function randId(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 15 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

test.describe("calendário", () => {
  test("mostra a conta que vence hoje", async ({ page, loginAs, backend }) => {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
      new Date(),
    );
    const id = randId();
    await backend.api("/sync/push", {
      token: backend.titular.token,
      body: {
        household: backend.household,
        operations: [
          {
            sync_id: crypto.randomUUID(),
            entity: "bills",
            operation: "create",
            entity_id: id,
            payload: {
              id,
              household: backend.household,
              sync_id: crypto.randomUUID(),
              title: "Internet Calendário",
              amount_cents: 9990,
              currency: "BRL",
              type: "variavel",
              nature: "saida",
              due_date: today,
              periodicity: "unica",
              status: "pendente",
              attribution: "ambos",
              responsible_user: null,
              category: null,
              recurrence: null,
              reminder_config: {},
              last_generation: null,
              next_generation: null,
              emission_date: today,
              confirmed_at: null,
              updated_by: null,
              deleted_at: null,
            },
            client_ts: new Date().toISOString(),
          },
        ],
      },
    });

    await loginAs("titular");
    await page.goto("/calendar");
    await expect(page.getByRole("heading", { name: "Calendário" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Internet Calendário")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("−R$ 99,90")).toBeVisible();
  });

  test("mostra lançamentos no dia e respeita os filtros", async ({ page, loginAs, backend }) => {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
      new Date(),
    );
    const pull = await backend.api<{
      changes: Array<{ entity: string; id: string; record?: Record<string, unknown> }>;
    }>("/sync/pull?since=0&limit=500", { token: backend.titular.token });
    const accountId = String(
      pull.data.changes.find(
        (change) => change.entity === "accounts" && change.record?.name === "Conta Principal",
      )?.id ?? "",
    );
    const id = randId();
    await backend.api("/sync/push", {
      token: backend.titular.token,
      body: {
        household: backend.household,
        operations: [
          {
            sync_id: crypto.randomUUID(),
            entity: "transactions",
            operation: "create",
            entity_id: id,
            payload: {
              id,
              household: backend.household,
              sync_id: crypto.randomUUID(),
              account: accountId,
              credit_card: null,
              amount_cents: 1290,
              currency: "BRL",
              type: "despesa",
              date: today,
              attribution: "ambos",
              payer_user: null,
              category: null,
              description: "Café Calendário",
              status: "pago",
              recurrence: null,
              installment: null,
              invoice: null,
              transfer: null,
              tags: [],
              note: "",
              origin: "manual",
              updated_by: null,
              deleted_at: null,
            },
            client_ts: new Date().toISOString(),
          },
        ],
      },
    });

    await loginAs("titular");
    await page.goto("/calendar");
    await expect(page.getByText("Café Calendário")).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Lançamentos" }).click();
    await expect(page.getByText("Café Calendário")).toHaveCount(0);
    await page.getByRole("button", { name: "Lançamentos" }).click();
    await expect(page.getByText("Café Calendário")).toBeVisible({ timeout: 10_000 });
  });
});
