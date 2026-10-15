<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { RouterLink } from "vue-router";
import type { TransactionStatus, TransactionType } from "@cf/shared";
import { todayISO } from "@cf/shared";
import { Pencil, Plus, Receipt, Search, Trash2, X } from "lucide-vue-next";
import { db, type LocalCategory, type LocalTransaction } from "@/db/schema";
import { useTransactionsStore } from "@/stores/transactions";
import { useAccountsStore } from "@/stores/accounts";
import { useSessionStore } from "@/stores/session";
import { usePeopleStore } from "@/stores/people";
import { useSyncStore } from "@/stores/sync";
import { useToast } from "@/composables/useToast";
import { formatBRL, formatDateShort } from "@/lib/format";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import CardContent from "@/components/ui/CardContent.vue";
import Badge from "@/components/ui/Badge.vue";
import Input from "@/components/ui/Input.vue";
import Label from "@/components/ui/Label.vue";
import Select from "@/components/ui/Select.vue";
import Modal from "@/components/ui/Modal.vue";
import IconChip from "@/components/ui/IconChip.vue";

const transactionsStore = useTransactionsStore();
const accountsStore = useAccountsStore();
const session = useSessionStore();
const people = usePeopleStore();
const sync = useSyncStore();
const toast = useToast();

const month = ref(todayISO().slice(0, 7));
const account = ref("");
const attribution = ref("");
const status = ref<"" | TransactionStatus>("");
const reconciled = ref<"all" | "yes" | "no">("all");
const category = ref("");
const type = ref<"" | TransactionType>("");
const tag = ref("");
const query = ref("");
const viewingPhoto = ref<string | null>(null);
const categories = ref<LocalCategory[]>([]);
const allTags = ref<string[]>([]);
const installmentsByRoot = ref<Map<string, { number: number; total: number }>>(new Map());

const accountById = computed(() => new Map(accountsStore.items.map((item) => [item.id, item])));
const categoryById = computed(() => new Map(categories.value.map((item) => [item.id, item])));

const hasFilters = computed(
  () =>
    Boolean(query.value || category.value || type.value || tag.value) ||
    attribution.value !== "" ||
    status.value !== "" ||
    reconciled.value !== "all",
);

function clearFilters(): void {
  query.value = "";
  category.value = "";
  type.value = "";
  tag.value = "";
  attribution.value = "";
  status.value = "";
  reconciled.value = "all";
}

async function loadFiltersData(): Promise<void> {
  if (!session.currentHouseholdId) return;
  categories.value = (
    await db.categories.where("household").equals(session.currentHouseholdId).toArray()
  ).filter((item) => !item.deleted_at);
  const transactions = await db.transactions
    .where("household")
    .equals(session.currentHouseholdId)
    .toArray();
  const tags = new Set<string>();
  for (const tx of transactions) {
    if (tx.deleted_at) continue;
    for (const item of tx.tags ?? []) tags.add(item);
  }
  allTags.value = [...tags].sort((a, b) => a.localeCompare(b));

  const installmentRows = await db.installments
    .where("household")
    .equals(session.currentHouseholdId)
    .toArray();
  const byRoot = new Map<string, { number: number; total: number }>();
  for (const row of installmentRows) {
    if (!row.deleted_at) byRoot.set(row.root_transaction, { number: row.number, total: row.total });
  }
  installmentsByRoot.value = byRoot;
}

function installmentLabel(tx: LocalTransaction): string | null {
  const info = installmentsByRoot.value.get(tx.id);
  return info && info.total > 1 ? `${info.number}/${info.total}` : null;
}

async function reload(): Promise<void> {
  await transactionsStore.load({
    month: month.value || undefined,
    account: account.value || undefined,
    attribution: attribution.value || undefined,
    status: status.value || undefined,
    category: category.value || undefined,
    type: type.value || undefined,
    tag: tag.value || undefined,
    query: query.value || undefined,
    reconciled: reconciled.value === "all" ? undefined : reconciled.value,
  });
}

async function loadAll(): Promise<void> {
  await Promise.all([accountsStore.load(), loadFiltersData(), people.load(), reload()]);
}

async function removeTransaction(id: string): Promise<void> {
  await transactionsStore.remove(id);
  toast.info("Lançamento removido.");
}

function accountName(id: string): string {
  return accountById.value.get(id)?.name ?? "";
}

function attributionLabel(attribution: string): string {
  if (attribution === "indefinido") return "";
  return people.label(attribution);
}

function amountLabel(tx: LocalTransaction): string {
  if (tx.type === "transferencia") {
    return `${tx.amount_cents < 0 ? "−" : "+"}${formatBRL(Math.abs(tx.amount_cents))}`;
  }
  return `${tx.type === "receita" ? "+" : "−"}${formatBRL(tx.amount_cents)}`;
}

onMounted(loadAll);
watch([month, account, attribution, status, reconciled, category, type, tag, query], reload);
watch(() => sync.dataVersion, loadAll);
</script>

<template>
  <div class="space-y-5">
    <div class="flex items-end justify-between gap-3">
      <div>
        <p class="text-xs font-extrabold uppercase tracking-wider text-primary">Movimento</p>
        <h1 class="font-display text-3xl font-black tracking-tight">Lançamentos</h1>
      </div>
      <RouterLink :to="{ name: 'transaction-new' }">
        <Button size="sm"><Plus class="h-4 w-4" /> Novo</Button>
      </RouterLink>
    </div>

    <Card>
      <CardContent class="space-y-3 p-4">
        <div class="relative">
          <Search
            class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="filter-query"
            v-model="query"
            class="pl-9"
            placeholder="Buscar por descrição, nota ou etiqueta…"
          />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1">
            <Label for="filter-month">Mês</Label>
            <Input id="filter-month" v-model="month" type="month" />
          </div>
          <div class="space-y-1">
            <Label for="filter-type">Tipo</Label>
            <Select id="filter-type" v-model="type">
              <option value="">Todos</option>
              <option value="despesa">Despesas</option>
              <option value="receita">Receitas</option>
              <option value="transferencia">Transferências</option>
            </Select>
          </div>
          <div class="space-y-1">
            <Label for="filter-account">Conta</Label>
            <Select id="filter-account" v-model="account">
              <option value="">Todas</option>
              <option v-for="item in accountsStore.items" :key="item.id" :value="item.id">
                {{ item.name }}
              </option>
            </Select>
          </div>
          <div class="space-y-1">
            <Label for="filter-category">Categoria</Label>
            <Select id="filter-category" v-model="category">
              <option value="">Todas</option>
              <option v-for="item in categories" :key="item.id" :value="item.id">
                {{ item.name }}
              </option>
            </Select>
          </div>
          <div class="space-y-1">
            <Label for="filter-attribution">Atribuição</Label>
            <Select id="filter-attribution" v-model="attribution">
              <option value="">Todas</option>
              <option v-for="option in people.selectable" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </Select>
          </div>
          <div class="space-y-1">
            <Label for="filter-status">Status</Label>
            <Select id="filter-status" v-model="status">
              <option value="">Todos</option>
              <option value="pago">Pago</option>
              <option value="a_pagar">A pagar</option>
            </Select>
          </div>
          <div class="space-y-1">
            <Label for="filter-reconciled">Conciliação</Label>
            <Select id="filter-reconciled" v-model="reconciled">
              <option value="all">Todos</option>
              <option value="yes">Conciliados</option>
              <option value="no">Não conciliados</option>
            </Select>
          </div>
          <div v-if="allTags.length > 0" class="space-y-1">
            <Label for="filter-tag">Etiqueta</Label>
            <Select id="filter-tag" v-model="tag">
              <option value="">Todas</option>
              <option v-for="item in allTags" :key="item" :value="item">{{ item }}</option>
            </Select>
          </div>
        </div>
        <button
          v-if="hasFilters"
          type="button"
          class="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground transition hover:text-primary"
          @click="clearFilters"
        >
          <X class="h-3.5 w-3.5" /> Limpar filtros
        </button>
      </CardContent>
    </Card>

    <Card>
      <CardContent class="p-2">
        <p
          v-if="transactionsStore.items.length === 0"
          class="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-muted-foreground"
        >
          <Receipt class="h-8 w-8 text-muted-foreground/50" />
          Nenhum lançamento no período.
        </p>
        <ul v-else class="stagger">
          <li
            v-for="tx in transactionsStore.items"
            :key="tx.id"
            class="group flex items-center gap-3 rounded-[1.3rem] px-2 py-3 transition hover:bg-muted/70"
          >
            <IconChip
              :name="categoryById.get(tx.category ?? '')?.icon ?? (tx.type === 'receita' ? 'hand-coins' : 'tag')"
              :color="categoryById.get(tx.category ?? '')?.color"
              :seed="tx.category ?? tx.type"
            />
            <button
              v-if="tx.attachment"
              type="button"
              data-testid="tx-photo"
              class="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-border"
              aria-label="Ver comprovante"
              @click="viewingPhoto = tx.attachment ?? null"
            >
              <img :src="tx.attachment" alt="" class="h-full w-full object-cover" />
            </button>
            <div class="min-w-0 flex-1">
              <p class="truncate font-bold">
                {{ tx.description || "Lançamento" }}
                <Badge v-if="installmentLabel(tx)" variant="secondary" class="ml-1 align-middle">
                  parcela {{ installmentLabel(tx) }}
                </Badge>
              </p>
              <p class="line-clamp-2 break-words text-xs font-semibold leading-snug text-muted-foreground">
                {{ formatDateShort(tx.date) }}
                <template v-if="accountName(tx.account)"> · {{ accountName(tx.account) }}</template>
                <template v-if="categoryById.get(tx.category ?? '')">
                  · {{ categoryById.get(tx.category ?? '')?.name }}</template
                >
                <template v-if="attributionLabel(tx.attribution)">
                  · {{ attributionLabel(tx.attribution) }}</template
                >
              </p>
              <div v-if="(tx.tags ?? []).length > 0" class="mt-1 flex flex-wrap gap-1">
                <span
                  v-for="item in tx.tags.slice(0, 3)"
                  :key="item"
                  class="rounded-full bg-muted px-2 py-0.5 text-[0.58rem] font-bold text-muted-foreground"
                >
                  #{{ item }}
                </span>
              </div>
            </div>
            <div class="flex flex-col items-end gap-1">
              <span
                class="font-display font-bold"
                :class="tx.amount_cents < 0 ? 'text-primary' : 'text-leaf'"
              >
                {{ amountLabel(tx) }}
              </span>
              <Badge v-if="tx.status === 'a_pagar'" variant="warning">a pagar</Badge>
              <Badge v-if="tx.external_ref" variant="success">conciliado</Badge>
            </div>
            <div class="flex gap-1 opacity-100 transition md:opacity-0 md:group-hover:opacity-100">
              <RouterLink
                :to="{ name: 'transaction-edit', params: { id: tx.id } }"
                class="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:bg-card hover:text-primary"
                aria-label="Editar lançamento"
              >
                <Pencil class="h-3.5 w-3.5" />
              </RouterLink>
              <button
                class="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:bg-card hover:text-destructive"
                aria-label="Excluir lançamento"
                @click="removeTransaction(tx.id)"
              >
                <Trash2 class="h-3.5 w-3.5" />
              </button>
            </div>
          </li>
        </ul>
      </CardContent>
    </Card>

    <Modal
      :model-value="Boolean(viewingPhoto)"
      title="Comprovante"
      @update:model-value="viewingPhoto = null"
    >
      <img
        v-if="viewingPhoto"
        :src="viewingPhoto"
        alt="Comprovante"
        class="max-h-[70vh] w-full rounded-2xl object-contain"
      />
    </Modal>
  </div>
</template>
