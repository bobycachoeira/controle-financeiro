import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { api, operation, push, setupFamily, startHarness, type Family, type Harness } from "./harness";

function recurrencePayload(id: string, syncId: string, template: Record<string, unknown>) {
  return {
    id,
    household: "",
    sync_id: syncId,
    name: "Aluguel",
    rrule: "FREQ=MONTHLY;INTERVAL=1",
    start_date: "2024-01-05",
    active: true,
    target: "transaction",
    creates_status: "a_pagar",
    template: {
      amount_cents: 100000,
      type: "despesa",
      account: template.account,
      attribution: "ambos",
      description: "Aluguel",
    },
  };
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

describe("recurrences", () => {
  let harness: Harness;
  let family: Family;
  let accountId: string;

  beforeAll(async () => {
    harness = await startHarness();
    family = await setupFamily(harness, "rec@example.com", "Rec");
    accountId = await createAccount(harness, family);
  }, 60_000);

  afterAll(async () => {
    await harness?.stop();
  });

  it("syncs a recurrence and its budget via push/pull", async () => {
    const id = crypto.randomUUID();
    const syncId = crypto.randomUUID();
    const created = await push(harness, family.token, family.householdId, [
      operation(syncId, "recurrences", "create", recurrencePayload(id, syncId, { account: accountId }), id),
    ]);
    expect(created.data.results[0]?.status).toBe("applied");

    const budgetId = crypto.randomUUID();
    const budgetSync = crypto.randomUUID();
    const budget = await push(harness, family.token, family.householdId, [
      operation(
        budgetSync,
        "budgets",
        "create",
        {
          id: budgetId,
          household: "",
          sync_id: budgetSync,
          name: "Alimentação",
          period: "mensal",
          total_cents: 150000,
          alert_pct: 80,
          reference_month: "2024-03",
          categories: [],
        },
        budgetId,
      ),
    ]);
    // budgets require at least one category
    expect(budget.data.results[0]?.status).toBe("error");

    const pull = await api<{ changes: Array<{ entity: string; id: string }> }>(
      harness,
      `/api/sync/pull?since=0&limit=500&household=${family.householdId}`,
      { token: family.token },
    );
    expect(pull.data.changes.some((change) => change.entity === "recurrences" && change.id !== "")).toBe(
      true,
    );
  });

  it("rejects an invalid rrule", async () => {
    const id = crypto.randomUUID();
    const syncId = crypto.randomUUID();
    const result = await push(harness, family.token, family.householdId, [
      operation(
        syncId,
        "recurrences",
        "create",
        { ...recurrencePayload(id, syncId, { account: accountId }), rrule: "INTERVAL=2" },
        id,
      ),
    ]);
    expect(result.data.results[0]?.status).toBe("error");
    expect(result.data.results[0]?.code).toBe("validation_error");
  });
});
