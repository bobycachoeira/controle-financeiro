import { defineStore } from "pinia";
import { ref } from "vue";
import type { RecurrenceTemplate } from "@cf/shared";
import { db, type LocalRecurrence } from "../db/schema";
import { createLocal, newLocalId, newSyncId, softDeleteLocal, updateLocal } from "../db/repositories";
import { useSessionStore } from "./session";

export interface RecurrenceInput {
  name: string;
  rrule: string;
  start_date: string;
  target: "transaction" | "bill";
  creates_status: "pago" | "a_pagar";
  template: RecurrenceTemplate;
}

export const useRecurrencesStore = defineStore("recurrences", () => {
  const items = ref<LocalRecurrence[]>([]);

  async function load(): Promise<void> {
    const session = useSessionStore();
    if (!session.currentHouseholdId) return;
    const all = await db.recurrences.where("household").equals(session.currentHouseholdId).toArray();
    items.value = all
      .filter((item) => !item.deleted_at)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async function create(input: RecurrenceInput): Promise<LocalRecurrence> {
    const session = useSessionStore();
    const record: LocalRecurrence = {
      id: newLocalId(),
      household: session.currentHouseholdId ?? "",
      sync_id: newSyncId(),
      name: input.name,
      rrule: input.rrule,
      timezone: "America/Sao_Paulo",
      start_date: input.start_date,
      end_date: null,
      count: null,
      active: true,
      last_run: null,
      next_run: null,
      target: input.target,
      creates_status: input.creates_status,
      template: input.template,
      updated_by: session.user?.id ?? null,
      deleted_at: null,
    };
    await createLocal("recurrences", record);
    await load();
    return record;
  }

  async function update(id: string, changes: Partial<RecurrenceInput>): Promise<void> {
    const existing = await db.recurrences.get(id);
    if (!existing) return;
    await updateLocal("recurrences", { ...existing, ...changes } as LocalRecurrence);
    await load();
  }

  async function setActive(id: string, active: boolean): Promise<void> {
    const existing = await db.recurrences.get(id);
    if (!existing) return;
    await updateLocal("recurrences", { ...existing, active });
    await load();
  }

  async function remove(id: string): Promise<void> {
    await softDeleteLocal("recurrences", id);
    await load();
  }

  return { items, load, create, update, setActive, remove };
});
