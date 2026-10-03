<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import type { CategoryKind } from "@cf/shared";
import { Eye, EyeOff, Pencil, Plus } from "lucide-vue-next";
import { db, type LocalCategory } from "@/db/schema";
import { createLocal, newSyncId, newLocalId, updateLocal } from "@/db/repositories";
import { useSessionStore } from "@/stores/session";
import { useSyncStore } from "@/stores/sync";
import { useToast } from "@/composables/useToast";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import CardContent from "@/components/ui/CardContent.vue";
import Input from "@/components/ui/Input.vue";
import Label from "@/components/ui/Label.vue";
import Select from "@/components/ui/Select.vue";
import Modal from "@/components/ui/Modal.vue";
import IconChip from "@/components/ui/IconChip.vue";
import IconColorField from "@/components/ui/IconColorField.vue";

const session = useSessionStore();
const sync = useSyncStore();
const toast = useToast();

const categories = ref<LocalCategory[]>([]);
const open = ref(false);
const editingId = ref<string | null>(null);
const name = ref("");
const kind = ref<CategoryKind>("saida");
const group = ref("");
const icon = ref<string | null>(null);
const color = ref<string | null>(null);
const saving = ref(false);

const grouped = computed(() => {
  const map = new Map<string, LocalCategory[]>();
  for (const category of categories.value) {
    const list = map.get(category.group) ?? [];
    list.push(category);
    map.set(category.group, list);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
});

async function load(): Promise<void> {
  if (!session.currentHouseholdId) return;
  categories.value = (
    await db.categories.where("household").equals(session.currentHouseholdId).toArray()
  )
    .filter((category) => !category.deleted_at)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function openCreate(): void {
  editingId.value = null;
  name.value = "";
  kind.value = "saida";
  group.value = "";
  icon.value = null;
  color.value = null;
  open.value = true;
}

function openEdit(category: LocalCategory): void {
  editingId.value = category.id;
  name.value = category.name;
  kind.value = category.kind;
  group.value = category.group;
  icon.value = category.icon ?? null;
  color.value = category.color ?? null;
  open.value = true;
}

async function submit(): Promise<void> {
  if (!name.value || !group.value) {
    toast.error("Informe nome e grupo.");
    return;
  }
  saving.value = true;
  try {
    if (editingId.value) {
      const existing = await db.categories.get(editingId.value);
      if (existing) {
        await updateLocal("categories", {
          ...existing,
          name: name.value,
          kind: kind.value,
          group: group.value,
          icon: icon.value,
          color: color.value,
        });
      }
      toast.success("Categoria atualizada.");
    } else {
      await createLocal("categories", {
        id: newLocalId(),
        household: session.currentHouseholdId ?? "",
        sync_id: newSyncId(),
        name: name.value,
        kind: kind.value,
        group: group.value,
        color: color.value,
        icon: icon.value,
        system: false,
        active: true,
        order: 100 + categories.value.length,
        updated_by: session.user?.id ?? null,
        deleted_at: null,
      });
      toast.success("Categoria criada.");
    }
    open.value = false;
    await load();
  } finally {
    saving.value = false;
  }
}

async function toggleActive(category: LocalCategory): Promise<void> {
  await updateLocal("categories", { ...category, active: !category.active });
  await load();
}

onMounted(load);
watch(() => sync.dataVersion, load);
</script>

<template>
  <div class="space-y-5">
    <div class="flex items-end justify-between gap-3">
      <div>
        <p class="text-xs font-extrabold uppercase tracking-wider text-primary">Organização</p>
        <h1 class="font-display text-3xl font-black tracking-tight">Categorias</h1>
      </div>
      <Button size="sm" @click="openCreate"><Plus class="h-4 w-4" /> Nova</Button>
    </div>

    <div class="stagger space-y-4">
      <Card v-for="[groupName, items] in grouped" :key="groupName">
        <CardContent class="p-2">
          <p class="px-2 pb-1 pt-2 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
            {{ groupName }}
          </p>
          <ul>
            <li
              v-for="category in items"
              :key="category.id"
              class="group flex items-center gap-3 rounded-[1.2rem] px-2 py-2 transition hover:bg-muted/70"
            >
              <IconChip
                :name="category.icon"
                :color="category.color"
                :seed="category.name"
                size="sm"
              />
              <button class="min-w-0 flex-1 text-left" @click="openEdit(category)">
                <span
                  class="truncate font-bold"
                  :class="category.active ? '' : 'text-muted-foreground line-through'"
                >
                  {{ category.name }}
                </span>
              </button>
              <span
                class="text-[0.62rem] font-extrabold uppercase tracking-wide"
                :class="
                  category.kind === 'entrada'
                    ? 'text-leaf'
                    : category.kind === 'ambos'
                      ? 'text-primary'
                      : 'text-muted-foreground'
                "
              >
                {{ category.kind === "ambos" ? "ambos" : category.kind }}
              </span>
              <div class="flex gap-1 opacity-0 transition group-hover:opacity-100">
                <button
                  class="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:bg-card hover:text-primary"
                  aria-label="Editar categoria"
                  @click="openEdit(category)"
                >
                  <Pencil class="h-3.5 w-3.5" />
                </button>
                <button
                  class="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:bg-card hover:text-foreground"
                  :aria-label="category.active ? 'Ocultar categoria' : 'Ativar categoria'"
                  @click="toggleActive(category)"
                >
                  <EyeOff v-if="category.active" class="h-3.5 w-3.5" />
                  <Eye v-else class="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>

    <Modal v-model="open" :title="editingId ? 'Editar categoria' : 'Nova categoria'">
      <form class="space-y-4" @submit.prevent="submit">
        <div class="space-y-2">
          <Label for="category-name">Nome</Label>
          <Input id="category-name" v-model="name" required maxlength="60" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-2">
            <Label for="category-group">Grupo</Label>
            <Input id="category-group" v-model="group" required maxlength="60" />
          </div>
          <div class="space-y-2">
            <Label for="category-kind">Tipo</Label>
            <Select id="category-kind" v-model="kind">
              <option value="saida">Saída</option>
              <option value="entrada">Entrada</option>
              <option value="ambos">Ambos</option>
            </Select>
          </div>
        </div>
        <div class="space-y-2">
          <Label>Ícone e cor</Label>
          <IconColorField v-model:icon="icon" v-model:color="color" :name="name || group" />
        </div>
        <div class="flex justify-end gap-2 pt-1">
          <Button variant="ghost" type="button" @click="open = false">Cancelar</Button>
          <Button type="submit" :loading="saving">Salvar</Button>
        </div>
      </form>
    </Modal>
  </div>
</template>
