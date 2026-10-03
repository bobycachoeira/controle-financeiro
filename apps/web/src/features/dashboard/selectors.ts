import {
  computeAccountBalance,
  consolidateToBRL,
  totalBalance,
  totalToPay,
  totalsByAttribution,
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
    .filter((tx) => tx.date >= today && tx.date <= limitISO)
    .reduce((sum, tx) => sum + tx.amount_cents, 0);
}

export function selectTotalToPay(transactions: LocalTransaction[]): number {
  return totalToPay(transactions as unknown as BalanceTransaction[]);
}
