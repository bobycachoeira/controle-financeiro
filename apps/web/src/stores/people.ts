import { defineStore } from "pinia";
import { computed, ref } from "vue";
import {
  attributionLabel,
  attributionOptions,
  DEFAULT_ATTRIBUTION_OPTIONS,
  type AttributionOption,
} from "@cf/shared";
import { db } from "../db/schema";
import { toPlain, updateLocal } from "../db/repositories";
import { useSessionStore } from "./session";

export const usePeopleStore = defineStore("people", () => {
  const options = ref<AttributionOption[]>(DEFAULT_ATTRIBUTION_OPTIONS);
  const loading = ref(false);

  async function load(): Promise<void> {
    const session = useSessionStore();
    if (!session.currentHouseholdId) return;
    loading.value = true;
    try {
      const household = await db.households.get(session.currentHouseholdId);
      options.value = attributionOptions(household?.settings);
    } finally {
      loading.value = false;
    }
  }

  function label(key: string): string {
    return attributionLabel(key, options.value);
  }

  async function save(next: AttributionOption[]): Promise<void> {
    const session = useSessionStore();
    if (!session.currentHouseholdId) return;
    const household = await db.households.get(session.currentHouseholdId);
    if (!household) return;
    const clean = toPlain({
      ...household,
      settings: { ...(household.settings ?? {}), attribution_options: next },
    });
    await updateLocal("households", clean);
    options.value = next;
  }

  const selectable = computed(() => [
    ...options.value.map((option) => ({ value: option.key, label: option.label })),
    { value: "ambos", label: "Ambos" },
    { value: "indefinido", label: "Não definido" },
  ]);

  return { options, loading, label, load, save, selectable };
});
