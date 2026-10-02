import { describe, expect, it } from "vitest";
import type { LocalAccount, LocalBill, LocalInvoice, LocalTransaction } from "@/db/schema";
import {
  selectBalancesByAccount,
  selectOpenInvoices,
  selectRecentTransactions,
  selectSpendingByAttribution,
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
    description: "",
    tags: [],
    note: "",
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
    ];
    expect(selectToPay30Days(list, "2024-03-10")).toBe(100);
  });
});
