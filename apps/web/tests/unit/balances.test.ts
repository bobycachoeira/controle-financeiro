import { describe, expect, it } from "vitest";
import { computeAccountBalance, totalBalance, totalsByAttribution } from "@cf/shared";
import type { AccountLike, BalanceTransaction } from "@cf/shared";

const accounts: AccountLike[] = [
  { id: "a1", initial_balance_cents: 10000 },
  { id: "a2", initial_balance_cents: 0 },
];

const transactions: BalanceTransaction[] = [
  {
    type: "receita",
    status: "pago",
    amount_cents: 5000,
    attribution: "meu",
    account: "a1",
  },
  {
    type: "despesa",
    status: "pago",
    amount_cents: 2000,
    attribution: "meu",
    account: "a1",
  },
  {
    type: "despesa",
    status: "a_pagar",
    amount_cents: 9999,
    attribution: "dela",
    account: "a1",
  },
  {
    type: "transferencia",
    status: "pago",
    amount_cents: 3000,
    attribution: "indefinido",
    account: "a1",
  },
];

describe("balances", () => {
  it("computes balance from initial + paid income - paid expenses", () => {
    expect(computeAccountBalance(accounts[0] as AccountLike, transactions)).toBe(13000);
  });

  it("ignores unpaid and transfer transactions in totals", () => {
    expect(totalBalance(accounts, transactions)).toBe(13000);
  });

  it("aggregates spending by attribution for all expenses in the month", () => {
    const totals = totalsByAttribution(transactions);
    expect(totals.meu).toBe(2000);
    expect(totals.dela).toBe(9999);
  });
});
