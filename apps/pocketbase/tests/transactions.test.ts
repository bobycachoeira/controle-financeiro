import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { api, operation, push, setupFamily, startHarness, type Family, type Harness } from "./harness";

async function firstCategoryId(harness: Harness, family: Family): Promise<string> {
  const pull = await api<{ changes: Array<{ entity: string; id: string }> }>(
    harness,
    `/api/sync/pull?since=0&limit=500&household=${family.householdId}`,
    { token: family.token },
  );
  const category = pull.data.changes.find((change) => change.entity === "categories");
  if (!category) throw new Error("no category found");
  return category.id;
}

async function createAccount(harness: Harness, family: Family): Promise<string> {
  const localId = crypto.randomUUID();
  const syncId = crypto.randomUUID();
  const result = await push(harness, family.token, family.householdId, [
    operation(
      syncId,
      "accounts",
      "create",
      { id: localId, household: "", sync_id: syncId, name: "Conta", type: "corrente" },
      localId,
    ),
  ]);
  return String(result.data.results[0]?.remote_id ?? "");
}

describe("transactions", () => {
  let harness: Harness;
  let family: Family;

  beforeAll(async () => {
    harness = await startHarness();
    family = await setupFamily(harness, "tx@example.com", "Tx");
  }, 60_000);

  afterAll(async () => {
    await harness?.stop();
  });

  it("rejects an invalid transaction (amount <= 0)", async () => {
    const accountId = await createAccount(harness, family);
    const categoryId = await firstCategoryId(harness, family);
    const syncId = crypto.randomUUID();
    const result = await push(harness, family.token, family.householdId, [
      operation(
        syncId,
        "transactions",
        "create",
        {
          id: crypto.randomUUID(),
          household: "",
          sync_id: syncId,
          account: accountId,
          amount_cents: 0,
          type: "despesa",
          date: "2024-03-10",
          attribution: "meu",
          category: categoryId,
          status: "pago",
        },
        crypto.randomUUID(),
      ),
    ]);
    expect(result.data.results[0]?.status).toBe("error");
    expect(result.data.results[0]?.code).toBe("validation_error");
  });

  it("applies a valid transaction and soft deletes it with an audit entry", async () => {
    const accountId = await createAccount(harness, family);
    const categoryId = await firstCategoryId(harness, family);
    const localId = crypto.randomUUID();
    const syncId = crypto.randomUUID();
    const created = await push(harness, family.token, family.householdId, [
      operation(
        syncId,
        "transactions",
        "create",
        {
          id: localId,
          household: "",
          sync_id: syncId,
          account: accountId,
          amount_cents: 2500,
          type: "despesa",
          date: "2024-03-10",
          attribution: "meu",
          category: categoryId,
          status: "pago",
          description: "Mercado",
        },
        localId,
      ),
    ]);
    const remoteId = String(created.data.results[0]?.remote_id ?? "");
    expect(created.data.results[0]?.status).toBe("applied");

    const deleted = await push(harness, family.token, family.householdId, [
      operation(crypto.randomUUID(), "transactions", "delete", { id: localId, sync_id: syncId }, remoteId),
    ]);
    expect(deleted.data.results[0]?.status).toBe("applied");

    const auditLogs = await api<{ items: Array<{ action: string; entity_id: string }> }>(
      harness,
      `/api/collections/audit_logs/records?filter=${encodeURIComponent(`entity_id = "${remoteId}"`)}`,
      { token: harness.adminToken },
    );
    expect(auditLogs.data.items.some((log) => log.action === "transactions.delete")).toBe(true);
  });
});
