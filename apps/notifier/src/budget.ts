export const BUDGET_THRESHOLDS = [70, 90, 100] as const;

/** Maior limiar de alerta já cruzado (70/90/100) ou `null`. */
export function highestBudgetThreshold(
  percent: number,
  thresholds: readonly number[] = BUDGET_THRESHOLDS,
): number | null {
  let result: number | null = null;
  for (const threshold of thresholds) {
    if (percent >= threshold) result = threshold;
  }
  return result;
}

/** Chave idempotente: um aviso por limiar por período. */
export function budgetAlertKey(budgetId: string, threshold: number, period: string): string {
  return `${budgetId}-${threshold}-${period}`;
}
