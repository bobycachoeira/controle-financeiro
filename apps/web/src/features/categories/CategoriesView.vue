<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import type { CategoryKind } from "@cf/shared";
import { db, type LocalCategory } from "@/db/schema";
import { createLocal, newSyncId, newLocalId, updateLocal } from "@/db/repositories";
import { useSessionStore } from "@/stores/session";
import { useSyncStore } from "@/stores/sync";
import { useToast } from "@/composables/useToast";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import CardContent from "@/components/ui/CardContent.vue";
import CardHeader from "@/components/ui/CardHeader.vue";
import CardTitle from "@/components/ui/CardTitle.vue";
import Badge from "@/components/ui/Badge.vue";
import Input from "@/components/ui/Input.vue";
import Label from "@/components/ui/Label.vue";
import Select from "@/components/ui/Select.vue";

const session = useSessionStore();
const sync = useSyncStore();
const toast = useToast();

const categories = ref<LocalCategory[]>([]);
const name = ref("");
const kind = ref<CategoryKind>("saida");
const group = ref("");
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

async function create(): Promise<void> {
  if (!name.value || !group.value) {
    toast.error("Informe nome e grupo.");
    return;
  }
  saving.value = true;
  try {
    await createLocal("categories", {
      id: newLocalId(),
      household: session.currentHouseholdId ?? "",
      sync_id: newSyncId(),
      name: name.value,
      kind: kind.value,
      group: group.value,
      color: null,
      icon: null,
      system: false,
      active: true,
      order: 100 + categories.value.length,
      updated_by: session.user?.id ?? null,
      deleted_at: null,
    });
    toast.success("Categoria criada.");
    name.value = "";
    group.value = "";
    await load();
  } finally {
    saving.value = false;
  }
}

async function toggleActive(category: LocalCategory): Promise<void> {
  await updateLocal("categories", { ...category, active: !category.active });
  await load();
}

function requestDelete(category: LocalCategory): void {
  if (category.system) {
    toast.error("Categorias de sistema não podem ser excluídas.");
    return;
  }
  toast.info("Use a desativação para ocultar categorias personalizadas.");
}

onMounted(load);
watch(() => sync.dataVersion, load);
</script>

<template>
  <div class="space-y-4">
    <h1 class="text-xl font-bold">Categorias</h1>

    <Card>
      <CardHeader><CardTitle>Nova categoria</CardTitle></CardHeader>
      <CardContent>
        <form class="space-y-4" @submit.prevent="create">
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
              </Select>
            </div>
          </div>
          <Button type="submit" :loading="saving">Adicionar</Button>
        </form>
      </CardContent>
    </Card>

    <Card v-for="[groupName, items] in grouped" :key="groupName">
      <CardHeader><CardTitle>{{ groupName }}</CardTitle></CardHeader>
      <CardContent>
        <ul class="divide-y">
          <li
            v-for="category in items"
            :key="category.id"
            class="flex items-center justify-between py-2 text-sm"
          >
            <span :class="category.active ? '' : 'text-muted-foreground line-through'">
              {{ category.name }}
            </span>
            <span class="flex items-center gap-2">
              <Badge :variant="category.kind === 'entrada' ? 'success' : 'secondary'">
                {{ category.kind }}
              </Badge>
              <Badge v-if="category.system" variant="outline">sistema</Badge>
              <Button size="sm" variant="ghost" @click="toggleActive(category)">
                {{ category.active ? "Ocultar" : "Ativar" }}
              </Button>
              <Button v-if="!category.system" size="sm" variant="ghost" @click="requestDelete(category)">
                Excluir
              </Button>
            </span>
          </li>
        </ul>
      </CardContent>
    </Card>
  </div>
</template>
