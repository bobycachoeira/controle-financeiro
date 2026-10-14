import { addMonths, daysInMonth, diffInDays, pad2, parseISOMonth } from "./dates";

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

export interface BudgetBill {
  nature: "entrada" | "saida";
  status: "a_confirmar" | "pendente" | "pago" | "cancelado";
  amount_cents: number;
  category?: string | null;
  due_date: string;
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
  bills: readonly BudgetBill[] = [],
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

  // Contas já confirmadas (pendentes) do período contam como gasto previsto;
  // quando pagas viram lançamento, então não entram aqui para não duplicar.
  for (const bill of bills) {
    if (bill.deleted_at) continue;
    if (bill.nature !== "saida" || bill.status !== "pendente") continue;
    if (bill.due_date < range.start || bill.due_date > range.end) continue;
    if (!bill.category || !categoryIds.has(bill.category)) continue;
    spent += bill.amount_cents;
    perCategoryMap.set(bill.category, (perCategoryMap.get(bill.category) ?? 0) + bill.amount_cents);
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

export interface BudgetProjection {
  projectedCents: number;
  projectedPercent: number;
  /** `true` se a projeção ainda cabe no limite do período. */
  onTrack: boolean;
}

/**
 * Projeção do gasto até o fim do período, no ritmo atual (média por dia desde
 * o início do período). Devolve `null` quando hoje está fora do período.
 */
export function projectBudgetSpending(input: {
  spentCents: number;
  totalCents: number;
  period: BudgetPeriod;
  referenceMonth: string;
  today: string;
}): BudgetProjection | null {
  const range = budgetPeriodRange(input.period, input.referenceMonth);
  if (input.today < range.start || input.today > range.end) return null;
  const elapsedDays = diffInDays(range.start, input.today) + 1;
  const totalDays = diffInDays(range.start, range.end) + 1;
  if (elapsedDays <= 0 || totalDays <= 0) return null;
  const projectedCents = Math.round((input.spentCents / elapsedDays) * totalDays);
  const projectedPercent =
    input.totalCents > 0 ? Math.round((projectedCents / input.totalCents) * 100) : 0;
  return {
    projectedCents,
    projectedPercent,
    onTrack: projectedCents <= input.totalCents,
  };
}
