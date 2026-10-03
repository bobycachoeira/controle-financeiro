import type { Attribution } from "../constants/domain";

export interface BalanceTransaction {
  type: "receita" | "despesa" | "transferencia";
  status: "pago" | "a_pagar";
  amount_cents: number;
  attribution: Attribution;
  account: string;
  deleted_at?: string | null;
}

export interface AccountLike {
  id: string;
  initial_balance_cents: number;
  include_in_total?: boolean;
  deleted_at?: string | null;
}

export function isActive(record: { deleted_at?: string | null }): boolean {
  return !record.deleted_at;
}

export function computeAccountBalance(
  account: AccountLike,
  transactions: readonly BalanceTransaction[],
): number {
  let balance = account.initial_balance_cents;
  for (const tx of transactions) {
    if (!isActive(tx)) continue;
    if (tx.account !== account.id) continue;
    if (tx.type === "transferencia") {
      balance += tx.amount_cents;
      continue;
    }
    if (tx.status !== "pago") continue;
    balance += tx.type === "receita" ? tx.amount_cents : -tx.amount_cents;
  }
  return balance;
}

export function totalBalance(
  accounts: readonly AccountLike[],
  transactions: readonly BalanceTransaction[],
): number {
  return accounts
    .filter((account) => isActive(account) && account.include_in_total !== false)
    .reduce((total, account) => total + computeAccountBalance(account, transactions), 0);
}

export interface AttributionTotals {
  meu: number;
  dela: number;
  ambos: number;
  indefinido: number;
}

export function totalsByAttribution(
  transactions: readonly BalanceTransaction[],
): AttributionTotals {
  const totals: AttributionTotals = { meu: 0, dela: 0, ambos: 0, indefinido: 0 };
  for (const tx of transactions) {
    if (!isActive(tx)) continue;
    if (tx.type !== "despesa") continue;
    totals[tx.attribution] += tx.amount_cents;
  }
  return totals;
}

export function totalNetForAttribution(
  transactions: readonly BalanceTransaction[],
  attribution: Attribution,
): number {
  let net = 0;
  for (const tx of transactions) {
    if (!isActive(tx)) continue;
    if (tx.type === "transferencia" || tx.attribution !== attribution) continue;
    net += tx.type === "receita" ? tx.amount_cents : -tx.amount_cents;
  }
  return net;
}

export function totalToPay(transactions: readonly BalanceTransaction[]): number {
  return transactions
    .filter((tx) => isActive(tx) && tx.type === "despesa" && tx.status === "a_pagar")
    .reduce((total, tx) => total + tx.amount_cents, 0);
}
