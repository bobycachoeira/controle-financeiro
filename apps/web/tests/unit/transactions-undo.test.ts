import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { db } from "@/db/schema";
import { useSessionStore } from "@/stores/session";
import { useTransactionsStore } from "@/stores/transactions";

describe("desfazer exclusão", () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    await db.transactions.clear();
    await db.installments.clear();
    await db.invoices.clear();
    await db.outbox.clear();
    useSessionStore().setHousehold("h1");
  });

  it("remove devolve o registro removido e restore recria com novo id/sync_id", async () => {
    const store = useTransactionsStore();
    const created = await store.create({
      account: "a1",
      amount_cents: 1500,
      type: "despesa",
      date: "2026-10-14",
      attribution: "ambos",
      description: "Café",
      status: "pago",
    });

    const removed = await store.remove(created.id);
    expect(removed?.id).toBe(created.id);
    expect(removed?.description).toBe("Café");
    let active = (await db.transactions.toArray()).filter((tx) => !tx.deleted_at);
    expect(active).toHaveLength(0);

    const restored = await store.restore(removed!);
    expect(restored.id).not.toBe(created.id);
    expect(restored.sync_id).not.toBe(created.sync_id);
    expect(restored.description).toBe("Café");
    expect(restored.deleted_at).toBeNull();
    active = (await db.transactions.toArray()).filter((tx) => !tx.deleted_at);
    expect(active).toHaveLength(1);

    const outbox = await db.outbox.toArray();
    const createOp = outbox.find(
      (item) =>
        item.entity === "transactions" &&
        item.operation === "create" &&
        item.entity_id === restored.id,
    );
    expect(createOp).toBeTruthy();
  });

  it("remove de lançamento inexistente devolve null", async () => {
    const store = useTransactionsStore();
    expect(await store.remove("nao-existe")).toBeNull();
  });
});
