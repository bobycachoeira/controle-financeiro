export interface GoalEntryLike {
  amount_cents: number;
}

export interface GoalProgress {
  savedCents: number;
  remainingCents: number;
  /** Percentual (0–100) do objetivo já guardado. */
  percent: number;
  completed: boolean;
}

/** Progresso da meta a partir dos aportes/resgates registrados. */
export function goalProgress(
  targetCents: number,
  entries: readonly GoalEntryLike[],
): GoalProgress {
  const savedCents = entries.reduce((sum, entry) => sum + entry.amount_cents, 0);
  const remainingCents = Math.max(0, targetCents - savedCents);
  const percent =
    targetCents > 0 ? Math.min(100, Math.max(0, Math.round((savedCents / targetCents) * 100))) : 0;
  return {
    savedCents,
    remainingCents,
    percent,
    completed: savedCents >= targetCents,
  };
}
