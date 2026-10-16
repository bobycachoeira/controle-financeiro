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

  describe("trocar a forma de pagamento na edição", () => {
    async function seedCard(): Promise<void> {
      await db.credit_cards.put({
        id: "card1",
        household: "h1",
        sync_id: "s-card1",
        account: "cardacc",
        bank: "Nubank",
        limit_cents: 500000,
        currency: "BRL",
        closing_day: 15,
        due_day: 25,
        purchase_at_posting: false,
        uses_account_balance_for_invoice: false,
        active: true,
        order: 0,
        color: null,
        payment_account: null,
        owner: "indefinido",
        updated_by: null,
        deleted_at: null,
      });
    }

    it("attachToCard cria a parcela 1/1 e vincula a fatura", async () => {
      await seedCard();
      const store = useTransactionsStore();
      const created = await store.create({
        account: "a1",
        amount_cents: 8000,
        type: "despesa",
        date: "2026-10-14",
        attribution: "ambos",
        description: "Aluguel",
        status: "pago",
      });

      await store.attachToCard(created.id, {
        credit_card: "card1",
        closing_day: 15,
        due_day: 25,
        date: "2026-10-14",
      });

      const tx = await db.transactions.get(created.id);
      expect(tx?.credit_card).toBe("card1");
      expect(tx?.account).toBe("cardacc");
      expect(tx?.status).toBe("a_pagar");
      expect(tx?.invoice).toBeTruthy();
      const installments = await db.installments.where("root_transaction").equals(created.id).toArray();
      expect(installments).toHaveLength(1);
      expect(installments[0]).toMatchObject({ number: 1, total: 1, amount_cents: 8000 });
      const invoice = await db.invoices.get(tx!.invoice!);
      expect(invoice?.total_cents).toBe(8000);
    });

    it("detachFromCard remove as parcelas e devolve o gasto para a conta", async () => {
      await seedCard();
      const store = useTransactionsStore();
      const created = await store.create({
        account: "a1",
        amount_cents: 4500,
        type: "despesa",
        date: "2026-10-14",
        attribution: "ambos",
        description: "Presente",
        status: "pago",
      });
      await store.attachToCard(created.id, {
        credit_card: "card1",
        closing_day: 15,
        due_day: 25,
        date: "2026-10-14",
      });
      const withInvoice = await db.transactions.get(created.id);

      await store.detachFromCard(created.id, { account: "a1", status: "pago" });

      const tx = await db.transactions.get(created.id);
      expect(tx?.credit_card).toBeNull();
      expect(tx?.invoice).toBeNull();
      expect(tx?.status).toBe("pago");
      expect(tx?.account).toBe("a1");
      const active = (
        await db.installments.where("root_transaction").equals(created.id).toArray()
      ).filter((row) => !row.deleted_at);
      expect(active).toHaveLength(0);
      const invoice = await db.invoices.get(withInvoice!.invoice!);
      expect(invoice?.total_cents).toBe(0);
    });
  });
});
