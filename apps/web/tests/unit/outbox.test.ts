import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/schema";
import { createLocal, softDeleteLocal, updateLocal } from "@/db/repositories";
import {
  countPending,
  listPending,
  markSending,
  resetStaleSending,
} from "@/sync/outbox";

function accountRecord(id: string) {
  return {
    id,
    household: "h1",
    sync_id: `sync-${id}`,
    name: id,
    type: "corrente" as const,
    currency: "BRL",
    initial_balance_cents: 0,
    include_in_total: true,
    active: true,
    order: 0,
    updated_by: null,
    deleted_at: null,
  };
}

describe("outbox", () => {
  beforeEach(async () => {
    await db.outbox.clear();
    await db.accounts.clear();
  });

  it("enqueues creates with FIFO ordering", async () => {
    await createLocal("accounts", accountRecord("a1"));
    await createLocal("accounts", accountRecord("a2"));
    const items = await listPending();
    expect(items).toHaveLength(2);
    expect(items[0]?.entity).toBe("accounts");
    expect(items[0]?.operation).toBe("create");
    expect(items[0]?.entity_id).toBe("a1");
    expect(items[1]?.entity_id).toBe("a2");
  });

  it("marks records dirty and tracks the pending outbox id", async () => {
    const record = (await createLocal("accounts", accountRecord("a1"))) as unknown as {
      _dirty?: boolean;
      _pendingOutboxId?: number;
    };
    expect(record._dirty).toBe(true);
    expect(record._pendingOutboxId).toBeDefined();
  });

  it("enqueues a delete tombstone", async () => {
    await createLocal("accounts", accountRecord("a1"));
    await db.outbox.clear();
    await softDeleteLocal("accounts", "a1");
    const items = await listPending();
    expect(items).toHaveLength(1);
    expect(items[0]?.operation).toBe("delete");
    const stored = await db.accounts.get("a1");
    expect(stored?.deleted_at).toBeTruthy();
  });

  it("counts pending items", async () => {
    await createLocal("accounts", accountRecord("a1"));
    expect(await countPending()).toBe(1);
  });

  it("coalesces a pending create with later edits into a single create", async () => {
    const created = await createLocal("accounts", accountRecord("a1"));
    await updateLocal("accounts", { ...created, name: "Editada" });
    const items = await listPending();
    expect(items).toHaveLength(1);
    expect(items[0]?.operation).toBe("create");
    expect((items[0]?.payload as { name: string }).name).toBe("Editada");
  });

  it("coalesces consecutive pending updates into the last one", async () => {
    await createLocal("accounts", accountRecord("a1"));
    await db.outbox.clear();
    await updateLocal("accounts", { ...(await db.accounts.get("a1"))!, name: "v2" });
    await updateLocal("accounts", { ...(await db.accounts.get("a1"))!, name: "v3" });
    const items = await listPending();
    expect(items).toHaveLength(1);
    expect(items[0]?.operation).toBe("update");
    expect((items[0]?.payload as { name: string }).name).toBe("v3");
  });

  it("drops the pending create when the record is deleted before syncing", async () => {
    await createLocal("accounts", accountRecord("a1"));
    await softDeleteLocal("accounts", "a1");
    expect(await listPending()).toHaveLength(0);
    const stored = await db.accounts.get("a1");
    expect(stored?.deleted_at).toBeTruthy();
    expect(stored?._dirty).toBeFalsy();
    expect(stored?._pendingOutboxId).toBeUndefined();
  });

  it("does not coalesce into an item that may have been sent", async () => {
    const created = await createLocal("accounts", accountRecord("a1"));
    const sent = (await listPending())[0]!;
    await markSending(sent.id!);
    expect(await listPending()).toHaveLength(0);
    expect(await resetStaleSending()).toBe(1);
    await updateLocal("accounts", { ...created, name: "Editada" });
    const items = await listPending();
    expect(items).toHaveLength(2);
    expect(items[1]?.operation).toBe("update");
    expect((items[1]?.payload as { name: string }).name).toBe("Editada");
  });
});
