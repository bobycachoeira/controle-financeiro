import { defineStore } from "pinia";
import { ref } from "vue";
import {
  addMonths,
  computeBudgetUsage,
  formatISOMonth,
  parseISOMonth,
  type BudgetCategory,
  type BudgetPeriod,
  type BudgetUsage,
} from "@cf/shared";
import { db, type LocalBudget, type LocalTransaction } from "../db/schema";
import { createLocal, newLocalId, newSyncId, softDeleteLocal, updateLocal } from "../db/repositories";
import { useSessionStore } from "./session";

export interface BudgetInput {
  name: string;
  period: BudgetPeriod;
  total_cents: number;
  alert_pct: number;
  reference_month: string;
  categories: BudgetCategory[];
}

export interface BudgetHistoryEntry {
  month: string;
  usage: BudgetUsage;
}

const HISTORY_PERIODS: Record<BudgetPeriod, { count: number; stepMonths: number }> = {
  mensal: { count: 6, stepMonths: 1 },
  trimestral: { count: 4, stepMonths: 3 },
  anual: { count: 3, stepMonths: 12 },
};

export const useBudgetsStore = defineStore("budgets", () => {
  const items = ref<LocalBudget[]>([]);

  async function load(): Promise<void> {
    const session = useSessionStore();
    if (!session.currentHouseholdId) return;
    const all = await db.budgets.where("household").equals(session.currentHouseholdId).toArray();
    items.value = all
      .filter((item) => !item.deleted_at)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async function transactions(): Promise<LocalTransaction[]> {
    const session = useSessionStore();
    if (!session.currentHouseholdId) return [];
    return (await db.transactions.where("household").equals(session.currentHouseholdId).toArray()).filter(
      (tx) => !tx.deleted_at,
    );
  }

  async function usageFor(budget: LocalBudget): Promise<BudgetUsage> {
    const session = useSessionStore();
    const bills = session.currentHouseholdId
      ? (await db.bills.where("household").equals(session.currentHouseholdId).toArray()).filter(
          (bill) => !bill.deleted_at,
        )
      : [];
    return computeBudgetUsage(budget, await transactions(), bills);
  }

  /** Uso do orçamento nos últimos períodos (para o gráfico de histórico). */
  async function historyFor(budget: LocalBudget): Promise<BudgetHistoryEntry[]> {
    const session = useSessionStore();
    const txs = await transactions();
    const bills = session.currentHouseholdId
      ? (await db.bills.where("household").equals(session.currentHouseholdId).toArray()).filter(
          (bill) => !bill.deleted_at,
        )
      : [];
    const config = HISTORY_PERIODS[budget.period];
    const { year, month } = parseISOMonth(budget.reference_month);
    const result: BudgetHistoryEntry[] = [];
    for (let index = config.count - 1; index >= 0; index -= 1) {
      const shifted = addMonths(year, month, -index * config.stepMonths);
      const reference = formatISOMonth(shifted.year, shifted.month);
      result.push({
        month: reference,
        usage: computeBudgetUsage({ ...budget, reference_month: reference }, txs, bills),
      });
    }
    return result;
  }

  async function create(input: BudgetInput): Promise<LocalBudget> {
    const session = useSessionStore();
    const record: LocalBudget = {
      id: newLocalId(),
      household: session.currentHouseholdId ?? "",
      sync_id: newSyncId(),
      name: input.name,
      period: input.period,
      currency: "BRL",
      total_cents: input.total_cents,
      alert_pct: input.alert_pct,
      active: true,
      reference_month: input.reference_month,
      categories: input.categories,
      updated_by: session.user?.id ?? null,
      deleted_at: null,
    };
    await createLocal("budgets", record);
    await load();
    return record;
  }

  async function update(id: string, changes: Partial<BudgetInput>): Promise<void> {
    const existing = await db.budgets.get(id);
    if (!existing) return;
    await updateLocal("budgets", { ...existing, ...changes } as LocalBudget);
    await load();
  }

  async function remove(id: string): Promise<void> {
    await softDeleteLocal("budgets", id);
    await load();
  }

  return { items, load, create, update, remove, usageFor, historyFor };
});
