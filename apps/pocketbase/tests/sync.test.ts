import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { api, operation, push, setupFamily, startHarness, type Family, type Harness } from "./harness";

function accountPayload(id: string, syncId: string, name: string) {
  return { id, household: "", sync_id: syncId, name, type: "corrente", initial_balance_cents: 0 };
}

async function createAccount(family: Family, harness: Harness): Promise<{ remoteId: string; syncId: string; localId: string }> {
  const localId = crypto.randomUUID();
  const syncId = crypto.randomUUID();
  const created = await push(harness, family.token, family.householdId, [
    operation(syncId, "accounts", "create", accountPayload(localId, syncId, "Conta"), localId),
  ]);
  const remoteId = String(created.data.results[0]?.remote_id ?? "");
  return { remoteId, syncId, localId };
}

describe("sync idempotency and conflicts", () => {
  let harness: Harness;
  let family: Family;

  beforeAll(async () => {
    harness = await startHarness();
    family = await setupFamily(harness, "sync@example.com", "Sync");
  }, 60_000);

  afterAll(async () => {
    await harness?.stop();
  });

  it("is idempotent for repeated sync_id", async () => {
    const id = crypto.randomUUID();
    const syncId = crypto.randomUUID();
    const op = operation(syncId, "accounts", "create", accountPayload(id, syncId, "Idem"));

    const first = await push(harness, family.token, family.householdId, [op]);
    expect(first.data.results[0]?.status).toBe("applied");

    const second = await push(harness, family.token, family.householdId, [op]);
    expect(second.data.results[0]?.status).toBe("applied");
    expect(second.data.results[0]?.code).toBe("idempotent");
  });

  it("keeps server version when the client timestamp is older (LWW)", async () => {
    const { remoteId, syncId, localId } = await createAccount(family, harness);

    const stale = operation(
      crypto.randomUUID(),
      "accounts",
      "update",
      accountPayload(localId, syncId, "Stale"),
      remoteId,
    );
    stale.client_ts = "2000-01-01T00:00:00.000Z";
    const conflict = await push(harness, family.token, family.householdId, [stale]);
    expect(conflict.data.results[0]?.status).toBe("conflict");
    expect(conflict.data.results[0]?.conflict).toBe(true);
    expect(conflict.data.results[0]?.code).toBe("conflict_kept_server");
  });

  it("applies the client version when its timestamp is newer", async () => {
    const { remoteId, syncId, localId } = await createAccount(family, harness);

    const fresher = operation(
      crypto.randomUUID(),
      "accounts",
      "update",
      accountPayload(localId, syncId, "After"),
      remoteId,
    );
    fresher.client_ts = new Date(Date.now() + 60_000).toISOString();
    const applied = await push(harness, family.token, family.householdId, [fresher]);
    expect(applied.data.results[0]?.status).toBe("applied");
  });

  it("discards an update to a soft-deleted record (tombstone wins)", async () => {
    const { remoteId, syncId, localId } = await createAccount(family, harness);
    await push(harness, family.token, family.householdId, [
      operation(crypto.randomUUID(), "accounts", "delete", { id: localId, sync_id: syncId }, remoteId),
    ]);

    const orphan = operation(
      crypto.randomUUID(),
      "accounts",
      "update",
      accountPayload(localId, syncId, "Zombie"),
      remoteId,
    );
    const result = await push(harness, family.token, family.householdId, [orphan]);
    expect(result.data.results[0]?.status).toBe("ignored");
    expect(result.data.results[0]?.code).toBe("orphan_update_discarded");
  });

  it("supports pull with a since cursor and returns only newer changes", async () => {
    await createAccount(family, harness);
    const firstPull = await api<{ server_seq: number; changes: Array<{ id: string }> }>(
      harness,
      `/api/sync/pull?since=0&limit=500&household=${family.householdId}`,
      { token: family.token },
    );
    expect(firstPull.data.changes.length).toBeGreaterThan(0);

    const secondPull = await api<{ server_seq: number; changes: unknown[] }>(
      harness,
      `/api/sync/pull?since=${firstPull.data.server_seq}&limit=500&household=${family.householdId}`,
      { token: family.token },
    );
    const fresh = await createAccount(family, harness);
    const thirdPull = await api<{ changes: Array<{ id: string }> }>(
      harness,
      `/api/sync/pull?since=${secondPull.data.server_seq}&limit=500&household=${family.householdId}`,
      { token: family.token },
    );
    expect(thirdPull.data.changes.some((change) => change.id === fresh.remoteId)).toBe(true);
  });

  it("keeps delete operations idempotent", async () => {
    const { remoteId, syncId, localId } = await createAccount(family, harness);
    const deleteSyncId = crypto.randomUUID();
    const del = operation(crypto.randomUUID(), "accounts", "delete", { id: localId, sync_id: syncId }, remoteId);
    const first = await push(harness, family.token, family.householdId, [del]);
    expect(first.data.results[0]?.status).toBe("applied");

    const repeated = operation(deleteSyncId, "accounts", "delete", { id: localId, sync_id: syncId }, remoteId);
    await push(harness, family.token, family.householdId, [repeated]);
    const second = await push(harness, family.token, family.householdId, [repeated]);
    expect(second.data.results[0]?.code).toBe("idempotent");
  });

  it("returns the server record on conflict", async () => {
    const { remoteId, syncId, localId } = await createAccount(family, harness);
    const stale = operation(
      crypto.randomUUID(),
      "accounts",
      "update",
      accountPayload(localId, syncId, "Stale"),
      remoteId,
    );
    stale.client_ts = "2000-01-01T00:00:00.000Z";
    const result = await push(harness, family.token, family.householdId, [stale]);
    expect(result.data.results[0]?.status).toBe("conflict");
    expect((result.data.results[0]?.record as Record<string, unknown>)?.id).toBe(remoteId);
  });

  it("includes soft deletes in pull", async () => {
    const { remoteId, syncId, localId } = await createAccount(family, harness);
    await push(harness, family.token, family.householdId, [
      operation(crypto.randomUUID(), "accounts", "delete", { id: localId, sync_id: syncId }, remoteId),
    ]);

    const pull = await api<{ changes: Array<{ id: string; deleted: boolean }> }>(
      harness,
      `/api/sync/pull?since=0&limit=500&household=${family.householdId}`,
      { token: family.token },
    );
    const change = pull.data.changes.find((item) => item.id === remoteId);
    expect(change?.deleted).toBe(true);
  });
});
