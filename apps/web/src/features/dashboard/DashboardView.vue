<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { balanceEvolution, monthlyCashflow, spendingByCategory, todayISO } from "@cf/shared";
import { Sparkles } from "lucide-vue-next";
import { db, type LocalBill, type LocalCategory, type LocalInvoice } from "@/db/schema";
import { useSessionStore } from "@/stores/session";
import { useSyncStore } from "@/stores/sync";
import { useAccountsStore } from "@/stores/accounts";
import { useTransactionsStore } from "@/stores/transactions";
import { useCardsStore } from "@/stores/cards";
import { useRatesStore } from "@/stores/rates";
import { usePeopleStore } from "@/stores/people";
import { formatBRL, formatDate } from "@/lib/format";
import { accountIconName } from "@/lib/icons";
import {
  selectBalancesByAccount,
  selectConsolidatedBalance,
  selectOpenInvoices,
  selectRecentTransactions,
  selectSpendingByAttribution,
  selectToPay30Days,
  selectTotalBalance,
  selectUpcomingBills,
} from "./selectors";
import ConflictPanel from "@/features/sync/ConflictPanel.vue";
import AreaChart from "@/components/charts/AreaChart.vue";
import BarsChart from "@/components/charts/BarsChart.vue";
import CategoryBars from "@/components/charts/CategoryBars.vue";
import Card from "@/components/ui/Card.vue";
import CardContent from "@/components/ui/CardContent.vue";
import Badge from "@/components/ui/Badge.vue";
import IconChip from "@/components/ui/IconChip.vue";

const session = useSessionStore();
const sync = useSyncStore();
const accountsStore = useAccountsStore();
const transactionsStore = useTransactionsStore();
const cardsStore = useCardsStore();
const ratesStore = useRatesStore();
const people = usePeopleStore();

const bills = ref<LocalBill[]>([]);
const invoices = ref<LocalInvoice[]>([]);
const categories = ref<LocalCategory[]>([]);
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
const topCategories = computed(() =>
  spendingByCategory(transactionsStore.items, categories.value, currentMonth, 5),
);

const firstName = computed(() => (session.user?.name ?? "").split(" ")[0] || "olá");
const balance = computed(() => selectTotalBalance(accountsStore.items, transactionsStore.items));
const consolidated = computed(() =>
  selectConsolidatedBalance(accountsStore.items, transactionsStore.items, ratesStore.items, today),
);
const hasForeignCurrency = computed(() =>
  accountsStore.items.some((account) => (account.currency || "BRL") !== "BRL"),
);
const byAccount = computed(() => selectBalancesByAccount(accountsStore.items, transactionsStore.items));
const spending = computed(() => selectSpendingByAttribution(transactionsStore.items));
const spendingColumns = computed(() => [
  ...people.options.map((option) => ({ key: option.key, label: option.label })),
  { key: "ambos", label: "Ambos" },
]);
const upcoming = computed(() => selectUpcomingBills(bills.value, today));
const openInvoices = computed(() => selectOpenInvoices(invoices.value));
const recent = computed(() => selectRecentTransactions(transactionsStore.items));
const toPay = computed(() => selectToPay30Days(transactionsStore.items, today));

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
}

async function loadAll(): Promise<void> {
  await Promise.all([
    accountsStore.load(),
    transactionsStore.load(),
    cardsStore.load(),
    ratesStore.load(),
    people.load(),
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
            <p class="font-display font-bold">{{ formatBRL(spending[column.key] ?? 0) }}</p>
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
        </div>

        <div v-if="topCategories.length > 0" class="border-t border-border/60 pt-4">
          <div class="mb-3 flex items-center gap-2">
            <IconChip name="tag" color="#B0477E" size="sm" />
            <h2 class="font-display text-lg font-bold">Gastos por categoria</h2>
          </div>
          <CategoryBars :items="topCategories" />
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
                {{ invoice.reference_month }} ·
                <Badge :variant="invoice.status === 'vencida' ? 'destructive' : 'secondary'">{{ invoice.status }}</Badge>
              </p>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>

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
            <span class="font-display font-bold" :class="tx.type === 'receita' ? 'text-leaf' : 'text-primary'">
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
