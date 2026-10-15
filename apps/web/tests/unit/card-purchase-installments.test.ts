import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { db } from "@/db/schema";
import { useSessionStore } from "@/stores/session";
import { useTransactionsStore } from "@/stores/transactions";

describe("compra no cartão com parcelas em andamento", () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    await db.transactions.clear();
    await db.installments.clear();
    await db.invoices.clear();
    await db.outbox.clear();
    useSessionStore().setHousehold("h1");
  });

  it("cria só as parcelas restantes, numeradas e no ciclo certo", async () => {
    const store = useTransactionsStore();
    await store.createCardPurchase({
      account: "cardacc",
      credit_card: "card1",
      amount_cents: 25000,
      date: "2026-10-14",
      attribution: "ambos",
      status: "a_pagar",
      installments: 10,
      paid_installments: 6,
      closing_day: 15,
      due_day: 25,
    });

    const transactions = await db.transactions.toArray();
    expect(transactions).toHaveLength(4);
    expect(transactions.map((tx) => tx.amount_cents)).toEqual([25000, 25000, 25000, 25000]);

    const installments = (await db.installments.toArray()).sort((a, b) => a.number - b.number);
    expect(installments.map((row) => `${row.number}/${row.total}`)).toEqual([
      "7/10",
      "8/10",
      "9/10",
      "10/10",
    ]);

    const invoices = await db.invoices.toArray();
    expect(invoices.map((invoice) => invoice.reference_month).sort()).toEqual(
      ["2026-10", "2026-11", "2026-12", "2027-01"].sort(),
    );
  });

  it("mantém o comportamento antigo quando não há parcelas pagas", async () => {
    const store = useTransactionsStore();
    await store.createCardPurchase({
      account: "cardacc",
      credit_card: "card1",
      amount_cents: 100000,
      date: "2026-10-14",
      attribution: "ambos",
      status: "a_pagar",
      installments: 2,
      closing_day: 15,
      due_day: 25,
    });

    const installments = (await db.installments.toArray()).sort((a, b) => a.number - b.number);
    expect(installments.map((row) => `${row.number}/${row.total}`)).toEqual(["1/2", "2/2"]);
    expect(installments.reduce((sum, row) => sum + row.amount_cents, 0)).toBe(100000);
  });

  it("remove a compra inteira: apaga todas as parcelas e zera as faturas", async () => {
    const store = useTransactionsStore();
    await store.createCardPurchase({
      account: "cardacc",
      credit_card: "card1",
      amount_cents: 30000,
      date: "2026-10-14",
      attribution: "ambos",
      status: "a_pagar",
      installments: 3,
      closing_day: 15,
      due_day: 25,
    });
    const transactions = await db.transactions.toArray();
    expect(transactions).toHaveLength(3);
    const before = await db.invoices.toArray();
    expect(before.every((invoice) => invoice.total_cents === 10000)).toBe(true);

    const removed = await store.removePurchase(transactions[0]!.id);
    expect(removed).toBe(3);
    expect((await db.transactions.toArray()).filter((tx) => !tx.deleted_at)).toHaveLength(0);
    expect((await db.installments.toArray()).every((row) => row.deleted_at)).toBe(true);
    const after = await db.invoices.toArray();
    expect(after.every((invoice) => invoice.total_cents === 0)).toBe(true);
  });
});
