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
  const options = ref<AttributionOption[]>([]);
  const loading = ref(false);

  async function load(): Promise<void> {
    const session = useSessionStore();
    if (!session.currentHouseholdId) return;
    loading.value = true;
    try {
      const household = await db.households.get(session.currentHouseholdId);
      const settings = (household?.settings ?? {}) as { attribution_options?: unknown };
      if (Array.isArray(settings.attribution_options) && settings.attribution_options.length > 0) {
        options.value = attributionOptions(household?.settings);
      } else if (session.members.length > 0) {
        options.value = session.members
          .filter((member) => member.role !== "viewer")
          .map((member) => ({
            key: member.user,
            label: member.user_name || member.user,
            userId: member.user,
          }));
      } else {
        options.value = DEFAULT_ATTRIBUTION_OPTIONS;
      }
    } finally {
      loading.value = false;
    }
  }

  function label(key: string): string {
    return attributionLabel(key, options.value);
  }

  const currentKey = computed(() => {
    const session = useSessionStore();
    return options.value.find((option) => option.userId === session.user?.id)?.key ?? "indefinido";
  });

  const selectable = computed(() => [
    ...options.value.map((option) => ({ value: option.key, label: option.label })),
    { value: "ambos", label: "Ambos" },
    { value: "indefinido", label: "Não definido" },
  ]);

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

  return { options, loading, label, load, save, selectable, currentKey };
});
