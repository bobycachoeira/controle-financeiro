<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { RouterLink } from "vue-router";
import type { Attribution, TransactionStatus } from "@cf/shared";
import { todayISO } from "@cf/shared";
import { db, type LocalCategory } from "@/db/schema";
import { useTransactionsStore } from "@/stores/transactions";
import { useAccountsStore } from "@/stores/accounts";
import { useSessionStore } from "@/stores/session";
import { useSyncStore } from "@/stores/sync";
import { formatBRL, formatDate } from "@/lib/format";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import CardContent from "@/components/ui/CardContent.vue";
import Badge from "@/components/ui/Badge.vue";
import Input from "@/components/ui/Input.vue";
import Label from "@/components/ui/Label.vue";
import Select from "@/components/ui/Select.vue";

const transactionsStore = useTransactionsStore();
const accountsStore = useAccountsStore();
const session = useSessionStore();
const sync = useSyncStore();

const month = ref(todayISO().slice(0, 7));
const account = ref("");
const attribution = ref<"" | Attribution>("");
const status = ref<"" | TransactionStatus>("");
const categories = ref<LocalCategory[]>([]);

const accountById = computed(() => new Map(accountsStore.items.map((item) => [item.id, item.name])));
const categoryById = computed(() => new Map(categories.value.map((item) => [item.id, item.name])));

async function loadCategories(): Promise<void> {
  if (!session.currentHouseholdId) return;
  categories.value = (
    await db.categories.where("household").equals(session.currentHouseholdId).toArray()
  ).filter((category) => !category.deleted_at);
}

async function reload(): Promise<void> {
  await transactionsStore.load({
    month: month.value || undefined,
    account: account.value || undefined,
    attribution: attribution.value || undefined,
    status: status.value || undefined,
  });
}

async function loadAll(): Promise<void> {
  await Promise.all([accountsStore.load(), loadCategories(), reload()]);
}

onMounted(loadAll);
watch([month, account, attribution, status], reload);
watch(() => sync.dataVersion, loadAll);
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-bold">Lançamentos</h1>
      <RouterLink :to="{ name: 'transaction-new' }">
        <Button size="sm">Novo</Button>
      </RouterLink>
    </div>

    <Card>
      <CardContent class="grid grid-cols-2 gap-3 p-4">
        <div class="space-y-1">
          <Label for="filter-month">Mês</Label>
          <Input id="filter-month" v-model="month" type="month" />
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
          <Label for="filter-attribution">Atribuição</Label>
          <Select id="filter-attribution" v-model="attribution">
            <option value="">Todas</option>
            <option value="meu">Eu</option>
            <option value="dela">Ela</option>
            <option value="ambos">Ambos</option>
            <option value="indefinido">Indefinido</option>
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
      </CardContent>
    </Card>

    <Card>
      <CardContent class="p-0">
        <p v-if="transactionsStore.items.length === 0" class="p-4 text-sm text-muted-foreground">
          Nenhum lançamento no período.
        </p>
        <ul v-else class="divide-y">
          <li
            v-for="tx in transactionsStore.items"
            :key="tx.id"
            class="flex items-center justify-between gap-3 px-4 py-3 text-sm"
          >
            <div class="min-w-0">
              <p class="truncate font-medium">{{ tx.description || "Lançamento" }}</p>
              <p class="truncate text-xs text-muted-foreground">
                {{ formatDate(tx.date) }} ·
                {{ accountById.get(tx.account) ?? "" }}
                <template v-if="tx.category"> · {{ categoryById.get(tx.category) ?? "" }}</template>
              </p>
            </div>
            <div class="flex flex-col items-end gap-1">
              <span :class="tx.type === 'receita' ? 'text-emerald-600' : 'text-red-600'">
                {{ tx.type === "receita" ? "+" : "-" }}{{ formatBRL(tx.amount_cents) }}
              </span>
              <Badge v-if="tx.status === 'a_pagar'" variant="warning">A pagar</Badge>
            </div>
          </li>
        </ul>
      </CardContent>
    </Card>
  </div>
</template>
