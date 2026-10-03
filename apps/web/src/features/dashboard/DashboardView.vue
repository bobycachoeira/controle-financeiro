<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { todayISO } from "@cf/shared";
import { db, type LocalBill, type LocalInvoice } from "@/db/schema";
import { useSessionStore } from "@/stores/session";
import { useSyncStore } from "@/stores/sync";
import { useAccountsStore } from "@/stores/accounts";
import { useTransactionsStore } from "@/stores/transactions";
import { useCardsStore } from "@/stores/cards";
import { useRatesStore } from "@/stores/rates";
import { formatBRL, formatDate } from "@/lib/format";
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
import Card from "@/components/ui/Card.vue";
import CardContent from "@/components/ui/CardContent.vue";
import CardHeader from "@/components/ui/CardHeader.vue";
import CardTitle from "@/components/ui/CardTitle.vue";
import Badge from "@/components/ui/Badge.vue";

const session = useSessionStore();
const sync = useSyncStore();
const accountsStore = useAccountsStore();
const transactionsStore = useTransactionsStore();
const cardsStore = useCardsStore();
const ratesStore = useRatesStore();

const bills = ref<LocalBill[]>([]);
const invoices = ref<LocalInvoice[]>([]);
const today = todayISO();

const balance = computed(() => selectTotalBalance(accountsStore.items, transactionsStore.items));
const consolidated = computed(() =>
  selectConsolidatedBalance(accountsStore.items, transactionsStore.items, ratesStore.items, today),
);
const hasForeignCurrency = computed(() =>
  accountsStore.items.some((account) => (account.currency || "BRL") !== "BRL"),
);
const byAccount = computed(() => selectBalancesByAccount(accountsStore.items, transactionsStore.items));
const spending = computed(() => selectSpendingByAttribution(transactionsStore.items));
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
}

async function loadAll(): Promise<void> {
  await Promise.all([
    accountsStore.load(),
    transactionsStore.load(),
    cardsStore.load(),
    ratesStore.load(),
    loadExtras(),
  ]);
}

onMounted(loadAll);
watch(() => sync.dataVersion, loadAll);
</script>

<template>
  <div class="space-y-4">
    <ConflictPanel />

    <Card class="bg-primary text-primary-foreground">
      <CardContent class="p-5">
        <p class="text-sm opacity-80">Saldo total</p>
        <p class="mt-1 text-3xl font-bold">{{ formatBRL(hasForeignCurrency ? consolidated.totalCents : balance) }}</p>
        <p v-if="hasForeignCurrency" class="mt-1 text-xs opacity-80">
          Consolidado em BRL
          <template v-if="consolidated.missing.length">
            · sem cotação: {{ consolidated.missing.join(", ") }}
          </template>
        </p>
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle>Saldos por conta</CardTitle></CardHeader>
      <CardContent>
        <p v-if="byAccount.length === 0" class="text-sm text-muted-foreground">
          Nenhuma conta cadastrada ainda.
        </p>
        <ul v-else class="divide-y">
          <li
            v-for="row in byAccount"
            :key="row.account.id"
            class="flex items-center justify-between py-2 text-sm"
          >
            <span>{{ row.account.name }}</span>
            <span class="font-medium">{{ formatBRL(row.balance) }}</span>
          </li>
        </ul>
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle>Gastos do mês</CardTitle></CardHeader>
      <CardContent class="grid grid-cols-3 gap-3 text-center text-sm">
        <div>
          <p class="text-xs text-muted-foreground">Eu</p>
          <p class="font-semibold">{{ formatBRL(spending.meu) }}</p>
        </div>
        <div>
          <p class="text-xs text-muted-foreground">Ela</p>
          <p class="font-semibold">{{ formatBRL(spending.dela) }}</p>
        </div>
        <div>
          <p class="text-xs text-muted-foreground">Ambos</p>
          <p class="font-semibold">{{ formatBRL(spending.ambos) }}</p>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle>Vencimentos próximos (7 dias)</CardTitle></CardHeader>
      <CardContent>
        <p v-if="upcoming.length === 0" class="text-sm text-muted-foreground">
          Nenhuma conta a vencer nos próximos 7 dias.
        </p>
        <ul v-else class="divide-y">
          <li
            v-for="bill in upcoming"
            :key="bill.id"
            class="flex items-center justify-between py-2 text-sm"
          >
            <span>{{ bill.title }}</span>
            <span>{{ formatDate(bill.due_date) }} · {{ formatBRL(bill.amount_cents) }}</span>
          </li>
        </ul>
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle>Faturas abertas</CardTitle></CardHeader>
      <CardContent>
        <p v-if="openInvoices.length === 0" class="text-sm text-muted-foreground">
          Nenhuma fatura em aberto.
        </p>
        <ul v-else class="divide-y">
          <li
            v-for="invoice in openInvoices"
            :key="invoice.id"
            class="flex items-center justify-between py-2 text-sm"
          >
            <span>{{ invoice.reference_month }}</span>
            <span class="flex items-center gap-2">
              {{ formatBRL(invoice.total_cents) }}
              <Badge :variant="invoice.status === 'vencida' ? 'destructive' : 'secondary'">
                {{ invoice.status }}
              </Badge>
            </span>
          </li>
        </ul>
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle>Lançamentos recentes</CardTitle></CardHeader>
      <CardContent>
        <p v-if="recent.length === 0" class="text-sm text-muted-foreground">Nada por aqui ainda.</p>
        <ul v-else class="divide-y">
          <li
            v-for="tx in recent"
            :key="tx.id"
            class="flex items-center justify-between py-2 text-sm"
          >
            <span class="truncate">{{ tx.description || "Lançamento" }}</span>
            <span :class="tx.type === 'receita' ? 'text-emerald-600' : 'text-red-600'">
              {{ tx.type === "receita" ? "+" : "-" }}{{ formatBRL(tx.amount_cents) }}
            </span>
          </li>
        </ul>
      </CardContent>
    </Card>

    <div class="grid grid-cols-2 gap-4">
      <Card>
        <CardContent class="p-4">
          <p class="text-xs text-muted-foreground">A pagar (30 dias)</p>
          <p class="mt-1 text-lg font-semibold">{{ formatBRL(toPay) }}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent class="p-4">
          <p class="text-xs text-muted-foreground">Sincronização</p>
          <p class="mt-1 text-lg font-semibold">
            {{ sync.online ? (sync.pending > 0 ? `${sync.pending} pendente(s)` : "Em dia") : "Offline" }}
          </p>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
