import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { api, operation, push, setupFamily, startHarness, type Family, type Harness } from "./harness";

describe("integrations and multicurrency", () => {
  let harness: Harness;
  let family: Family;

  beforeAll(async () => {
    harness = await startHarness();
    family = await setupFamily(harness, "integ@example.com", "Integ");
  }, 60_000);

  afterAll(async () => {
    await harness?.stop();
  });

  it("exposes feature flags", async () => {
    const result = await api<{ open_finance_enabled: boolean; passkeys_enabled: boolean }>(
      harness,
      "/api/settings/features",
    );
    expect(result.status).toBe(200);
    expect(result.data.open_finance_enabled).toBe(false);
  });

  it("syncs exchange rates", async () => {
    const id = crypto.randomUUID();
    const syncId = crypto.randomUUID();
    const created = await push(harness, family.token, family.householdId, [
      operation(
        syncId,
        "exchange_rates",
        "create",
        { id, household: "", sync_id: syncId, currency: "USD", date: "2024-03-01", rate_micros: 5200000 },
        id,
      ),
    ]);
    expect(created.data.results[0]?.status).toBe("applied");

    const pull = await api<{ changes: Array<{ entity: string }> }>(
      harness,
      `/api/sync/pull?since=0&limit=500&household=${family.householdId}`,
      { token: family.token },
    );
    expect(pull.data.changes.some((change) => change.entity === "exchange_rates")).toBe(true);
  });

  it("persists import origin and external reference on transactions", async () => {
    const accountId = crypto.randomUUID();
    const accountSync = crypto.randomUUID();
    const account = await push(harness, family.token, family.householdId, [
      operation(
        accountSync,
        "accounts",
        "create",
        { id: accountId, household: "", sync_id: accountSync, name: "Import", type: "corrente", owner: "dela" },
        accountId,
      ),
    ]);
    const accountRemote = String(account.data.results[0]?.remote_id ?? "");

    const txId = crypto.randomUUID();
    const txSync = crypto.randomUUID();
    const tx = await push(harness, family.token, family.householdId, [
      operation(
        txSync,
        "transactions",
        "create",
        {
          id: txId,
          household: "",
          sync_id: txSync,
          account: accountRemote,
          amount_cents: 1050,
          type: "despesa",
          date: "2024-03-01",
          attribution: "meu",
          status: "pago",
          origin: "import",
          external_ref: "abc123",
        },
        txId,
      ),
    ]);
    expect(tx.data.results[0]?.status).toBe("applied");
    const record = tx.data.results[0]?.record as Record<string, unknown>;
    expect(record?.origin).toBe("import");
    expect(record?.external_ref).toBe("abc123");
  });
});
