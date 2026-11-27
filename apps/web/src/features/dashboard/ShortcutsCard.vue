<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { RouterLink } from "vue-router";
import { Check } from "lucide-vue-next";
import { useSessionStore } from "@/stores/session";
import { useSyncStore } from "@/stores/sync";
import { useToast } from "@/composables/useToast";
import {
  DEFAULT_SHORTCUTS,
  MAX_SHORTCUTS,
  SHORTCUT_OPTIONS,
  shortcutOption,
} from "@/lib/shortcuts";
import { loadHouseholdSetting, saveHouseholdSetting } from "@/lib/household-settings";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import CardContent from "@/components/ui/CardContent.vue";
import IconChip from "@/components/ui/IconChip.vue";
import Modal from "@/components/ui/Modal.vue";

const session = useSessionStore();
const sync = useSyncStore();
const toast = useToast();

const selected = ref<string[]>([]);
const draft = ref<string[]>([]);
const modalOpen = ref(false);
const saving = ref(false);

const selectedOptions = computed(() =>
  selected.value.flatMap((name) => {
    const option = shortcutOption(name);
    return option ? [option] : [];
  }),
);

function normalize(value: unknown): string[] {
  if (!Array.isArray(value)) return [...DEFAULT_SHORTCUTS];
  return value
    .filter((name): name is string => typeof name === "string" && Boolean(shortcutOption(name)))
    .slice(0, MAX_SHORTCUTS);
}

async function load(): Promise<void> {
  if (!session.currentHouseholdId) return;
  selected.value = normalize(
    await loadHouseholdSetting(session.currentHouseholdId, "dashboard_shortcuts", [
      ...DEFAULT_SHORTCUTS,
    ]),
  );
}

function openEdit(): void {
  draft.value = [...selected.value];
  modalOpen.value = true;
}

function toggle(name: string): void {
  if (draft.value.includes(name)) {
    draft.value = draft.value.filter((item) => item !== name);
    return;
  }
  if (draft.value.length >= MAX_SHORTCUTS) {
    toast.info(`Escolha até ${MAX_SHORTCUTS} atalhos.`);
    return;
  }
  draft.value = [...draft.value, name];
}

async function save(): Promise<void> {
  if (!session.currentHouseholdId) return;
  saving.value = true;
  try {
    await saveHouseholdSetting(session.currentHouseholdId, "dashboard_shortcuts", draft.value);
    selected.value = [...draft.value];
    modalOpen.value = false;
    toast.success("Atalhos atualizados.");
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Falha ao salvar os atalhos.");
  } finally {
    saving.value = false;
  }
}

onMounted(load);
watch(() => sync.dataVersion, load);
</script>

<template>
  <Card data-testid="shortcuts-card">
    <CardContent class="space-y-3 p-4">
      <div class="flex items-center gap-2">
        <IconChip name="sparkles" color="#8A6FD1" size="sm" />
        <h2 class="font-display text-lg font-bold">Atalhos</h2>
        <button
          type="button"
          class="ml-auto flex min-h-11 items-center px-1 text-xs font-bold text-primary"
          data-testid="shortcuts-edit"
          @click="openEdit"
        >
          Personalizar
        </button>
      </div>

      <p v-if="selectedOptions.length === 0" class="text-sm text-muted-foreground">
        Monte sua barra de atalhos com o que você mais usa.
      </p>
      <div v-else class="grid grid-cols-4 gap-2">
        <RouterLink
          v-for="option in selectedOptions"
          :key="option.name"
          :to="{ name: option.name }"
          data-testid="shortcut"
          class="flex min-h-[5.25rem] flex-col items-center justify-center gap-1.5 rounded-2xl bg-muted/50 px-1 py-2 text-center transition hover:bg-muted"
        >
          <IconChip :name="option.icon" :seed="option.name" size="md" />
          <span
            class="line-clamp-2 text-[0.62rem] font-extrabold leading-tight text-muted-foreground"
          >
            {{ option.label }}
          </span>
        </RouterLink>
      </div>
    </CardContent>
  </Card>

  <Modal
    v-model="modalOpen"
    title="Personalizar atalhos"
    description="Escolha até 8 atalhos para aparecerem no Início."
  >
    <div class="space-y-3">
      <div class="grid grid-cols-2 gap-2">
        <button
          v-for="option in SHORTCUT_OPTIONS"
          :key="option.name"
          type="button"
          class="flex min-h-11 items-center gap-2 rounded-2xl border-2 px-2.5 py-2 text-left transition"
          :class="
            draft.includes(option.name)
              ? 'border-primary bg-primary/5'
              : 'border-border bg-card hover:bg-muted'
          "
          @click="toggle(option.name)"
        >
          <IconChip :name="option.icon" :seed="option.name" size="sm" />
          <span class="min-w-0 flex-1 truncate text-sm font-bold">{{ option.label }}</span>
          <Check v-if="draft.includes(option.name)" class="h-4 w-4 shrink-0 text-primary" />
        </button>
      </div>
      <p class="text-xs text-muted-foreground">
        {{ draft.length }}/{{ MAX_SHORTCUTS }} selecionados
      </p>
      <div class="flex justify-end gap-2 pt-1">
        <Button variant="ghost" type="button" @click="modalOpen = false">Cancelar</Button>
        <Button :loading="saving" type="button" @click="save">Salvar</Button>
      </div>
    </div>
  </Modal>
</template>
