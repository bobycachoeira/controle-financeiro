import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { api, operation, push, setupFamily, startHarness, type Family, type Harness } from "./harness";

describe("household isolation", () => {
  let harness: Harness;
  let familyA: Family;
  let familyB: Family;

  beforeAll(async () => {
    harness = await startHarness();
    familyA = await setupFamily(harness, "a@example.com", "A");
    familyB = await setupFamily(harness, "b@example.com", "B");
  }, 60_000);

  afterAll(async () => {
    await harness?.stop();
  });

  it("seeds default categories for a new household", async () => {
    const pull = await api<{ changes: Array<{ entity: string }> }>(
      harness,
      `/api/sync/pull?since=0&limit=500&household=${familyA.householdId}`,
      { token: familyA.token },
    );
    expect(pull.status).toBe(200);
    const categoryChanges = pull.data.changes.filter((change) => change.entity === "categories");
    expect(categoryChanges.length).toBeGreaterThanOrEqual(20);
  });

  it("denies a household B user from pushing into household A", async () => {
    const response = await push(harness, familyB.token, familyA.householdId, [
      operation(crypto.randomUUID(), "accounts", "create", {
        id: crypto.randomUUID(),
        name: "Intrusa",
        type: "corrente",
      }),
    ]);
    expect(response.status).toBe(403);
  });

  it("denies a household B user from pulling household A data", async () => {
    const pull = await api(harness, `/api/sync/pull?since=0&limit=100&household=${familyA.householdId}`, {
      token: familyB.token,
    });
    expect(pull.status).toBe(403);
  });

  it("keeps each household data separate when pushing", async () => {
    const accountId = crypto.randomUUID();
    const created = await push(harness, familyA.token, familyA.householdId, [
      operation(accountId, "accounts", "create", {
        id: accountId,
        name: "Conta A",
        type: "corrente",
        initial_balance_cents: 1000,
      }),
    ]);
    expect(created.status).toBe(200);
    expect(created.data.results[0]?.status).toBe("applied");

    const pullB = await api<{ changes: Array<{ id: string }> }>(
      harness,
      `/api/sync/pull?since=0&limit=500&household=${familyB.householdId}`,
      { token: familyB.token },
    );
    expect(pullB.data.changes.some((change) => change.id === accountId)).toBe(false);
  });
});
