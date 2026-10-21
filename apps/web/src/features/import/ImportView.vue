<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { RouterLink } from "vue-router";
import { useImportStore, type ImportDecision, type ImportPreview, type ImportRow } from "@/stores/import";
import { useAccountsStore } from "@/stores/accounts";
import { useSessionStore } from "@/stores/session";
import { useToast } from "@/composables/useToast";
import { formatBRL, formatDate } from "@/lib/format";
import { parseImportRules, type ImportRule } from "@/lib/import-rules";
import { db, type LocalCategory } from "@/db/schema";
import { loadHouseholdSetting } from "@/lib/household-settings";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import CardContent from "@/components/ui/CardContent.vue";
import CardHeader from "@/components/ui/CardHeader.vue";
import CardTitle from "@/components/ui/CardTitle.vue";
import Badge from "@/components/ui/Badge.vue";
import Label from "@/components/ui/Label.vue";
import Select from "@/components/ui/Select.vue";
import CategorySelect from "@/components/ui/CategorySelect.vue";
import Textarea from "@/components/ui/Textarea.vue";

const store = useImportStore();
const accountsStore = useAccountsStore();
const session = useSessionStore();
const toast = useToast();

const text = ref("");
const account = ref("");
const category = ref("");
const preview = ref<ImportPreview | null>(null);
const rules = ref<ImportRule[]>([]);
const matchedByRules = ref(0);
const categories = ref<LocalCategory[]>([]);

const singleAccount = computed(() => accountsStore.items.length === 1);

const projectedAfterCents = computed(() =>
  store.currentBalanceCents === null ? null : store.currentBalanceCents + store.projectedNetCents,
);

function diffLabel(cents: number): string {
  const sign = cents > 0 ? "+" : "-";
  return `${sign}${formatBRL(Math.abs(cents))}`;
}

async function refresh(): Promise<void> {
  if (account.value) await store.reconcile(account.value);
  preview.value = store.summary();
}

async function doParse(): Promise<void> {
  preview.value = store.parse(text.value);
  if (store.rows.length === 0) {
    toast.error("Nenhum lançamento reconhecido.");
    return;
  }
  matchedByRules.value = store.applyRules(rules.value);
  await refresh();
}

async function loadRules(): Promise<void> {
  if (!session.currentHouseholdId) return;
  rules.value = parseImportRules(
    await loadHouseholdSetting(session.currentHouseholdId, "import_rules", []),
  );
  categories.value = (
    await db.categories.where("household").equals(session.currentHouseholdId).toArray()
  ).filter((item) => !item.deleted_at);
}

function categoryName(id: string | null): string {
  if (!id) return "";
  return categories.value.find((item) => item.id === id)?.name ?? id;
}

async function onFile(event: Event): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  text.value = await file.text();
  await doParse();
}

function changeDecision(item: ImportRow, value: string): void {
  store.setDecision(item.row.externalRef, value as ImportDecision);
}

async function confirmImport(): Promise<void> {
  if (!account.value) {
    toast.error("Selecione a conta de destino.");
    return;
  }
  const result = await store.confirm(account.value, category.value || null);
  const parts = [`${result.created} importado(s)`];
  if (result.linked > 0) parts.push(`${result.linked} vinculado(s)`);
  if (result.ignored > 0) parts.push(`${result.ignored} ignorado(s)`);
  toast.success(parts.join(" · "));
  preview.value = null;
  text.value = "";
}

onMounted(async () => {
  await accountsStore.load();
  await loadRules();
  if (singleAccount.value) account.value = accountsStore.items[0]?.id ?? "";
});

watch(account, () => {
  if (store.rows.length > 0) void refresh();
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
          <CategorySelect id="import-category" v-model="category" kind="all" allow-empty />
        </div>
        <Button @click="doParse">Pré-visualizar</Button>
      </CardContent>
    </Card>

    <p class="px-1 text-xs text-muted-foreground">
      As regras de categorização por descrição são aplicadas sozinhas.
      <RouterLink :to="{ name: 'categories' }" class="font-bold text-primary">
        Gerenciar regras em Categorias
      </RouterLink>
    </p>

    <Card v-if="preview">
      <CardHeader>
        <CardTitle>Prévia</CardTitle>
        <p class="text-sm text-muted-foreground">
          {{ preview.validCount }} válidos · {{ preview.invalidCount }} inválidos · líquido
          {{ formatBRL(preview.totalCents) }}
        </p>
        <p v-if="preview.matchedCount > 0" class="text-xs font-bold text-amber-600">
          {{ preview.matchedCount }} possível(is) já lançado(s) — confira abaixo
        </p>
        <p v-if="matchedByRules > 0" class="text-xs font-bold text-primary">
          {{ matchedByRules }} linha(s) categorizadas por regra
        </p>
      </CardHeader>
      <CardContent class="space-y-3">
        <div
          v-if="store.statementBalanceCents !== null"
          class="space-y-1 rounded-2xl border-2 p-3 text-sm"
          :class="
            store.balanceDiffCents === 0
              ? 'border-leaf/40 bg-leaf/5'
              : 'border-amber-300 bg-sun/10'
          "
        >
          <p class="font-bold">Reconciliação de saldo</p>
          <p class="text-xs text-muted-foreground">
            Saldo do extrato: {{ formatBRL(store.statementBalanceCents) }}
            <template v-if="store.statementBalanceDate"> · {{ formatDate(store.statementBalanceDate) }}</template>
          </p>
          <p class="text-xs text-muted-foreground">
            Calculado após importar:
            {{ projectedAfterCents === null ? "—" : formatBRL(projectedAfterCents) }}
          </p>
          <p
            v-if="store.balanceDiffCents !== null"
            class="text-xs font-bold"
            :class="store.balanceDiffCents === 0 ? 'text-leaf' : 'text-amber-600'"
          >
            <template v-if="store.balanceDiffCents === 0">✓ Confere com o extrato</template>
            <template v-else>
              Diferença: {{ diffLabel(store.balanceDiffCents) }} — verifique lançamentos
              faltando/sobrando
            </template>
          </p>
        </div>

        <div v-if="preview.matchedCount > 0" class="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" @click="store.setAllMatched('ignore')">
            Ignorar todos os prováveis
          </Button>
          <Button size="sm" variant="outline" @click="store.setAllMatched('import')">
            Importar todos mesmo assim
          </Button>
        </div>
        <ul class="divide-y text-sm">
          <li
            v-for="item in store.rows"
            :key="item.row.externalRef"
            class="flex flex-col gap-1.5 py-2"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="truncate">
                {{ item.row.merchant || item.row.description || "(sem estabelecimento)" }}
                <span v-if="item.row.merchant && item.row.description" class="text-muted-foreground">
                  · {{ item.row.description }}
                </span>
              </span>
              <span class="flex items-center gap-2 whitespace-nowrap">
                {{ item.row.date ? formatDate(item.row.date) : "" }}
                <span :class="item.row.nature === 'entrada' ? 'text-emerald-600' : 'text-red-600'">
                  {{ item.row.nature === "entrada" ? "+" : "-" }}{{ formatBRL(item.row.amountCents) }}
                </span>
                <Badge v-if="item.row.error" variant="destructive">erro</Badge>
                <Badge v-else-if="item.match" variant="warning">já lançado?</Badge>
              </span>
            </div>
            <div v-if="!item.row.error" class="flex flex-wrap items-center gap-2">
              <Select
                :model-value="item.decision"
                class="max-w-[16rem] text-xs"
                @update:model-value="(value: string) => changeDecision(item, value)"
              >
                <option value="import">Importar</option>
                <option value="ignore">Ignorar</option>
                <option v-if="item.match" value="link">Vincular ao existente</option>
              </Select>
              <span v-if="item.match" class="min-w-0 truncate text-xs text-muted-foreground">
                existente: {{ item.match.description || "(sem descrição)" }} ·
                {{ formatDate(item.match.date) }}
              </span>
              <Badge v-if="item.category" variant="secondary">{{ categoryName(item.category) }}</Badge>
            </div>
          </li>
        </ul>
        <Button :loading="store.importing" @click="confirmImport">Confirmar importação</Button>
      </CardContent>
    </Card>
  </div>
</template>
