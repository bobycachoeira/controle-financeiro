import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { api, operation, push, setupFamily, startHarness, type Family, type Harness } from "./harness";

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

describe("recurrence generation", () => {
  let harness: Harness;
  let family: Family;
  let accountId: string;

  beforeAll(async () => {
    harness = await startHarness();
    family = await setupFamily(harness, "gen@example.com", "Gen");
    accountId = await createAccount(harness, family);
  }, 60_000);

  afterAll(async () => {
    await harness?.stop();
  });

  async function runGeneration(today: string): Promise<number> {
    const result = await api<{ created: number }>(harness, "/api/recurrences/run", {
      token: harness.adminToken,
      body: { today },
    });
    expect(result.status).toBe(200);
    return result.data.created;
  }

  it("generates transactions idempotently for a monthly recurrence", async () => {
    const id = crypto.randomUUID();
    const syncId = crypto.randomUUID();
    const create = await push(harness, family.token, family.householdId, [
      operation(
        syncId,
        "recurrences",
        "create",
        {
          id,
          household: "",
          sync_id: syncId,
          name: "Aluguel",
          rrule: "FREQ=MONTHLY;INTERVAL=1",
          start_date: "2024-01-05",
          active: true,
          target: "transaction",
          creates_status: "a_pagar",
          template: { amount_cents: 100000, type: "despesa", account: accountId, attribution: "ambos" },
        },
        id,
      ),
    ]);
    expect(create.data.results[0]?.status, JSON.stringify(create.data.results[0])).toBe("applied");

    const first = await runGeneration("2024-03-31");
    expect(first).toBe(3);

    const second = await runGeneration("2024-03-31");
    expect(second).toBe(0);
  });

  it("generates bills for a bill recurrence", async () => {
    const id = crypto.randomUUID();
    const syncId = crypto.randomUUID();
    await push(harness, family.token, family.householdId, [
      operation(
        syncId,
        "recurrences",
        "create",
        {
          id,
          household: "",
          sync_id: syncId,
          name: "Internet",
          rrule: "FREQ=MONTHLY;INTERVAL=1",
          start_date: "2024-02-10",
          active: true,
          target: "bill",
          creates_status: "a_pagar",
          template: { amount_cents: 12000, type: "despesa", nature: "saida", attribution: "ambos" },
        },
        id,
      ),
    ]);

    const created = await runGeneration("2024-03-31");
    expect(created).toBe(2);

    const pull = await api<{ changes: Array<{ entity: string }> }>(
      harness,
      `/api/sync/pull?since=0&limit=1000&household=${family.householdId}`,
      { token: family.token },
    );
    expect(pull.data.changes.filter((change) => change.entity === "bills").length).toBe(2);
  });
});
