<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { CategoryKind } from "@cf/shared";
import { Check, Plus, Search } from "lucide-vue-next";
import { db, type LocalCategory } from "@/db/schema";
import { createLocal, newLocalId, newSyncId } from "@/db/repositories";
import { useSessionStore } from "@/stores/session";
import { useSyncStore } from "@/stores/sync";
import { cn } from "@/lib/utils";
import Input from "@/components/ui/Input.vue";

const props = defineProps<{
  modelValue: string | null;
  id?: string;
  kind?: CategoryKind | "all";
  required?: boolean;
  allowEmpty?: boolean;
  emptyLabel?: string;
  placeholder?: string;
  class?: string;
}>();

const emit = defineEmits<{ "update:modelValue": [string]; created: [string] }>();

const session = useSessionStore();
const sync = useSyncStore();

const open = ref(false);
const query = ref("");
const root = ref<HTMLElement | null>(null);
const categories = ref<LocalCategory[]>([]);
const creating = ref(false);

const selected = computed(() => categories.value.find((item) => item.id === props.modelValue) ?? null);

const filtered = computed(() => {
  const term = query.value.trim().toLowerCase();
  return categories.value
    .filter((item) => matchesKind(item))
    .filter((item) => !term || item.name.toLowerCase().includes(term) || item.group.toLowerCase().includes(term))
    .sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name));
});

const exactMatch = computed(() =>
  categories.value.some((item) => item.name.toLowerCase() === query.value.trim().toLowerCase()),
);

async function load(): Promise<void> {
  if (!session.currentHouseholdId) return;
  categories.value = (
    await db.categories.where("household").equals(session.currentHouseholdId).toArray()
  )
    .filter((item) => !item.deleted_at && item.active !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function matchesKind(item: LocalCategory): boolean {
  if (!props.kind || props.kind === "all") return true;
  return item.kind === props.kind || item.kind === "ambos";
}

function createKind(): CategoryKind {
  return props.kind === "entrada" || props.kind === "saida" ? props.kind : "saida";
}

function toggle(): void {
  open.value = !open.value;
  if (open.value) query.value = "";
}

function choose(value: string): void {
  emit("update:modelValue", value);
  open.value = false;
}

async function createAndChoose(): Promise<void> {
  const name = query.value.trim();
  if (!name || !session.currentHouseholdId) return;
  creating.value = true;
  try {
    const record: LocalCategory = {
      id: newLocalId(),
      household: session.currentHouseholdId,
      sync_id: newSyncId(),
      name,
      kind: createKind(),
      group: "Geral",
      color: null,
      icon: null,
      system: false,
      active: true,
      order: 100 + categories.value.length,
      updated_by: session.user?.id ?? null,
      deleted_at: null,
    };
    await createLocal("categories", record);
    await load();
    emit("created", record.id);
    choose(record.id);
  } finally {
    creating.value = false;
  }
}

function onDocumentClick(event: MouseEvent): void {
  if (!open.value) return;
  if (root.value && !root.value.contains(event.target as Node)) open.value = false;
}

onMounted(() => {
  void load();
  document.addEventListener("mousedown", onDocumentClick);
});
onBeforeUnmount(() => document.removeEventListener("mousedown", onDocumentClick));
watch(() => sync.dataVersion, load);
</script>

<template>
  <div ref="root" class="relative">
    <button
      :id="id"
      type="button"
      class="flex h-11 w-full items-center justify-between gap-2 rounded-2xl border-2 border-input bg-card px-4 text-left text-[0.95rem] font-semibold text-foreground shadow-inset transition-colors focus-visible:border-primary"
      :class="cn(selected ? '' : 'text-muted-foreground/70', props.class)"
      @click="toggle"
    >
      <span class="truncate">
        <template v-if="selected">{{ selected.group }} · {{ selected.name }}</template>
        <template v-else>{{ placeholder ?? "Selecione" }}</template>
      </span>
      <span class="text-muted-foreground">▾</span>
    </button>

    <div
      v-if="open"
      class="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-2xl border-2 border-border bg-card shadow-lift"
    >
      <div class="relative border-b border-border p-2">
        <Search class="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input v-model="query" class="pl-9" placeholder="Filtrar categoria…" autofocus />
      </div>
      <ul class="max-h-64 overflow-y-auto py-1">
        <li v-if="allowEmpty">
          <button
            type="button"
            class="flex min-h-11 w-full items-center justify-between px-4 py-2 text-left text-sm font-semibold hover:bg-muted"
            @click="choose('')"
          >
            <span class="text-muted-foreground">{{ emptyLabel ?? "Sem categoria" }}</span>
            <Check v-if="!modelValue" class="h-4 w-4 text-primary" />
          </button>
        </li>
        <li v-for="item in filtered" :key="item.id">
          <button
            type="button"
            class="flex min-h-11 w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm font-semibold hover:bg-muted"
            @click="choose(item.id)"
          >
            <span class="truncate">{{ item.group }} · {{ item.name }}</span>
            <Check v-if="item.id === modelValue" class="h-4 w-4 shrink-0 text-primary" />
          </button>
        </li>
        <li v-if="filtered.length === 0 && !query.trim()">
          <p class="px-4 py-3 text-sm text-muted-foreground">Nenhuma categoria.</p>
        </li>
      </ul>
      <button
        v-if="query.trim() && !exactMatch"
        type="button"
        class="flex min-h-11 w-full items-center gap-2 border-t border-border px-4 py-2.5 text-left text-sm font-extrabold text-primary hover:bg-muted"
        :disabled="creating"
        @click="createAndChoose"
      >
        <Plus class="h-4 w-4" /> Criar “{{ query.trim() }}”
      </button>
    </div>
  </div>
</template>
