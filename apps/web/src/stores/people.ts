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
import { waitForHousehold } from "../lib/household-settings";
import { useSessionStore } from "./session";

export type SplitMode = "junto" | "dividir";

export const usePeopleStore = defineStore("people", () => {
  const options = ref<AttributionOption[]>([]);
  const splitMode = ref<SplitMode>("junto");
  const loading = ref(false);

  async function load(): Promise<void> {
    const session = useSessionStore();
    if (!session.currentHouseholdId) return;
    loading.value = true;
    try {
      const household = await db.households.get(session.currentHouseholdId);
      const settings = (household?.settings ?? {}) as {
        attribution_options?: unknown;
        split_mode?: unknown;
      };
      splitMode.value = settings.split_mode === "dividir" ? "dividir" : "junto";
      let loaded: AttributionOption[];
      if (Array.isArray(settings.attribution_options) && settings.attribution_options.length > 0) {
        loaded = attributionOptions(household?.settings);
      } else if (session.members.length > 0) {
        loaded = session.members
          .filter((member) => member.role !== "viewer")
          .map((member) => ({
            key: member.user,
            label: member.user_name || member.user,
            userId: member.user,
          }));
      } else {
        loaded = [...DEFAULT_ATTRIBUTION_OPTIONS];
      }

      // Garante que todo membro aceito (exceto viewer) seja selecionável.
      const linked = new Set(loaded.filter((option) => option.userId).map((option) => option.userId));
      session.members
        .filter(
          (member) =>
            member.role !== "viewer" &&
            member.invite_status !== "pending" &&
            !linked.has(member.user),
        )
        .forEach((member) => {
          loaded.push({
            key: member.user,
            label: member.user_name || member.user,
            userId: member.user,
          });
        });

      // O rótulo de quem tem usuário vinculado segue o nome do perfil atual.
      const memberNameByUser = new Map(session.members.map((member) => [member.user, member.user_name]));
      loaded = loaded.map((option) => {
        if (option.userId) {
          const name = memberNameByUser.get(option.userId);
          if (name) return { ...option, label: name };
        }
        return option;
      });

      options.value = loaded;
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

  const selectable = computed(() => {
    const session = useSessionStore();
    return [
      ...options.value.map((option) => ({
        value: option.key,
        label:
          option.userId && option.userId === session.user?.id
            ? `${option.label} (você)`
            : option.label,
      })),
      { value: "ambos", label: "Ambos" },
      { value: "indefinido", label: "Não definido" },
    ];
  });

  async function save(next: AttributionOption[]): Promise<void> {
    const session = useSessionStore();
    if (!session.currentHouseholdId) return;
    const household = await waitForHousehold(session.currentHouseholdId);
    if (!household) return;
    const clean = toPlain({
      ...household,
      settings: { ...(household.settings ?? {}), attribution_options: next },
    });
    await updateLocal("households", clean);
    options.value = next;
  }

  /**
   * Como o casal lida com o dinheiro:
   * - "junto": dinheiro é dos dois; mostra contribuições, sem cobrança.
   * - "dividir": ativa o Acerto do mês (quem adiantou × quem usou).
   */
  async function saveSplitMode(mode: SplitMode): Promise<void> {
    const session = useSessionStore();
    if (!session.currentHouseholdId) return;
    const household = await waitForHousehold(session.currentHouseholdId);
    if (!household) return;
    const clean = toPlain({
      ...household,
      settings: { ...(household.settings ?? {}), split_mode: mode },
    });
    await updateLocal("households", clean);
    splitMode.value = mode;
  }

  return {
    options,
    splitMode,
    loading,
    label,
    load,
    save,
    saveSplitMode,
    selectable,
    currentKey,
  };
});
