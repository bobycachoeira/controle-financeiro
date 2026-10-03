import { addMonths, daysInMonth, pad2, parseISOMonth } from "./dates";

export type BudgetPeriod = "mensal" | "trimestral" | "anual";

export interface BudgetCategory {
  category: string;
  limit_cents?: number;
}

export interface BudgetLike {
  id: string;
  total_cents: number;
  alert_pct: number;
  period: BudgetPeriod;
  reference_month: string;
  categories: BudgetCategory[];
  active?: boolean;
  deleted_at?: string | null;
}

export interface BudgetTransaction {
  type: "receita" | "despesa" | "transferencia";
  amount_cents: number;
  category?: string | null;
  date: string;
  deleted_at?: string | null;
}

export interface BudgetUsage {
  start: string;
  end: string;
  spentCents: number;
  remainingCents: number;
  percent: number;
  status: "ok" | "alerta" | "estouro";
  perCategory: { category: string; spentCents: number; limitCents?: number; percentOfTotal: number }[];
}

export function budgetPeriodRange(
  period: BudgetPeriod,
  referenceMonth: string,
): { start: string; end: string } {
  const { year, month } = parseISOMonth(referenceMonth);
  const months = period === "mensal" ? 1 : period === "trimestral" ? 3 : 12;
  const last = addMonths(year, month, months - 1);
  const lastDay = daysInMonth(last.year, last.month);
  return {
    start: `${referenceMonth}-01`,
    end: `${last.year}-${pad2(last.month)}-${pad2(lastDay)}`,
  };
}

export function computeBudgetUsage(
  budget: BudgetLike,
  transactions: readonly BudgetTransaction[],
): BudgetUsage {
  const range = budgetPeriodRange(budget.period, budget.reference_month);
  const categoryIds = new Set(budget.categories.map((item) => item.category));
  const perCategoryMap = new Map<string, number>();

  let spent = 0;
  for (const tx of transactions) {
    if (tx.deleted_at) continue;
    if (tx.type !== "despesa") continue;
    if (tx.date < range.start || tx.date > range.end) continue;
    if (!tx.category || !categoryIds.has(tx.category)) continue;
    spent += tx.amount_cents;
    perCategoryMap.set(tx.category, (perCategoryMap.get(tx.category) ?? 0) + tx.amount_cents);
  }

  const percent = budget.total_cents > 0 ? (spent / budget.total_cents) * 100 : 0;
  const status: BudgetUsage["status"] =
    spent > budget.total_cents ? "estouro" : percent >= budget.alert_pct ? "alerta" : "ok";

  const perCategory = budget.categories.map((item) => {
    const categorySpent = perCategoryMap.get(item.category) ?? 0;
    return {
      category: item.category,
      spentCents: categorySpent,
      limitCents: item.limit_cents,
      percentOfTotal: budget.total_cents > 0 ? (categorySpent / budget.total_cents) * 100 : 0,
    };
  });

  return {
    start: range.start,
    end: range.end,
    spentCents: spent,
    remainingCents: budget.total_cents - spent,
    percent: Math.round(percent),
    status,
    perCategory,
  };
}
