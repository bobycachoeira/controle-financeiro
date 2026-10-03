import { defineStore } from "pinia";
import { ref } from "vue";
import { computeBudgetUsage, type BudgetCategory, type BudgetPeriod, type BudgetUsage } from "@cf/shared";
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

  return { items, load, create, update, remove, usageFor };
});
