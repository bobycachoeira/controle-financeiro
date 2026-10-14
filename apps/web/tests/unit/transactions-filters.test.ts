import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { db, type LocalTransaction } from "@/db/schema";
import { useSessionStore } from "@/stores/session";
import { useTransactionsStore } from "@/stores/transactions";

function tx(partial: Partial<LocalTransaction> & { id: string }): LocalTransaction {
  return {
    household: "h1",
    sync_id: `s-${partial.id}`,
    account: "a1",
    credit_card: null,
    amount_cents: 1000,
    currency: "BRL",
    type: "despesa",
    date: "2026-10-10",
    attribution: "meu",
    category: "food",
    description: "",
    status: "pago",
    tags: [],
    note: "",
    origin: "manual",
    updated_by: null,
    deleted_at: null,
    ...partial,
  };
}

describe("filtros de lançamentos", () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    await db.transactions.clear();
    useSessionStore().setHousehold("h1");
  });

  it("filtra por busca, tipo, categoria e etiqueta", async () => {
    await db.transactions.bulkPut([
      tx({
        id: "t1",
        description: "Mercado da semana",
        tags: ["casa"],
        category: "food",
        amount_cents: 5000,
      }),
      tx({ id: "t2", description: "Salário", type: "receita", category: null, note: "empresa" }),
      tx({ id: "t3", description: "Café", category: "food", tags: ["lazer"] }),
    ]);
    const store = useTransactionsStore();

    await store.load({ query: "mercado" });
    expect(store.items.map((item) => item.id)).toEqual(["t1"]);

    await store.load({ query: "empresa" });
    expect(store.items.map((item) => item.id)).toEqual(["t2"]);

    await store.load({ type: "receita" });
    expect(store.items.map((item) => item.id)).toEqual(["t2"]);

    await store.load({ category: "food" });
    expect(store.items.map((item) => item.id).sort()).toEqual(["t1", "t3"]);

    await store.load({ tag: "lazer" });
    expect(store.items.map((item) => item.id)).toEqual(["t3"]);

    await store.load({ query: "casa" });
    expect(store.items.map((item) => item.id)).toEqual(["t1"]);
  });
});
