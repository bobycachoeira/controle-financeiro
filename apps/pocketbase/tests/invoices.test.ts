import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { api, operation, push, setupFamily, startHarness, type Family, type Harness } from "./harness";

async function pushAndGetId(
  harness: Harness,
  family: Family,
  entity: string,
  payload: Record<string, unknown>,
): Promise<string> {
  const syncId = crypto.randomUUID();
  const result = await push(harness, family.token, family.householdId, [
    operation(syncId, entity, "create", payload, String(payload.id ?? "")),
  ]);
  const status = result.data.results[0]?.status;
  if (status !== "applied") throw new Error(`create ${entity} failed: ${JSON.stringify(result.data.results[0])}`);
  return String(result.data.results[0]?.remote_id ?? "");
}

describe("invoice recalculation", () => {
  let harness: Harness;
  let family: Family;
  let accountId: string;
  let cardId: string;
  let invoiceId: string;
  let categoryId: string;

  beforeAll(async () => {
    harness = await startHarness();
    family = await setupFamily(harness, "inv@example.com", "Inv");

    accountId = await pushAndGetId(harness, family, "accounts", {
      id: crypto.randomUUID(),
      household: "",
      sync_id: crypto.randomUUID(),
      name: "Cartão",
      type: "cartao_credito",
    });
    cardId = await pushAndGetId(harness, family, "credit_cards", {
      id: crypto.randomUUID(),
      household: "",
      sync_id: crypto.randomUUID(),
      account: accountId,
      closing_day: 15,
      due_day: 25,
    });
    invoiceId = await pushAndGetId(harness, family, "invoices", {
      id: crypto.randomUUID(),
      household: "",
      sync_id: crypto.randomUUID(),
      credit_card: cardId,
      account: accountId,
      reference_month: "2024-04",
      closing_date: "2024-04-15",
      due_date: "2024-04-25",
      total_cents: 0,
      paid_cents: 0,
      status: "aberta",
    });

    const pull = await api<{ changes: Array<{ entity: string; id: string }> }>(
      harness,
      `/api/sync/pull?since=0&limit=500&household=${family.householdId}`,
      { token: family.token },
    );
    categoryId = String(pull.data.changes.find((change) => change.entity === "categories")?.id ?? "");
  }, 60_000);

  afterAll(async () => {
    await harness?.stop();
  });

  async function invoiceTotal(): Promise<number> {
    const pull = await api<{ changes: Array<{ id: string; record?: Record<string, unknown> }> }>(
      harness,
      `/api/sync/pull?since=0&limit=500&household=${family.householdId}`,
      { token: family.token },
    );
    const invoice = pull.data.changes.find((change) => change.id === invoiceId);
    return Number(invoice?.record?.total_cents ?? 0);
  }

  it("recalculates the invoice when a transaction is added, edited and removed", async () => {
    const txLocalId = crypto.randomUUID();
    const txSyncId = crypto.randomUUID();
    const created = await push(harness, family.token, family.householdId, [
      operation(
        txSyncId,
        "transactions",
        "create",
        {
          id: txLocalId,
          household: "",
          sync_id: txSyncId,
          account: accountId,
          credit_card: cardId,
          invoice: invoiceId,
          amount_cents: 1500,
          type: "despesa",
          date: "2024-03-20",
          attribution: "meu",
          category: categoryId,
          status: "a_pagar",
        },
        txLocalId,
      ),
    ]);
    const remoteId = String(created.data.results[0]?.remote_id ?? "");
    expect(await invoiceTotal()).toBe(1500);

    const edited = await push(harness, family.token, family.householdId, [
      {
        ...operation(
          crypto.randomUUID(),
          "transactions",
          "update",
          {
            id: txLocalId,
            household: "",
            sync_id: txSyncId,
            account: accountId,
            credit_card: cardId,
            invoice: invoiceId,
            amount_cents: 2500,
            type: "despesa",
            date: "2024-03-20",
            attribution: "meu",
            category: categoryId,
            status: "a_pagar",
          },
          remoteId,
        ),
        client_ts: new Date(Date.now() + 60_000).toISOString(),
      },
    ]);
    expect(edited.data.results[0]?.status).toBe("applied");
    expect(await invoiceTotal()).toBe(2500);

    await push(harness, family.token, family.householdId, [
      operation(
        crypto.randomUUID(),
        "transactions",
        "delete",
        { id: txLocalId, sync_id: txSyncId },
        remoteId,
      ),
    ]);
    expect(await invoiceTotal()).toBe(0);
  });

  async function invoiceRecord(id = invoiceId): Promise<Record<string, unknown> | undefined> {
    const pull = await api<{ changes: Array<{ id: string; record?: Record<string, unknown> }> }>(
      harness,
      `/api/sync/pull?since=0&limit=500&household=${family.householdId}`,
      { token: family.token },
    );
    return pull.data.changes.find((change) => change.id === id)?.record;
  }

  it("marks an overdue invoice as vencida on recalculation", async () => {
    const txLocalId = crypto.randomUUID();
    const txSyncId = crypto.randomUUID();
    await push(harness, family.token, family.householdId, [
      operation(
        txSyncId,
        "transactions",
        "create",
        {
          id: txLocalId,
          household: "",
          sync_id: txSyncId,
          account: accountId,
          credit_card: cardId,
          invoice: invoiceId,
          amount_cents: 1000,
          type: "despesa",
          date: "2024-03-20",
          attribution: "meu",
          category: categoryId,
          status: "a_pagar",
        },
        txLocalId,
      ),
    ]);
    const record = await invoiceRecord();
    expect(record?.status).toBe("vencida");
  });

  it("keeps a client payment even when the recalculated invoice is newer", async () => {
    const pay = operation(
      crypto.randomUUID(),
      "invoices",
      "update",
      {
        id: invoiceId,
        household: "",
        sync_id: crypto.randomUUID(),
        credit_card: cardId,
        account: accountId,
        reference_month: "2024-04",
        closing_date: "2024-04-15",
        due_date: "2024-04-25",
        total_cents: 1000,
        paid_cents: 1000,
        status: "paga",
        paid_at: new Date().toISOString(),
      },
      invoiceId,
    );
    // O pagamento foi enfileirado antes do push: o client_ts é mais antigo que
    // o recálculo que o servidor fez ao aplicar a compra.
    pay.client_ts = new Date(Date.now() - 60_000).toISOString();
    const result = await push(harness, family.token, family.householdId, [pay]);
    expect(result.data.results[0]?.status).toBe("applied");
    expect(result.data.results[0]?.code).toBe("payment_applied");
    const record = await invoiceRecord();
    expect(record?.status).toBe("paga");
    expect(record?.paid_cents).toBe(1000);
  });

  it("supports partial payments without overwriting the invoice total", async () => {
    const secondInvoiceId = await pushAndGetId(harness, family, "invoices", {
      id: crypto.randomUUID(),
      household: "",
      sync_id: crypto.randomUUID(),
      credit_card: cardId,
      account: accountId,
      reference_month: "2024-05",
      closing_date: "2024-05-15",
      due_date: "2024-05-25",
      total_cents: 0,
      paid_cents: 0,
      status: "aberta",
    });

    const txLocalId = crypto.randomUUID();
    const txSyncId = crypto.randomUUID();
    await push(harness, family.token, family.householdId, [
      operation(
        txSyncId,
        "transactions",
        "create",
        {
          id: txLocalId,
          household: "",
          sync_id: txSyncId,
          account: accountId,
          credit_card: cardId,
          invoice: secondInvoiceId,
          amount_cents: 1000,
          type: "despesa",
          date: "2024-05-01",
          attribution: "meu",
          category: categoryId,
          status: "a_pagar",
        },
        txLocalId,
      ),
    ]);

    function paymentPayload(paidCents: number, paidAt?: string) {
      return {
        id: secondInvoiceId,
        household: "",
        sync_id: crypto.randomUUID(),
        credit_card: cardId,
        account: accountId,
        reference_month: "2024-05",
        closing_date: "2024-05-15",
        due_date: "2024-05-25",
        total_cents: 0,
        paid_cents: paidCents,
        status: paidAt ? "paga" : "fechada",
        paid_at: paidAt ?? null,
      };
    }

    const partial = operation(
      crypto.randomUUID(),
      "invoices",
      "update",
      paymentPayload(300),
      secondInvoiceId,
    );
    partial.client_ts = new Date(Date.now() - 60_000).toISOString();
    const first = await push(harness, family.token, family.householdId, [partial]);
    expect(first.data.results[0]?.status).toBe("applied");
    expect(first.data.results[0]?.code).toBe("payment_applied");
    const afterPartial = await invoiceRecord(secondInvoiceId);
    expect(afterPartial?.total_cents).toBe(1000);
    expect(afterPartial?.paid_cents).toBe(300);
    expect(afterPartial?.status).not.toBe("paga");

    const full = operation(
      crypto.randomUUID(),
      "invoices",
      "update",
      paymentPayload(1000, new Date().toISOString()),
      secondInvoiceId,
    );
    full.client_ts = new Date(Date.now() - 60_000).toISOString();
    const second = await push(harness, family.token, family.householdId, [full]);
    expect(second.data.results[0]?.status).toBe("applied");
    const afterFull = await invoiceRecord(secondInvoiceId);
    expect(afterFull?.total_cents).toBe(1000);
    expect(afterFull?.paid_cents).toBe(1000);
    expect(afterFull?.status).toBe("paga");
  });

  it("moves a card transaction between invoices and recalculates both", async () => {
    const invoiceA = await pushAndGetId(harness, family, "invoices", {
      id: crypto.randomUUID(),
      household: "",
      sync_id: crypto.randomUUID(),
      credit_card: cardId,
      account: accountId,
      reference_month: "2024-06",
      closing_date: "2024-06-15",
      due_date: "2024-06-25",
      total_cents: 0,
      paid_cents: 0,
      status: "aberta",
    });
    const invoiceB = await pushAndGetId(harness, family, "invoices", {
      id: crypto.randomUUID(),
      household: "",
      sync_id: crypto.randomUUID(),
      credit_card: cardId,
      account: accountId,
      reference_month: "2024-07",
      closing_date: "2024-07-15",
      due_date: "2024-07-25",
      total_cents: 0,
      paid_cents: 0,
      status: "aberta",
    });

    const txLocalId = crypto.randomUUID();
    const txSyncId = crypto.randomUUID();
    const created = await push(harness, family.token, family.householdId, [
      operation(
        txSyncId,
        "transactions",
        "create",
        {
          id: txLocalId,
          household: "",
          sync_id: txSyncId,
          account: accountId,
          credit_card: cardId,
          invoice: invoiceA,
          amount_cents: 700,
          type: "despesa",
          date: "2024-06-10",
          attribution: "meu",
          category: categoryId,
          status: "a_pagar",
        },
        txLocalId,
      ),
    ]);
    const txRemoteId = String(created.data.results[0]?.remote_id ?? "");
    expect((await invoiceRecord(invoiceA))?.total_cents).toBe(700);

    const moved = operation(
      crypto.randomUUID(),
      "transactions",
      "update",
      {
        id: txLocalId,
        household: "",
        sync_id: txSyncId,
        account: accountId,
        credit_card: cardId,
        invoice: invoiceB,
        amount_cents: 700,
        type: "despesa",
        date: "2024-06-10",
        attribution: "meu",
        category: categoryId,
        status: "a_pagar",
      },
      txRemoteId,
    );
    moved.client_ts = new Date(Date.now() + 60_000).toISOString();
    const result = await push(harness, family.token, family.householdId, [moved]);
    expect(result.data.results[0]?.status).toBe("applied");
    expect((await invoiceRecord(invoiceA))?.total_cents).toBe(0);
    expect((await invoiceRecord(invoiceB))?.total_cents).toBe(700);
  });

  function invoiceCreatePayload(localId: string, syncId: string) {
    return {
      id: localId,
      household: "",
      sync_id: syncId,
      credit_card: cardId,
      account: accountId,
      reference_month: "2024-04",
      closing_date: "2024-04-15",
      due_date: "2024-04-25",
      total_cents: 0,
      paid_cents: 0,
      status: "aberta",
    };
  }

  it("merges a duplicated invoice create into the existing record", async () => {
    const localId = crypto.randomUUID();
    const syncId = crypto.randomUUID();
    const result = await push(harness, family.token, family.householdId, [
      operation(syncId, "invoices", "create", invoiceCreatePayload(localId, syncId), localId),
    ]);
    expect(result.data.results[0]?.status).toBe("applied");
    expect(result.data.results[0]?.code).toBe("duplicate_merged");
    expect(result.data.results[0]?.remote_id).toBe(invoiceId);
  });

  it("does not resurrect a soft-deleted invoice cycle", async () => {
    await push(harness, family.token, family.householdId, [
      operation(
        crypto.randomUUID(),
        "invoices",
        "delete",
        { id: invoiceId, sync_id: crypto.randomUUID() },
        invoiceId,
      ),
    ]);

    const localId = crypto.randomUUID();
    const syncId = crypto.randomUUID();
    const result = await push(harness, family.token, family.householdId, [
      operation(syncId, "invoices", "create", invoiceCreatePayload(localId, syncId), localId),
    ]);
    expect(result.data.results[0]?.status).toBe("applied");
    expect(result.data.results[0]?.code).toBe("duplicate_merged");
    expect(result.data.results[0]?.remote_id).toBe(invoiceId);
    const record = result.data.results[0]?.record as Record<string, unknown> | undefined;
    expect(record?.deleted_at).toBeTruthy();
  });
});
