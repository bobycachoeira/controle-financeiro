import { defineStore } from "pinia";
import { ref } from "vue";
import { db, type LocalExchangeRate } from "../db/schema";
import { createLocal, newLocalId, newSyncId, softDeleteLocal } from "../db/repositories";
import { useSessionStore } from "./session";

export interface RateInput {
  currency: string;
  date: string;
  rate_micros: number;
}

export function parseRateToMicros(input: string): number | null {
  let normalized = input.trim().replace(/\s/g, "").replace(/[^\d.,]/g, "");
  if (normalized.includes(",")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (normalized.split(".").length > 2) {
    normalized = normalized.replace(/\./g, "");
  }
  const value = Number(normalized);
  if (!Number.isFinite(value) || normalized === "" || value <= 0) return null;
  return Math.round(value * 1_000_000);
}

export const useRatesStore = defineStore("rates", () => {
  const items = ref<LocalExchangeRate[]>([]);

  async function load(): Promise<void> {
    const session = useSessionStore();
    if (!session.currentHouseholdId) return;
    const all = await db.exchange_rates.where("household").equals(session.currentHouseholdId).toArray();
    items.value = all
      .filter((item) => !item.deleted_at)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }

  async function create(input: RateInput): Promise<LocalExchangeRate> {
    const session = useSessionStore();
    const record: LocalExchangeRate = {
      id: newLocalId(),
      household: session.currentHouseholdId ?? "",
      sync_id: newSyncId(),
      currency: input.currency.toUpperCase(),
      date: input.date,
      rate_micros: input.rate_micros,
      updated_by: session.user?.id ?? null,
      deleted_at: null,
    };
    await createLocal("exchange_rates", record);
    await load();
    return record;
  }

  async function remove(id: string): Promise<void> {
    await softDeleteLocal("exchange_rates", id);
    await load();
  }

  return { items, load, create, remove };
});
