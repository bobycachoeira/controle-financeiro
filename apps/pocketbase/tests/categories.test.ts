import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { api, operation, push, setupFamily, startHarness, type Family, type Harness } from "./harness";

describe("categories", () => {
  let harness: Harness;
  let family: Family;

  beforeAll(async () => {
    harness = await startHarness();
    family = await setupFamily(harness, "cat@example.com", "Cat");
  }, 60_000);

  afterAll(async () => {
    await harness?.stop();
  });

  it("does not allow deleting a system category", async () => {
    const pull = await api<{ changes: Array<{ entity: string; id: string; record?: Record<string, unknown> }> }>(
      harness,
      `/api/sync/pull?since=0&limit=500&household=${family.householdId}`,
      { token: family.token },
    );
    const systemCategory = pull.data.changes.find(
      (change) => change.entity === "categories" && change.record?.system === true,
    );
    expect(systemCategory).toBeTruthy();

    const result = await push(harness, family.token, family.householdId, [
      operation(
        crypto.randomUUID(),
        "categories",
        "delete",
        { id: systemCategory?.id },
        systemCategory?.id,
      ),
    ]);
    expect(result.data.results[0]?.status).toBe("error");
    expect(result.data.results[0]?.code).toBe("system_category");
  });

  it("allows deleting a custom category", async () => {
    const localId = crypto.randomUUID();
    const syncId = crypto.randomUUID();
    const created = await push(harness, family.token, family.householdId, [
      operation(
        syncId,
        "categories",
        "create",
        {
          id: localId,
          household: "",
          sync_id: syncId,
          name: "Custom",
          kind: "saida",
          group: "Custom",
          system: false,
        },
        localId,
      ),
    ]);
    const remoteId = String(created.data.results[0]?.remote_id ?? "");
    const deleted = await push(harness, family.token, family.householdId, [
      operation(crypto.randomUUID(), "categories", "delete", { id: localId }, remoteId),
    ]);
    expect(deleted.data.results[0]?.status).toBe("applied");
  });
});
