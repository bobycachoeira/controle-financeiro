import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { db, type LocalAccount, type LocalCreditCard } from "@/db/schema";
import { useAccountsStore } from "@/stores/accounts";
import { useCardsStore } from "@/stores/cards";
import { useSessionStore } from "@/stores/session";

function account(id: string, name: string, order: number): LocalAccount {
  return {
    id,
    household: "h1",
    sync_id: `sync-${id}`,
    name,
    type: "corrente",
    currency: "BRL",
    initial_balance_cents: 0,
    include_in_total: true,
    active: true,
    order,
    color: null,
    icon: null,
    owner: "indefinido",
    updated_by: null,
    deleted_at: null,
  };
}

function card(id: string, bank: string, order: number): LocalCreditCard {
  return {
    id,
    household: "h1",
    sync_id: `sync-${id}`,
    account: `acc-${id}`,
    bank,
    limit_cents: 0,
    currency: "BRL",
    closing_day: 10,
    due_day: 20,
    purchase_at_posting: false,
    uses_account_balance_for_invoice: false,
    active: true,
    order,
    color: null,
    payment_account: null,
    owner: "indefinido",
    updated_by: null,
    deleted_at: null,
  };
}

describe("reordenação da carteira", () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    await db.accounts.clear();
    await db.credit_cards.clear();
    await db.outbox.clear();
    useSessionStore().setHousehold("h1");
  });

  it("move uma conta para cima e persiste a nova ordem", async () => {
    await db.accounts.bulkPut([account("a", "A", 0), account("b", "B", 1), account("c", "C", 2)]);
    const store = useAccountsStore();
    await store.load();
    expect(store.items.map((item) => item.id)).toEqual(["a", "b", "c"]);

    await store.move("c", -1);
    expect(store.items.map((item) => item.id)).toEqual(["a", "c", "b"]);
    expect((await db.accounts.get("c"))?.order).toBe(1);
    expect((await db.accounts.get("b"))?.order).toBe(2);
  });

  it("não move além dos limites da lista", async () => {
    await db.accounts.bulkPut([account("a", "A", 0), account("b", "B", 1)]);
    const store = useAccountsStore();
    await store.load();

    await store.move("a", -1);
    await store.move("b", 1);
    expect(store.items.map((item) => item.id)).toEqual(["a", "b"]);
  });

  it("normaliza ordens iguais ao mover um cartão", async () => {
    await db.credit_cards.bulkPut([card("x", "X", 0), card("y", "Y", 0), card("z", "Z", 0)]);
    const store = useCardsStore();
    await store.load();
    expect(store.cards.map((item) => item.id)).toEqual(["x", "y", "z"]);

    await store.move("z", -1);
    expect(store.cards.map((item) => item.id)).toEqual(["x", "z", "y"]);
    expect((await db.credit_cards.get("z"))?.order).toBe(1);
    expect((await db.credit_cards.get("y"))?.order).toBe(2);
  });
});
