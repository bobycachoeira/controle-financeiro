import {
  computeAccountBalance,
  consolidateToBRL,
  monthOf,
  spendingByCategory,
  totalBalance,
  totalToPay,
  totalsByAttribution,
  type CategorySpend,
} from "@cf/shared";
import type { BalanceTransaction, AccountLike } from "@cf/shared";
import type { LocalAccount, LocalBill, LocalInvoice, LocalTransaction } from "@/db/schema";

export function selectTotalBalance(
  accounts: LocalAccount[],
  transactions: LocalTransaction[],
): number {
  return totalBalance(accounts as AccountLike[], transactions as unknown as BalanceTransaction[]);
}

export function selectConsolidatedBalance(
  accounts: LocalAccount[],
  transactions: LocalTransaction[],
  rates: { currency: string; date: string; rate_micros: number }[],
  today: string,
): { totalCents: number; missing: string[] } {
  const entries = accounts
    .filter((account) => !account.deleted_at)
    .map((account) => ({
      amountCents: computeAccountBalance(
        account as AccountLike,
        transactions as unknown as BalanceTransaction[],
      ),
      currency: account.currency || "BRL",
      date: today,
    }));
  return consolidateToBRL(entries, rates);
}

export function selectBalancesByAccount(
  accounts: LocalAccount[],
  transactions: LocalTransaction[],
): { account: LocalAccount; balance: number }[] {
  return accounts
    .filter((account) => !account.deleted_at)
    .map((account) => ({
      account,
      balance: computeAccountBalance(
        account as AccountLike,
        transactions as unknown as BalanceTransaction[],
      ),
    }));
}

export function selectSpendingByAttribution(
  transactions: LocalTransaction[],
): Record<string, number> {
  return totalsByAttribution(transactions as unknown as BalanceTransaction[]);
}

export interface SpendingColumn {
  key: string;
  label: string;
  totalCents: number;
}

/**
 * Colunas de "Gastos do mês": pessoas configuradas + Ambos + Indefinido.
 * Valores legados ("meu"/"dela") são mapeados para a 1ª/2ª pessoa quando as
 * chaves configuradas são outras (ex.: id do usuário).
 */
export function selectSpendingColumns(
  transactions: LocalTransaction[],
  options: readonly { key: string; label: string }[],
): SpendingColumn[] {
  const totals = selectSpendingByAttribution(transactions);
  const columns: SpendingColumn[] = options.map((option) => ({
    key: option.key,
    label: option.label,
    totalCents: totals[option.key] ?? 0,
  }));
  const known = new Set(columns.map((column) => column.key));
  let sharedCents = 0;
  let undefinedCents = 0;
  const legacy: Record<string, number> = { meu: 0, dela: 1 };
  for (const [key, value] of Object.entries(totals)) {
    if (known.has(key)) continue;
    if (key === "ambos") {
      sharedCents += value;
      continue;
    }
    const legacyIndex = legacy[key];
    const target = legacyIndex !== undefined ? columns[legacyIndex] : undefined;
    if (target) target.totalCents += value;
    else undefinedCents += value;
  }
  columns.push({ key: "ambos", label: "Ambos", totalCents: sharedCents });
  columns.push({ key: "indefinido", label: "Indefinido", totalCents: undefinedCents });
  return columns;
}

export interface CategoryBreakdownEntry extends CategorySpend {
  percentOfTotal: number;
  /** Variação vs mês anterior (null quando não havia gasto antes). */
  deltaPercent: number | null;
}

export interface CategoryBreakdown {
  entries: CategoryBreakdownEntry[];
  totalCents: number;
  /** Categoria que mais cresceu vs mês anterior (≥20%), se houver. */
  topIncrease: CategoryBreakdownEntry | null;
}

/**
 * Gastos por categoria do mês, opcionalmente filtrados por conta (ou cartão),
 * com participação no total e variação vs mês anterior.
 */
export function selectCategoryBreakdown(input: {
  transactions: LocalTransaction[];
  categories: readonly { id: string; name: string; color?: string | null }[];
  month: string;
  previousMonth: string;
  accountId?: string | null;
  limit?: number;
}): CategoryBreakdown {
  const scoped = input.accountId
    ? input.transactions.filter((tx) => tx.account === input.accountId)
    : input.transactions;
  const current = spendingByCategory(scoped, input.categories, input.month, 50);
  const previous = spendingByCategory(scoped, input.categories, input.previousMonth, 50);
  const previousByKey = new Map(
    previous.map((item) => [item.categoryId ?? "__none__", item.totalCents]),
  );
  const totalCents = current.reduce((sum, item) => sum + item.totalCents, 0);
  const entries = current.map((item) => {
    const previousCents = previousByKey.get(item.categoryId ?? "__none__") ?? 0;
    return {
      ...item,
      percentOfTotal: totalCents > 0 ? Math.round((item.totalCents / totalCents) * 100) : 0,
      deltaPercent:
        previousCents > 0
          ? Math.round(((item.totalCents - previousCents) / previousCents) * 100)
          : null,
    };
  });
  const topIncrease =
    [...entries]
      .filter((entry) => entry.deltaPercent !== null && entry.deltaPercent >= 20)
      .sort((a, b) => (b.deltaPercent ?? 0) - (a.deltaPercent ?? 0))[0] ?? null;
  return { entries: entries.slice(0, input.limit ?? 4), totalCents, topIncrease };
}

export interface CardUsageSummary {
  spentCents: number;
  percentOfSpending: number;
  openInvoicesCents: number;
  cardsCount: number;
}

/** Quanto do mês foi no cartão (e quanto há em faturas abertas). */
export function selectCardUsage(
  transactions: LocalTransaction[],
  openInvoicesCents: number,
  cardsCount: number,
  month: string,
): CardUsageSummary {
  const active = transactions.filter((tx) => !tx.deleted_at && monthOf(tx.date) === month);
  const spentCents = active
    .filter((tx) => tx.type === "despesa" && tx.credit_card)
    .reduce((sum, tx) => sum + tx.amount_cents, 0);
  const totalSpending = active
    .filter((tx) => tx.type === "despesa")
    .reduce((sum, tx) => sum + tx.amount_cents, 0);
  return {
    spentCents,
    percentOfSpending: totalSpending > 0 ? Math.round((spentCents / totalSpending) * 100) : 0,
    openInvoicesCents,
    cardsCount,
  };
}

export function selectUpcomingBills(bills: LocalBill[], today: string, days = 7): LocalBill[] {
  const limit = new Date(`${today}T00:00:00Z`);
  limit.setUTCDate(limit.getUTCDate() + days);
  const limitISO = limit.toISOString().slice(0, 10);
  return bills
    .filter((bill) => !bill.deleted_at && bill.status === "pendente")
    .filter((bill) => bill.due_date >= today && bill.due_date <= limitISO)
    .sort((a, b) => (a.due_date < b.due_date ? -1 : 1));
}

export function selectOpenInvoices(invoices: LocalInvoice[]): LocalInvoice[] {
  return invoices
    .filter(
      (invoice) =>
        !invoice.deleted_at && (invoice.status === "aberta" || invoice.status === "fechada" || invoice.status === "vencida"),
    )
    .sort((a, b) => (a.reference_month < b.reference_month ? -1 : 1));
}

export function selectRecentTransactions(
  transactions: LocalTransaction[],
  limit = 5,
): LocalTransaction[] {
  return transactions
    .filter((tx) => !tx.deleted_at)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, limit);
}

export function selectToPay30Days(transactions: LocalTransaction[], today: string): number {
  const limit = new Date(`${today}T00:00:00Z`);
  limit.setUTCDate(limit.getUTCDate() + 30);
  const limitISO = limit.toISOString().slice(0, 10);
  return transactions
    .filter((tx) => !tx.deleted_at && tx.type === "despesa" && tx.status === "a_pagar")
    // Compras do cartão entram na fatura (exibida em "Faturas abertas").
    .filter((tx) => !tx.invoice)
    .filter((tx) => tx.date >= today && tx.date <= limitISO)
    .reduce((sum, tx) => sum + tx.amount_cents, 0);
}

export function selectTotalToPay(transactions: LocalTransaction[]): number {
  return totalToPay(transactions as unknown as BalanceTransaction[]);
}
