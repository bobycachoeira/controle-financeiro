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
});
