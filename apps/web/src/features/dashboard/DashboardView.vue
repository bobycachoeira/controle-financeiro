<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { RouterLink } from "vue-router";
import {
  balanceEvolution,
  computeBudgetUsage,
  computeSettlement,
  monthlyCashflow,
  todayISO,
} from "@cf/shared";
import { Sparkles } from "lucide-vue-next";
import { db, type LocalBill, type LocalCategory, type LocalInvoice } from "@/db/schema";
import { useSessionStore } from "@/stores/session";
import { useSyncStore } from "@/stores/sync";
import { useAccountsStore } from "@/stores/accounts";
import { useTransactionsStore } from "@/stores/transactions";
import { useCardsStore } from "@/stores/cards";
import { useRatesStore } from "@/stores/rates";
import { usePeopleStore } from "@/stores/people";
import { useTransfersStore } from "@/stores/transfers";
import { useToast } from "@/composables/useToast";
import { seedSampleData } from "@/lib/sample-data";
import {
  placeholderCategoryIds,
  REVIEW_WINDOW_DAYS,
  selectReviewQueue,
} from "@/features/review/review";
import { formatBRL, formatDate, formatMonth } from "@/lib/format";
import { accountIconName } from "@/lib/icons";
import {
  selectBalancesByAccount,
  selectCardUsage,
  selectCategoryBreakdown,
  selectConsolidatedBalance,
  selectOpenInvoices,
  selectRecentTransactions,
  selectSpendingColumns,
  selectToPay30Days,
  selectTotalBalance,
  selectUpcomingBills,
} from "./selectors";
import ConflictPanel from "@/features/sync/ConflictPanel.vue";
import AreaChart from "@/components/charts/AreaChart.vue";
import BarsChart from "@/components/charts/BarsChart.vue";
import Card from "@/components/ui/Card.vue";
import CardContent from "@/components/ui/CardContent.vue";
import Badge from "@/components/ui/Badge.vue";
import Button from "@/components/ui/Button.vue";
import Select from "@/components/ui/Select.vue";
import IconChip from "@/components/ui/IconChip.vue";

const session = useSessionStore();
const sync = useSyncStore();
const accountsStore = useAccountsStore();
const transactionsStore = useTransactionsStore();
const cardsStore = useCardsStore();
const ratesStore = useRatesStore();
const people = usePeopleStore();
const transfersStore = useTransfersStore();
const toast = useToast();
const seeding = ref(false);

const showSample = computed(
  () => !transactionsStore.loading && transactionsStore.items.length === 0,
);

async function createSample(): Promise<void> {
  seeding.value = true;
  try {
    const result = await seedSampleData();
    toast.success(`Dados de exemplo criados (${result.transactions} lançamentos).`);
    await loadAll();
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Falha ao criar os dados.");
  } finally {
    seeding.value = false;
  }
}

const bills = ref<LocalBill[]>([]);
const invoices = ref<LocalInvoice[]>([]);
const categories = ref<LocalCategory[]>([]);
const budgetAlerts = ref<{ id: string; name: string; percent: number; category: string | null }[]>([]);
const today = todayISO();
const currentMonth = today.slice(0, 7);

const cashflow = computed(() => monthlyCashflow(transactionsStore.items, currentMonth, 6));
const balancePoints = computed(() =>
  balanceEvolution(accountsStore.items, transactionsStore.items, currentMonth, 6).map((point) => ({
    label: point.label,
    value: point.balanceCents,
  })),
);
const cashflowLabels = computed(() => cashflow.value.map((point) => point.label));
const cashflowSeries = computed(() => [
  { label: "Receitas", color: "#3F9A6A", values: cashflow.value.map((point) => point.receitasCents) },
  { label: "Despesas", color: "#E4572E", values: cashflow.value.map((point) => point.despesasCents) },
]);
const hasCashflow = computed(() =>
  cashflow.value.some((point) => point.receitasCents > 0 || point.despesasCents > 0),
);
const currentBucket = computed(() => cashflow.value[cashflow.value.length - 1]);
const previousMonthKey = computed(() => {
  const date = new Date(`${currentMonth}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() - 1);
  return date.toISOString().slice(0, 7);
});
const categoryAccount = ref("");
const accountFilterOptions = computed(() => [
  ...accountsStore.items
    .filter((account) => account.type !== "cartao_credito")
    .map((account) => ({ id: account.id, label: account.name })),
  ...cardsStore.cards
    .map((card) => ({ id: card.account, label: card.bank?.trim() || "Cartão" }))
    .filter((option) => accountsStore.items.some((account) => account.id === option.id)),
]);
const categoryBreakdown = computed(() =>
  selectCategoryBreakdown({
    transactions: transactionsStore.items,
    categories: categories.value,
    month: currentMonth,
    previousMonth: previousMonthKey.value,
    accountId: categoryAccount.value || undefined,
    limit: 4,
  }),
);

const firstName = computed(() => (session.user?.name ?? "").split(" ")[0] || "olá");
const balance = computed(() => selectTotalBalance(accountsStore.items, transactionsStore.items));
const consolidated = computed(() =>
  selectConsolidatedBalance(accountsStore.items, transactionsStore.items, ratesStore.items, today),
);
const hasForeignCurrency = computed(() =>
  accountsStore.items.some((account) => (account.currency || "BRL") !== "BRL"),
);
const byAccount = computed(() =>
  selectBalancesByAccount(
    accountsStore.items.filter((account) => account.type !== "cartao_credito"),
    transactionsStore.items,
  ),
);
const spendingColumns = computed(() =>
  selectSpendingColumns(
    transactionsStore.items,
    people.options.map((option) => ({ key: option.key, label: option.label })),
  ),
);
const upcoming = computed(() => selectUpcomingBills(bills.value, today));
const openInvoices = computed(() => selectOpenInvoices(invoices.value));
const openInvoicesTotal = computed(() =>
  openInvoices.value.reduce(
    (sum, invoice) => sum + Math.max(0, invoice.total_cents - (invoice.paid_cents ?? 0)),
    0,
  ),
);
const reviewQueue = computed(() =>
  selectReviewQueue(transactionsStore.items, {
    uncategorizedIds: placeholderCategoryIds(categories.value),
    knownIds: new Set(categories.value.map((category) => category.id)),
    today,
    days: REVIEW_WINDOW_DAYS,
  }),
);
const cardUsage = computed(() =>
  selectCardUsage(
    transactionsStore.items,
    openInvoicesTotal.value,
    cardsStore.cards.length,
    currentMonth,
  ),
);
const recent = computed(() => selectRecentTransactions(transactionsStore.items));
const toPay = computed(() => selectToPay30Days(transactionsStore.items, today));
const settleSummary = computed(() => {
  const ownerByAccount = new Map(
    accountsStore.items.map((account) => [account.id, account.owner ?? "indefinido"]),
  );
  return computeSettlement({
    people: people.options.map((option) => ({ key: option.key, label: option.label })),
    legacyMap: { meu: 0, dela: 1 },
    month: currentMonth,
    transactions: transactionsStore.items,
    transfers: transfersStore.items.map((transfer) => ({
      amount_cents: transfer.amount_cents,
      date: transfer.date,
      description: transfer.description,
      source_owner: ownerByAccount.get(transfer.source_account) ?? null,
      destination_owner: ownerByAccount.get(transfer.destination_account) ?? null,
      deleted_at: transfer.deleted_at,
    })),
  });
});
const settleLabelByKey = computed(
  () => new Map(settleSummary.value.people.map((person) => [person.key, person.label])),
);

async function loadExtras(): Promise<void> {
  if (!session.currentHouseholdId) return;
  const h = session.currentHouseholdId;
  bills.value = (await db.bills.where("household").equals(h).toArray()).filter((b) => !b.deleted_at);
  invoices.value = (await db.invoices.where("household").equals(h).toArray()).filter(
    (invoice) => !invoice.deleted_at,
  );
  categories.value = (await db.categories.where("household").equals(h).toArray()).filter(
    (category) => !category.deleted_at,
  );
  const budgets = (await db.budgets.where("household").equals(h).toArray()).filter(
    (budget) => !budget.deleted_at && budget.active !== false,
  );
  budgetAlerts.value = budgets
    .map((budget) => {
      const usage = computeBudgetUsage(budget, transactionsStore.items, bills.value);
      return { budget, percent: usage.percent };
    })
    .filter(({ budget, percent }) => percent >= budget.alert_pct)
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 2)
    .map(({ budget, percent }) => ({
      id: budget.id,
      name: budget.name,
      percent,
      category: budget.categories[0]?.category ?? null,
    }));
}

async function loadAll(): Promise<void> {
  await Promise.all([
    accountsStore.load(),
    transactionsStore.load(),
    cardsStore.load(),
    ratesStore.load(),
    people.load(),
    transfersStore.load(),
    loadExtras(),
  ]);
}

onMounted(loadAll);
watch(() => sync.dataVersion, loadAll);
</script>

<template>
  <div class="space-y-5">
    <div class="flex items-center gap-3">
      <div
        v-if="session.user?.avatar"
        class="h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 border-primary/20"
      >
        <img :src="session.user.avatar" alt="" class="h-full w-full object-cover" />
      </div>
      <div>
        <p class="text-xs font-extrabold uppercase tracking-wider text-primary">Painel da família</p>
        <h1 class="font-display text-3xl font-black tracking-tight">Olá, {{ firstName }}!</h1>
      </div>
    </div>

    <ConflictPanel />

    <Card class="relative overflow-hidden border-none bg-gradient-to-br from-primary to-[hsl(352_60%_38%)] text-primary-foreground">
      <div class="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full bg-sun/30 blur-2xl" />
      <CardContent class="relative p-6">
        <p class="text-xs font-extrabold uppercase tracking-wider opacity-80">Saldo total</p>
        <p class="mt-1 font-display text-4xl font-black tracking-tight">
          {{ formatBRL(hasForeignCurrency ? consolidated.totalCents : balance) }}
        </p>
        <p v-if="hasForeignCurrency" class="mt-1 text-xs font-semibold opacity-80">
          consolidado em BRL
          <template v-if="consolidated.missing.length"> · sem cotação: {{ consolidated.missing.join(", ") }}</template>
        </p>
        <div class="mt-4 flex items-center gap-2">
          <span class="rounded-full bg-white/15 px-3 py-1 text-xs font-extrabold">
            A pagar 30 dias · {{ formatBRL(toPay) }}
          </span>
          <span class="rounded-full bg-white/15 px-3 py-1 text-xs font-extrabold">
            {{ sync.online ? (sync.pending > 0 ? `${sync.pending} pendente(s)` : "sincronizado") : "offline" }}
          </span>
        </div>
      </CardContent>
    </Card>

    <Card v-if="showSample" data-testid="sample-card">
      <CardContent class="space-y-2 p-4">
        <div class="flex items-center gap-2">
          <Sparkles class="h-4 w-4 text-primary" />
          <h2 class="font-display text-base font-bold">Novo por aqui?</h2>
        </div>
        <p class="text-xs text-muted-foreground">
          Crie dados de exemplo para ver o app preenchido e entender como funciona. Você pode apagar
          depois.
        </p>
        <Button size="sm" :loading="seeding" @click="createSample">
          Criar dados de exemplo
        </Button>
      </CardContent>
    </Card>

    <Card v-if="reviewQueue.length > 0" data-testid="review-card" class="border-amber-300">
      <CardContent class="flex flex-wrap items-center gap-3 p-4">
        <div class="min-w-0 flex-1">
          <p class="font-bold">{{ reviewQueue.length }} lançamento(s) para revisar</p>
          <p class="text-xs text-muted-foreground">
            Sem categoria (ou em “Outros”) nos últimos 30 dias — categorize para os relatórios
            ficarem certos.
          </p>
        </div>
        <RouterLink :to="{ name: 'review' }" class="flex shrink-0">
          <Button size="sm" variant="secondary">Revisar</Button>
        </RouterLink>
      </CardContent>
    </Card>

    <Card
      v-if="budgetAlerts.length > 0 || categoryBreakdown.entries.length > 0"
      data-testid="decide-card"
    >
      <CardContent class="space-y-3 p-4">
        <div class="flex items-center gap-2">
          <IconChip name="tag" color="#B0477E" size="sm" />
          <h2 class="font-display text-lg font-bold">Onde foi a grana</h2>
          <RouterLink
            :to="{ name: 'transactions', query: { month: currentMonth } }"
            class="ml-auto flex h-11 items-center text-xs font-bold text-primary"
          >
            Ver lançamentos
          </RouterLink>
        </div>

        <RouterLink
          v-for="alert in budgetAlerts"
          :key="alert.id"
          :to="{
            name: 'transactions',
            query: { month: currentMonth, ...(alert.category ? { category: alert.category } : {}) },
          }"
          class="flex min-h-11 items-center justify-between gap-2 rounded-2xl bg-sun/20 px-3 py-2.5 text-xs font-semibold text-accent-foreground"
        >
          <span class="truncate">{{ alert.name }} em {{ alert.percent }}% do orçamento — vale olhar.</span>
          <span aria-hidden="true">›</span>
        </RouterLink>

        <RouterLink
          v-if="categoryBreakdown.topIncrease && categoryBreakdown.topIncrease.categoryId"
          :to="{
            name: 'transactions',
            query: { month: currentMonth, category: categoryBreakdown.topIncrease.categoryId },
          }"
          class="flex min-h-11 items-center justify-between gap-2 rounded-2xl bg-sun/20 px-3 py-2.5 text-xs font-semibold text-accent-foreground"
        >
          <span class="truncate">
            {{ categoryBreakdown.topIncrease.name }} subiu
            {{ categoryBreakdown.topIncrease.deltaPercent }}% vs mês passado — ver lançamentos.
          </span>
          <span aria-hidden="true">›</span>
        </RouterLink>

        <Select
          v-model="categoryAccount"
          aria-label="Filtrar gastos por conta"
          data-testid="category-filter"
        >
          <option value="">Todas as contas</option>
          <option v-for="option in accountFilterOptions" :key="option.id" :value="option.id">
            {{ option.label }}
          </option>
        </Select>
        <p v-if="categoryBreakdown.entries.length === 0" class="text-sm text-muted-foreground">
          Sem despesas nesse filtro.
        </p>
        <ul v-else class="space-y-2.5">
          <li v-for="entry in categoryBreakdown.entries" :key="entry.name" class="space-y-1">
            <div class="flex items-center justify-between gap-2 text-sm">
              <span class="truncate font-semibold">{{ entry.name }}</span>
              <span class="flex shrink-0 items-center gap-2">
                <span class="font-display font-bold">{{ formatBRL(entry.totalCents) }}</span>
                <span class="text-xs text-muted-foreground">{{ entry.percentOfTotal }}%</span>
                <span
                  v-if="entry.deltaPercent !== null && entry.deltaPercent !== 0"
                  class="text-[0.62rem] font-bold"
                  :class="entry.deltaPercent > 0 ? 'text-destructive' : 'text-leaf'"
                >
                  {{ entry.deltaPercent > 0 ? "↑" : "↓" }}{{ Math.abs(entry.deltaPercent) }}%
                </span>
              </span>
            </div>
            <div class="h-1.5 w-full overflow-hidden rounded-full bg-muted/70">
              <div
                class="h-full rounded-full"
                :style="{ width: entry.percentOfTotal + '%', backgroundColor: entry.color }"
              />
            </div>
          </li>
        </ul>
      </CardContent>
    </Card>

    <Card>
      <CardContent class="p-4">
        <div class="mb-2 flex items-center gap-2">
          <IconChip name="wallet" color="#3B82B6" size="sm" />
          <h2 class="font-display text-lg font-bold">Saldos por conta</h2>
        </div>
        <p v-if="byAccount.length === 0" class="text-sm text-muted-foreground">
          Nenhuma conta cadastrada ainda.
        </p>
        <ul v-else class="divide-y">
          <li
            v-for="row in byAccount"
            :key="row.account.id"
            class="flex items-center gap-3 py-2.5 text-sm"
          >
            <IconChip
              :name="row.account.icon ?? accountIconName(row.account.type)"
              :color="row.account.color"
              :seed="row.account.name"
              size="sm"
            />
            <span class="flex-1 truncate font-bold">{{ row.account.name }}</span>
            <span class="font-display font-bold">{{ formatBRL(row.balance) }}</span>
          </li>
        </ul>
      </CardContent>
    </Card>

    <Card>
      <CardContent class="p-4">
        <div class="mb-3 flex items-center gap-2">
          <IconChip name="hand-coins" color="#E4572E" size="sm" />
          <h2 class="font-display text-lg font-bold">Gastos do mês</h2>
        </div>
        <div class="flex flex-wrap gap-3 text-center">
          <div
            v-for="column in spendingColumns"
            :key="column.key"
            class="min-w-[6.5rem] flex-1 rounded-2xl bg-muted px-2 py-3"
          >
            <p class="truncate text-[0.62rem] font-extrabold uppercase tracking-wider text-muted-foreground">
              {{ column.label }}
            </p>
            <p class="font-display font-bold">{{ formatBRL(column.totalCents) }}</p>
          </div>
        </div>
      </CardContent>
    </Card>

    <Card v-if="hasCashflow || balancePoints.length > 0">
      <CardContent class="space-y-5 p-4">
        <div>
          <div class="mb-2 flex items-center gap-2">
            <IconChip name="coins" color="#3F9A6A" size="sm" />
            <h2 class="font-display text-lg font-bold">Evolução do saldo</h2>
          </div>
          <AreaChart :points="balancePoints" color="#3F9A6A" />
        </div>

        <div v-if="hasCashflow" class="border-t border-border/60 pt-4">
          <div class="mb-3 flex items-center gap-2">
            <IconChip name="receipt" color="#E4572E" size="sm" />
            <h2 class="font-display text-lg font-bold">Receitas x despesas</h2>
          </div>
          <BarsChart :categories="cashflowLabels" :series="cashflowSeries" />
          <div class="mt-2 flex items-center justify-center gap-3 text-xs font-bold">
            <span class="text-leaf">+{{ formatBRL(currentBucket?.receitasCents ?? 0) }}</span>
            <span class="text-primary">−{{ formatBRL(currentBucket?.despesasCents ?? 0) }}</span>
            <span
              :class="(currentBucket?.netCents ?? 0) >= 0 ? 'text-leaf' : 'text-destructive'"
            >
              sobra
              {{ (currentBucket?.netCents ?? 0) >= 0 ? "+" : "−" }}{{ formatBRL(Math.abs(currentBucket?.netCents ?? 0)) }}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>

    <div class="grid grid-cols-2 gap-4">
      <Card>
        <CardContent class="p-4">
          <div class="mb-2 flex items-center gap-2">
            <IconChip name="calendar-clock" color="#F2A93B" size="sm" />
            <h2 class="font-display text-base font-bold">Vence em 7 dias</h2>
          </div>
          <p v-if="upcoming.length === 0" class="text-xs text-muted-foreground">Nada a vencer.</p>
          <ul v-else class="space-y-2">
            <li v-for="bill in upcoming" :key="bill.id" class="text-sm">
              <p class="truncate font-bold">{{ bill.title }}</p>
              <p class="text-xs text-muted-foreground">
                {{ formatDate(bill.due_date) }} · {{ formatBRL(bill.amount_cents) }}
              </p>
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent class="p-4">
          <div class="mb-2 flex items-center gap-2">
            <IconChip name="credit-card" color="#B0477E" size="sm" />
            <h2 class="font-display text-base font-bold">Faturas abertas</h2>
          </div>
          <p v-if="openInvoices.length === 0" class="text-xs text-muted-foreground">Nenhuma fatura.</p>
          <ul v-else class="space-y-2">
            <li v-for="invoice in openInvoices" :key="invoice.id" class="text-sm">
              <p class="font-bold">{{ formatBRL(invoice.total_cents) }}</p>
              <p class="text-xs text-muted-foreground">
                <span class="first-letter:uppercase">{{ formatMonth(invoice.reference_month) }}</span> ·
                <Badge :variant="invoice.status === 'vencida' ? 'destructive' : 'secondary'">{{ invoice.status }}</Badge>
              </p>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>

    <Card v-if="cardUsage.cardsCount > 0 || cardUsage.spentCents > 0" data-testid="card-usage">
      <CardContent class="p-4">
        <div class="mb-2 flex items-center gap-2">
          <IconChip name="credit-card" color="#B0477E" size="sm" />
          <h2 class="font-display text-base font-bold">Cartões neste mês</h2>
        </div>
        <div class="grid grid-cols-2 gap-2 text-center">
          <div class="rounded-2xl bg-muted/60 p-2">
            <p class="text-[0.6rem] font-extrabold uppercase tracking-wider text-muted-foreground">
              Gasto no cartão
            </p>
            <p class="font-display text-sm font-bold">{{ formatBRL(cardUsage.spentCents) }}</p>
          </div>
          <div class="rounded-2xl bg-muted/60 p-2">
            <p class="text-[0.6rem] font-extrabold uppercase tracking-wider text-muted-foreground">
              % dos gastos
            </p>
            <p class="font-display text-sm font-bold">{{ cardUsage.percentOfSpending }}%</p>
          </div>
        </div>
        <p class="mt-2 text-xs text-muted-foreground">
          Faturas abertas: {{ formatBRL(cardUsage.openInvoicesCents) }} ·
          <template v-if="cardUsage.percentOfSpending >= 50">
            mais da metade do mês foi no cartão.
          </template>
          <template v-else>confira os detalhes em Cartões.</template>
        </p>
      </CardContent>
    </Card>

    <Card>
      <CardContent class="p-4">
        <div class="mb-2 flex items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <IconChip name="hand-coins" color="#3F9A6A" size="sm" />
            <h2 class="font-display text-base font-bold">
              {{ people.splitMode === "dividir" ? "Acerto do mês" : "Contribuições do mês" }}
            </h2>
          </div>
          <RouterLink :to="{ name: 'settle' }" data-compact class="text-xs font-bold text-primary">
            Ver
          </RouterLink>
        </div>
        <template v-if="people.splitMode === 'dividir'">
          <p v-if="settleSummary.suggestions.length === 0" class="text-xs text-muted-foreground">
            Tudo acertado neste mês.
          </p>
          <ul v-else class="space-y-1 text-sm">
            <li
              v-for="suggestion in settleSummary.suggestions.slice(0, 2)"
              :key="`${suggestion.fromKey}-${suggestion.toKey}`"
              class="flex items-center justify-between gap-2"
            >
              <span class="truncate font-semibold">
                {{ settleLabelByKey.get(suggestion.fromKey) ?? suggestion.fromKey }} →
                {{ settleLabelByKey.get(suggestion.toKey) ?? suggestion.toKey }}
              </span>
              <span class="font-display font-bold">{{ formatBRL(suggestion.amountCents) }}</span>
            </li>
          </ul>
        </template>
        <ul v-else class="space-y-1 text-sm">
          <li
            v-for="person in settleSummary.people"
            :key="person.key"
            class="flex items-center justify-between gap-2"
          >
            <span class="truncate font-semibold">{{ person.label }}</span>
            <span class="text-muted-foreground">pagou {{ formatBRL(person.paidCents) }}</span>
          </li>
        </ul>
      </CardContent>
    </Card>

    <Card>
      <CardContent class="p-4">
        <div class="mb-2 flex items-center gap-2">
          <IconChip name="receipt" color="#3F9A6A" size="sm" />
          <h2 class="font-display text-lg font-bold">Recentes</h2>
        </div>
        <p v-if="recent.length === 0" class="text-sm text-muted-foreground">Nada por aqui ainda.</p>
        <ul v-else class="divide-y">
          <li v-for="tx in recent" :key="tx.id" class="flex items-center justify-between py-2.5 text-sm">
            <span class="truncate font-semibold">{{ tx.description || "Lançamento" }}</span>
            <span class="font-display font-bold" :class="tx.type === 'receita' ? 'text-leaf' : 'text-foreground'">
              {{ tx.type === "receita" ? "+" : "−" }}{{ formatBRL(tx.amount_cents) }}
            </span>
          </li>
        </ul>
      </CardContent>
    </Card>

    <div class="flex items-center justify-center gap-2 pb-2 text-xs font-bold text-muted-foreground">
      <Sparkles class="h-3.5 w-3.5" />
      Feito com carinho para a sua família
    </div>
  </div>
</template>
