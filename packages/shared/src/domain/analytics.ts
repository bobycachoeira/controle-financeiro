import { addMonths, formatISOMonth, monthOf, parseISOMonth } from "./dates";
import { merchantDisplayName, normalizeMerchantName } from "./merchant";

export interface AnalyticsTransaction {
  type: "receita" | "despesa" | "transferencia";
  status: "pago" | "a_pagar";
  amount_cents: number;
  date: string;
  account?: string;
  credit_card?: string | null;
  category?: string | null;
  merchant?: string | null;
  description?: string | null;
  deleted_at?: string | null;
}

export interface AnalyticsAccount {
  id: string;
  initial_balance_cents: number;
  include_in_total?: boolean;
  deleted_at?: string | null;
}

export interface MonthBucket {
  month: string;
  label: string;
  receitasCents: number;
  despesasCents: number;
  netCents: number;
}

const MONTHS_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function monthLabel(monthISO: string): string {
  const { month } = parseISOMonth(monthISO);
  return MONTHS_PT[month - 1] ?? monthISO;
}

export function lastMonths(endMonth: string, count: number): string[] {
  const { year, month } = parseISOMonth(endMonth);
  const result: string[] = [];
  for (let index = count - 1; index >= 0; index -= 1) {
    const shifted = addMonths(year, month, -index);
    result.push(formatISOMonth(shifted.year, shifted.month));
  }
  return result;
}

/** Receitas x Despesas por mês (inclui valores a pagar, exclui removidos). */
export function monthlyCashflow(
  transactions: readonly AnalyticsTransaction[],
  endMonth: string,
  count = 6,
): MonthBucket[] {
  const months = lastMonths(endMonth, count);
  const buckets = new Map<string, MonthBucket>(
    months.map((month) => [
      month,
      { month, label: monthLabel(month), receitasCents: 0, despesasCents: 0, netCents: 0 },
    ]),
  );
  for (const tx of transactions) {
    if (tx.deleted_at || tx.type === "transferencia") continue;
    const bucket = buckets.get(monthOf(tx.date));
    if (!bucket) continue;
    if (tx.type === "receita") bucket.receitasCents += tx.amount_cents;
    else bucket.despesasCents += tx.amount_cents;
  }
  const list = months.map((month) => buckets.get(month)!);
  for (const bucket of list) bucket.netCents = bucket.receitasCents - bucket.despesasCents;
  return list;
}

/** Evolução do saldo consolidado (contas incluídas), ao final de cada mês. */
export function balanceEvolution(
  accounts: readonly AnalyticsAccount[],
  transactions: readonly AnalyticsTransaction[],
  endMonth: string,
  count = 6,
): { month: string; label: string; balanceCents: number }[] {
  const initial = accounts
    .filter((account) => !account.deleted_at && account.include_in_total !== false)
    .reduce((total, account) => total + account.initial_balance_cents, 0);
  const months = lastMonths(endMonth, count);
  return months.map((month) => {
    const end = `${month}-31`;
    let net = 0;
    for (const tx of transactions) {
      if (tx.deleted_at || tx.date > end) continue;
      if (tx.type === "transferencia") net += tx.amount_cents;
      else if (tx.status === "pago") net += tx.type === "receita" ? tx.amount_cents : -tx.amount_cents;
    }
    return { month, label: monthLabel(month), balanceCents: initial + net };
  });
}

/** Evolução do saldo de UMA conta (aportes, rendimentos, transações). */
export function accountBalanceEvolution(
  account: AnalyticsAccount & { id: string },
  transactions: readonly AnalyticsTransaction[],
  endMonth: string,
  count = 6,
): { month: string; label: string; balanceCents: number }[] {
  const months = lastMonths(endMonth, count);
  return months.map((month) => {
    const end = `${month}-31`;
    let balance = account.initial_balance_cents;
    for (const tx of transactions) {
      if (tx.deleted_at || tx.date > end) continue;
      if (tx.account !== account.id) continue;
      if (tx.type === "transferencia") balance += tx.amount_cents;
      else if (tx.status === "pago") balance += tx.type === "receita" ? tx.amount_cents : -tx.amount_cents;
    }
    return { month, label: monthLabel(month), balanceCents: balance };
  });
}

export interface CategorySpend {
  categoryId: string | null;
  name: string;
  color: string;
  totalCents: number;
}

/** Gastos por categoria em um mês (despesas não removidas). */
export function spendingByCategory(
  transactions: readonly AnalyticsTransaction[],
  categories: readonly { id: string; name: string; color?: string | null }[],
  month: string,
  limit = 5,
): CategorySpend[] {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const totals = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.deleted_at || tx.type !== "despesa") continue;
    if (monthOf(tx.date) !== month) continue;
    // Relação vazia vinda do sync chega como "" — trata igual a sem categoria.
    const key = tx.category || "__none__";
    totals.set(key, (totals.get(key) ?? 0) + tx.amount_cents);
  }
  return [...totals.entries()]
    .map(([key, total]) => {
      const category = byId.get(key);
      return {
        categoryId: key === "__none__" ? null : key,
        name: category?.name ?? "Sem categoria",
        color: category?.color ?? "#94a3b8",
        totalCents: total,
      };
    })
    .sort((a, b) => b.totalCents - a.totalCents)
    .slice(0, limit);
}

export interface MerchantSpend {
  key: string;
  name: string;
  totalCents: number;
  count: number;
}

export interface MerchantSpendOptions {
  /** Meses no formato YYYY-MM que entram no relatório. */
  months: readonly string[];
  accountId?: string | null;
  creditCardId?: string | null;
  categoryId?: string | null;
}

/**
 * Gastos por estabelecimento no período. Lançamentos antigos (sem merchant)
 * usam a descrição como fallback; nomes são agrupados sem caixa/acentos.
 */
export function spendingByMerchant(
  transactions: readonly AnalyticsTransaction[],
  options: MerchantSpendOptions,
): MerchantSpend[] {
  const months = new Set(options.months);
  const groups = new Map<
    string,
    { name: string; totalCents: number; count: number; lastDate: string }
  >();
  for (const tx of transactions) {
    if (tx.deleted_at || tx.type !== "despesa") continue;
    if (!months.has(monthOf(tx.date))) continue;
    if (options.accountId && tx.account !== options.accountId) continue;
    if (options.creditCardId && tx.credit_card !== options.creditCardId) continue;
    if (options.categoryId && (tx.category ?? "") !== options.categoryId) continue;
    const raw = merchantDisplayName(tx);
    const key = normalizeMerchantName(raw) || "__none__";
    const name = raw || "Sem estabelecimento";
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, { name, totalCents: tx.amount_cents, count: 1, lastDate: tx.date });
      continue;
    }
    existing.totalCents += tx.amount_cents;
    existing.count += 1;
    if (tx.date >= existing.lastDate) {
      existing.lastDate = tx.date;
      existing.name = name;
    }
  }
  return [...groups.entries()]
    .map(([key, group]) => ({
      key,
      name: group.name,
      totalCents: group.totalCents,
      count: group.count,
    }))
    .sort((a, b) => b.totalCents - a.totalCents || a.name.localeCompare(b.name));
}
