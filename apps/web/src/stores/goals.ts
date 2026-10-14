import { defineStore } from "pinia";
import { ref } from "vue";
import { todayISO } from "@cf/shared";
import { db, type LocalGoal } from "../db/schema";
import {
  createLocal,
  newLocalId,
  newSyncId,
  softDeleteLocal,
  updateLocal,
} from "../db/repositories";
import { useSessionStore } from "./session";

export interface GoalInput {
  name: string;
  target_cents: number;
  deadline?: string | null;
  color?: string | null;
  icon?: string | null;
  owner?: string;
}

export const useGoalsStore = defineStore("goals", () => {
  const items = ref<LocalGoal[]>([]);

  async function load(): Promise<void> {
    const session = useSessionStore();
    if (!session.currentHouseholdId) return;
    const all = await db.goals.where("household").equals(session.currentHouseholdId).toArray();
    items.value = all
      .filter((goal) => !goal.deleted_at)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async function create(input: GoalInput): Promise<LocalGoal> {
    const session = useSessionStore();
    const record: LocalGoal = {
      id: newLocalId(),
      household: session.currentHouseholdId ?? "",
      sync_id: newSyncId(),
      name: input.name,
      target_cents: input.target_cents,
      deadline: input.deadline ?? null,
      color: input.color ?? null,
      icon: input.icon ?? null,
      owner: input.owner ?? "indefinido",
      active: true,
      entries: [],
      updated_by: session.user?.id ?? null,
      deleted_at: null,
    };
    await createLocal("goals", record);
    await load();
    return record;
  }

  async function update(id: string, changes: Partial<GoalInput>): Promise<void> {
    const existing = await db.goals.get(id);
    if (!existing) return;
    await updateLocal("goals", { ...existing, ...changes } as LocalGoal);
    await load();
  }

  async function remove(id: string): Promise<void> {
    await softDeleteLocal("goals", id);
    await load();
  }

  /** Aporte na meta. Valor negativo = resgate. */
  async function addEntry(
    id: string,
    amountCents: number,
    note = "",
    date = todayISO(),
  ): Promise<void> {
    const existing = await db.goals.get(id);
    if (!existing || amountCents === 0) return;
    const entry = {
      id: newLocalId(),
      amount_cents: amountCents,
      date,
      note: note.slice(0, 200),
    };
    await updateLocal("goals", {
      ...existing,
      entries: [...(existing.entries ?? []), entry],
    } as LocalGoal);
    await load();
  }

  return { items, load, create, update, remove, addEntry };
});
