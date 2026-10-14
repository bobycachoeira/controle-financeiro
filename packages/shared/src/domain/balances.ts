export interface BalanceTransaction {
  type: "receita" | "despesa" | "transferencia";
  status: "pago" | "a_pagar";
  amount_cents: number;
  attribution: string;
  account: string;
  /** Preenchido quando a compra está vinculada a uma fatura de cartão. */
  invoice?: string | null;
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

export function totalsByAttribution(
  transactions: readonly BalanceTransaction[],
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const tx of transactions) {
    if (!isActive(tx)) continue;
    if (tx.type !== "despesa") continue;
    totals[tx.attribution] = (totals[tx.attribution] ?? 0) + tx.amount_cents;
  }
  return totals;
}

export function totalNetForAttribution(
  transactions: readonly BalanceTransaction[],
  attribution: string,
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
    // Compras no cartão são um compromisso da fatura, não um "a pagar" solto
    // (senão o mesmo valor apareceria duas vezes no painel).
    .filter((tx) => !tx.invoice)
    .reduce((total, tx) => total + tx.amount_cents, 0);
}
