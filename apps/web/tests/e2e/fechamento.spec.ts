import { test, expect } from "./fixtures";

function randId(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 15 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

test.describe("fechamento do mês", () => {
  test("resume o mês e baixa o card compartilhável", async ({ page, loginAs, backend }) => {
    const pull = await backend.api<{
      changes: Array<{ entity: string; id: string; record?: Record<string, unknown> }>;
    }>("/sync/pull?since=0&limit=500", { token: backend.titular.token });
    const accountId = String(
      pull.data.changes.find(
        (change) => change.entity === "accounts" && change.record?.name === "Conta Principal",
      )?.id ?? "",
    );

    const operations = [
      { amount: 50000, type: "receita", date: "2025-03-10", description: "Receita fechamento" },
      { amount: 20000, type: "despesa", date: "2025-03-15", description: "Despesa fechamento" },
    ].map((item) => {
      const id = randId();
      return {
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
          amount_cents: item.amount,
          currency: "BRL",
          type: item.type,
          date: item.date,
          attribution: "ambos",
          payer_user: null,
          category: null,
          description: item.description,
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
      };
    });
    await backend.api("/sync/push", {
      token: backend.titular.token,
      body: { household: backend.household, operations },
    });

    await loginAs("titular");
    await page.goto("/closing");
    await expect(page.getByRole("heading", { name: "Fechamento do mês" })).toBeVisible({
      timeout: 15_000,
    });
    await page.locator("#closing-month").fill("2025-03");
    await expect(page.getByText("R$ 500,00").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("R$ 200,00").first()).toBeVisible();
    await expect(page.getByText("R$ 300,00").first()).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Compartilhar card/ }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("fechamento-2025-03.png");
  });
});
