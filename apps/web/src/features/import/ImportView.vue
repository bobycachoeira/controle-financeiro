<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { db, type LocalCategory } from "@/db/schema";
import { useImportStore } from "@/stores/import";
import { useAccountsStore } from "@/stores/accounts";
import { useSessionStore } from "@/stores/session";
import { useToast } from "@/composables/useToast";
import { formatBRL, formatDate } from "@/lib/format";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import CardContent from "@/components/ui/CardContent.vue";
import CardHeader from "@/components/ui/CardHeader.vue";
import CardTitle from "@/components/ui/CardTitle.vue";
import Badge from "@/components/ui/Badge.vue";
import Label from "@/components/ui/Label.vue";
import Select from "@/components/ui/Select.vue";
import Textarea from "@/components/ui/Textarea.vue";

const store = useImportStore();
const accountsStore = useAccountsStore();
const session = useSessionStore();
const toast = useToast();

const text = ref("");
const account = ref("");
const category = ref("");
const categories = ref<LocalCategory[]>([]);
const preview = ref<{ validCount: number; invalidCount: number; totalCents: number } | null>(null);

const singleAccount = computed(() => accountsStore.items.length === 1);

async function loadCategories(): Promise<void> {
  if (!session.currentHouseholdId) return;
  categories.value = (
    await db.categories.where("household").equals(session.currentHouseholdId).toArray()
  ).filter((item) => !item.deleted_at);
}

function doParse(): void {
  const result = store.parse(text.value);
  preview.value = result;
  if (result.rows.length === 0) toast.error("Nenhum lançamento reconhecido.");
}

async function onFile(event: Event): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  text.value = await file.text();
  doParse();
}

async function confirmImport(): Promise<void> {
  if (!account.value) {
    toast.error("Selecione a conta de destino.");
    return;
  }
  const created = await store.confirm(account.value, category.value || null);
  toast.success(`${created} lançamento(s) importado(s).`);
  preview.value = null;
  text.value = "";
}

onMounted(async () => {
  await Promise.all([accountsStore.load(), loadCategories()]);
  if (singleAccount.value) account.value = accountsStore.items[0]?.id ?? "";
});
</script>

<template>
  <div class="space-y-4">
    <h1 class="text-xl font-bold">Importar extrato</h1>

    <Card>
      <CardHeader><CardTitle>CSV ou OFX</CardTitle></CardHeader>
      <CardContent class="space-y-4">
        <div class="space-y-2">
          <Label for="import-file">Arquivo</Label>
          <input
            id="import-file"
            type="file"
            accept=".csv,.ofx,text/csv"
            class="block w-full text-sm"
            @change="onFile"
          />
        </div>
        <div class="space-y-2">
          <Label for="import-text">Ou cole o conteúdo</Label>
          <Textarea id="import-text" v-model="text" :rows="5" placeholder="data;valor;descrição" />
        </div>
        <div class="space-y-2">
          <Label for="import-account">Conta de destino</Label>
          <Select id="import-account" v-model="account">
            <option value="">Selecione</option>
            <option v-for="item in accountsStore.items" :key="item.id" :value="item.id">
              {{ item.name }}
            </option>
          </Select>
        </div>
        <div class="space-y-2">
          <Label for="import-category">Categoria (padrão)</Label>
          <Select id="import-category" v-model="category">
            <option value="">Sem categoria</option>
            <option v-for="item in categories" :key="item.id" :value="item.id">{{ item.name }}</option>
          </Select>
        </div>
        <Button @click="doParse">Pré-visualizar</Button>
      </CardContent>
    </Card>

    <Card v-if="preview">
      <CardHeader>
        <CardTitle>Prévia</CardTitle>
        <p class="text-sm text-muted-foreground">
          {{ preview.validCount }} válidos · {{ preview.invalidCount }} inválidos · líquido
          {{ formatBRL(preview.totalCents) }}
        </p>
      </CardHeader>
      <CardContent class="space-y-3">
        <ul class="divide-y text-sm">
          <li
            v-for="(row, index) in store.rows"
            :key="index"
            class="flex items-center justify-between gap-2 py-2"
          >
            <span class="truncate">{{ row.description || "(sem descrição)" }}</span>
            <span class="flex items-center gap-2 whitespace-nowrap">
              {{ row.date ? formatDate(row.date) : "" }}
              <span :class="row.nature === 'entrada' ? 'text-emerald-600' : 'text-red-600'">
                {{ row.nature === "entrada" ? "+" : "-" }}{{ formatBRL(row.amountCents) }}
              </span>
              <Badge v-if="row.error" variant="destructive">erro</Badge>
            </span>
          </li>
        </ul>
        <Button :loading="store.importing" @click="confirmImport">Confirmar importação</Button>
      </CardContent>
    </Card>
  </div>
</template>
