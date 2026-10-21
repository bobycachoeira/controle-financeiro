import { describe, expect, it } from "vitest";
import type { LocalAccount, LocalBill, LocalInvoice, LocalTransaction } from "@/db/schema";
import {
  selectBalancesByAccount,
  selectCardUsage,
  selectCategoryBreakdown,
  selectOpenInvoices,
  selectRecentTransactions,
  selectSpendingByAttribution,
  selectSpendingColumns,
  selectToPay30Days,
  selectTotalBalance,
  selectUpcomingBills,
} from "@/features/dashboard/selectors";

function account(partial: Partial<LocalAccount> & { id: string }): LocalAccount {
  return {
    household: "h1",
    sync_id: `s-${partial.id}`,
    name: partial.id,
    type: "corrente",
    currency: "BRL",
    initial_balance_cents: 0,
    include_in_total: true,
    active: true,
    order: 0,
    owner: "indefinido",
    updated_by: null,
    deleted_at: null,
    ...partial,
  };
}

function tx(partial: Partial<LocalTransaction> & { id: string; amount_cents: number }): LocalTransaction {
  return {
    household: "h1",
    sync_id: `s-${partial.id}`,
    account: "a1",
    credit_card: null,
    currency: "BRL",
    type: "despesa",
    date: "2024-03-10",
    attribution: "meu",
    status: "pago",
    merchant: "",
    description: "",
    tags: [],
    note: "",
    origin: "manual",
    external_ref: null,
    updated_by: null,
    deleted_at: null,
    ...partial,
  };
}

describe("dashboard selectors", () => {
  const accounts = [account({ id: "a1", initial_balance_cents: 1000 })];
  const transactions = [
    tx({ id: "t1", amount_cents: 500, type: "receita" }),
    tx({ id: "t2", amount_cents: 200 }),
  ];

  it("selects total balance and per-account balances", () => {
    expect(selectTotalBalance(accounts, transactions)).toBe(1300);
    expect(selectBalancesByAccount(accounts, transactions)[0]?.balance).toBe(1300);
  });

  it("aggregates spending by attribution", () => {
    const spending = selectSpendingByAttribution(transactions);
    expect(spending.meu).toBe(200);
  });

  it("builds spending columns with legacy mapping, Ambos and Indefinido", () => {
    const options = [
      { key: "u1", label: "Paulo" },
      { key: "u2", label: "Maria" },
    ];
    const list = [
      tx({ id: "s1", amount_cents: 100, attribution: "u1" }),
      tx({ id: "s2", amount_cents: 200, attribution: "meu" }),
      tx({ id: "s3", amount_cents: 300, attribution: "dela" }),
      tx({ id: "s4", amount_cents: 400, attribution: "ambos" }),
      tx({ id: "s5", amount_cents: 500, attribution: "indefinido" }),
    ];
    const columns = selectSpendingColumns(list, options);
    expect(columns.map((column) => [column.key, column.totalCents])).toEqual([
      ["u1", 300],
      ["u2", 300],
      ["ambos", 400],
      ["indefinido", 500],
    ]);
  });

  it("filters upcoming bills within 7 days", () => {
    const bills: LocalBill[] = [
      { id: "b1", due_date: "2024-03-12", status: "pendente" } as LocalBill,
      { id: "b2", due_date: "2024-03-30", status: "pendente" } as LocalBill,
      { id: "b3", due_date: "2024-03-13", status: "pago" } as LocalBill,
    ];
    const upcoming = selectUpcomingBills(bills, "2024-03-10", 7);
    expect(upcoming.map((bill) => bill.id)).toEqual(["b1"]);
  });

  it("selects open invoices only", () => {
    const invoices: LocalInvoice[] = [
      { id: "i1", status: "aberta", reference_month: "2024-03" } as LocalInvoice,
      { id: "i2", status: "paga", reference_month: "2024-02" } as LocalInvoice,
    ];
    expect(selectOpenInvoices(invoices).map((invoice) => invoice.id)).toEqual(["i1"]);
  });

  it("returns recent transactions sorted desc and limited", () => {
    const list = [
      tx({ id: "old", amount_cents: 1, date: "2024-01-01" }),
      tx({ id: "new", amount_cents: 1, date: "2024-03-20" }),
    ];
    expect(selectRecentTransactions(list, 1)[0]?.id).toBe("new");
  });

  it("sums to-pay transactions in the next 30 days", () => {
    const list = [
      tx({ id: "p1", amount_cents: 100, status: "a_pagar", date: "2024-03-15" }),
      tx({ id: "p2", amount_cents: 100, status: "a_pagar", date: "2024-06-15" }),
      tx({ id: "p3", amount_cents: 200, status: "a_pagar", date: "2024-03-20", invoice: "inv1" }),
    ];
    expect(selectToPay30Days(list, "2024-03-10")).toBe(100);
  });

  it("monta o breakdown por categoria com filtro de conta e variação", () => {
    const categories = [{ id: "food", name: "Alimentação", color: "#f97316" }];
    const list = [
      tx({ id: "a1", amount_cents: 10000, category: "food", account: "a1", date: "2024-03-05" }),
      tx({ id: "a2", amount_cents: 5000, category: "food", account: "a2", date: "2024-03-06" }),
      tx({ id: "a3", amount_cents: 8000, category: "food", account: "a1", date: "2024-02-05" }),
    ];
    const all = selectCategoryBreakdown({
      transactions: list,
      categories,
      month: "2024-03",
      previousMonth: "2024-02",
    });
    expect(all.totalCents).toBe(15000);
    expect(all.entries[0]).toMatchObject({
      name: "Alimentação",
      totalCents: 15000,
      percentOfTotal: 100,
      deltaPercent: 88,
    });

    const scoped = selectCategoryBreakdown({
      transactions: list,
      categories,
      month: "2024-03",
      previousMonth: "2024-02",
      accountId: "a1",
    });
    expect(scoped.totalCents).toBe(10000);
    expect(scoped.entries[0]?.deltaPercent).toBe(25);
    expect(scoped.topIncrease?.deltaPercent).toBe(25);
  });

  it("resume o uso do cartão e o percentual dos gastos", () => {
    const list = [
      tx({ id: "c1", amount_cents: 6000, credit_card: "card1", account: "cardacc", date: "2024-03-10" }),
      tx({ id: "c2", amount_cents: 4000, account: "a1", date: "2024-03-11" }),
      tx({ id: "c3", amount_cents: 9999, credit_card: "card1", account: "cardacc", date: "2024-02-10" }),
      tx({
        id: "c4",
        amount_cents: 1000,
        credit_card: "card1",
        account: "cardacc",
        type: "receita",
        date: "2024-03-12",
      }),
    ];
    const usage = selectCardUsage(list, 5000, 1, "2024-03");
    expect(usage.spentCents).toBe(6000);
    expect(usage.percentOfSpending).toBe(60);
    expect(usage.openInvoicesCents).toBe(5000);
  });
});
