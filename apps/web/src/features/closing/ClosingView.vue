<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { ChevronLeft, ChevronRight, Share2 } from "lucide-vue-next";
import {
  computeSettlement,
  monthLabel,
  monthlyCashflow,
  spendingByCategory,
  todayISO,
} from "@cf/shared";
import { db, type LocalCategory } from "@/db/schema";
import { useAccountsStore } from "@/stores/accounts";
import { usePeopleStore } from "@/stores/people";
import { useSessionStore } from "@/stores/session";
import { useSyncStore } from "@/stores/sync";
import { useTransactionsStore } from "@/stores/transactions";
import { useTransfersStore } from "@/stores/transfers";
import { useToast } from "@/composables/useToast";
import { formatBRL, formatMonth } from "@/lib/format";
import { renderShareCard, shareOrDownload } from "@/lib/share-card";
import { nextMonth, previousMonth } from "@/features/calendar/calendar";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import CardContent from "@/components/ui/CardContent.vue";
import IconChip from "@/components/ui/IconChip.vue";

const session = useSessionStore();
const accountsStore = useAccountsStore();
const people = usePeopleStore();
const transactionsStore = useTransactionsStore();
const transfersStore = useTransfersStore();
const sync = useSyncStore();
const toast = useToast();

const month = ref(todayISO().slice(0, 7));
const categories = ref<LocalCategory[]>([]);
const sharing = ref(false);

const buckets = computed(() => monthlyCashflow(transactionsStore.items, month.value, 2));
const current = computed(() => buckets.value[1]);
const previous = computed(() => buckets.value[0]);
const income = computed(() => current.value?.receitasCents ?? 0);
const expense = computed(() => current.value?.despesasCents ?? 0);
const net = computed(() => income.value - expense.value);

const comparison = computed(() => {
  const previousExpense = previous.value?.despesasCents ?? 0;
  if (previousExpense === 0) return "Sem despesas no mês anterior para comparar.";
  const delta = Math.round(((expense.value - previousExpense) / previousExpense) * 100);
  if (delta === 0) return "Despesas iguais às do mês anterior.";
  return `Despesas ${delta > 0 ? "acima" : "abaixo"} ${Math.abs(delta)}% de ${monthLabel(previous.value?.month ?? "")}`;
});

const settlement = computed(() => {
  const ownerByAccount = new Map(
    accountsStore.items.map((account) => [account.id, account.owner ?? "indefinido"]),
  );
  return computeSettlement({
    people: people.options.map((option) => ({ key: option.key, label: option.label })),
    legacyMap: { meu: 0, dela: 1 },
    month: month.value,
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

const topCategories = computed(() =>
  spendingByCategory(transactionsStore.items, categories.value, month.value, 4),
);

function shiftMonth(delta: number): void {
  month.value = delta < 0 ? previousMonth(month.value) : nextMonth(month.value);
}

async function shareCard(): Promise<void> {
  sharing.value = true;
  try {
    const blob = await renderShareCard({
      monthLabel: formatMonth(month.value),
      incomeCents: income.value,
      expenseCents: expense.value,
      netCents: net.value,
      people: settlement.value.people.map((person) => ({
        label: person.label,
        paidCents: person.paidCents,
      })),
      topCategories: topCategories.value.map((category) => ({
        name: category.name,
        totalCents: category.totalCents,
      })),
      comparison: comparison.value,
    });
    const result = await shareOrDownload(
      blob,
      `fechamento-${month.value}.png`,
      `Fechamento ${formatMonth(month.value)}`,
    );
    if (result === "downloaded") toast.success("Card salvo como imagem.");
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
    toast.error(error instanceof Error ? error.message : "Falha ao gerar o card.");
  } finally {
    sharing.value = false;
  }
}

async function loadAll(): Promise<void> {
  await Promise.all([
    accountsStore.load(),
    transactionsStore.load(),
    transfersStore.load(),
    people.load(),
  ]);
  if (session.currentHouseholdId) {
    categories.value = (
      await db.categories.where("household").equals(session.currentHouseholdId).toArray()
    ).filter((category) => !category.deleted_at);
  }
}

onMounted(loadAll);
watch(() => sync.dataVersion, loadAll);
</script>

<template>
  <div class="space-y-5">
    <div class="flex items-end justify-between gap-3">
      <div>
        <p class="text-xs font-extrabold uppercase tracking-wider text-primary">Casal</p>
        <h1 class="font-display text-3xl font-black tracking-tight">Fechamento do mês</h1>
      </div>
      <div class="flex items-center gap-1">
        <button
          class="grid h-11 w-11 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-primary"
          aria-label="Mês anterior"
          @click="shiftMonth(-1)"
        >
          <ChevronLeft class="h-4 w-4" />
        </button>
        <input
          id="closing-month"
          v-model="month"
          type="month"
          class="h-9 rounded-xl border-2 border-input bg-card px-2 text-xs font-bold"
          aria-label="Mês do fechamento"
        />
        <button
          class="grid h-11 w-11 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-primary"
          aria-label="Próximo mês"
          @click="shiftMonth(1)"
        >
          <ChevronRight class="h-4 w-4" />
        </button>
      </div>
    </div>

    <Card>
      <CardContent class="space-y-4 p-4">
        <div class="grid grid-cols-3 gap-2 text-center">
          <div class="rounded-2xl bg-muted/60 p-3">
            <p class="text-[0.6rem] font-extrabold uppercase tracking-wider text-muted-foreground">Receitas</p>
            <p class="font-display text-sm font-bold text-leaf">{{ formatBRL(income) }}</p>
          </div>
          <div class="rounded-2xl bg-muted/60 p-3">
            <p class="text-[0.6rem] font-extrabold uppercase tracking-wider text-muted-foreground">Despesas</p>
            <p class="font-display text-sm font-bold text-foreground">{{ formatBRL(expense) }}</p>
          </div>
          <div class="rounded-2xl bg-muted/60 p-3">
            <p class="text-[0.6rem] font-extrabold uppercase tracking-wider text-muted-foreground">Sobrou</p>
            <p class="font-display text-sm font-bold" :class="net >= 0 ? 'text-leaf' : 'text-destructive'">
              {{ formatBRL(net) }}
            </p>
          </div>
        </div>
        <p class="text-center text-xs font-semibold text-muted-foreground">{{ comparison }}</p>
      </CardContent>
    </Card>

    <Card>
      <CardContent class="p-4">
        <div class="mb-2 flex items-center gap-2">
          <IconChip name="hand-coins" color="#3F9A6A" size="sm" />
          <h2 class="font-display text-base font-bold">Quem contribuiu</h2>
        </div>
        <p v-if="settlement.people.length === 0" class="text-sm text-muted-foreground">
          Configure as pessoas em Família.
        </p>
        <ul v-else class="space-y-1 text-sm">
          <li
            v-for="person in settlement.people"
            :key="person.key"
            class="flex items-center justify-between gap-2"
          >
            <span class="truncate font-semibold">{{ person.label }}</span>
            <span class="text-muted-foreground">
              pagou {{ formatBRL(person.paidCents) }} · parte {{ formatBRL(person.shareCents) }}
            </span>
          </li>
        </ul>
      </CardContent>
    </Card>

    <Card>
      <CardContent class="p-4">
        <div class="mb-2 flex items-center gap-2">
          <IconChip name="receipt" color="#E4572E" size="sm" />
          <h2 class="font-display text-base font-bold">Maiores gastos</h2>
        </div>
        <p v-if="topCategories.length === 0" class="text-sm text-muted-foreground">
          Sem despesas no mês.
        </p>
        <ul v-else class="space-y-2">
          <li
            v-for="category in topCategories"
            :key="category.name"
            class="flex items-center justify-between gap-2 text-sm"
          >
            <span class="truncate font-semibold">{{ category.name }}</span>
            <span class="font-display font-bold">{{ formatBRL(category.totalCents) }}</span>
          </li>
        </ul>
      </CardContent>
    </Card>

    <Button class="w-full" :loading="sharing" @click="shareCard">
      <Share2 class="h-4 w-4" /> Compartilhar card do mês
    </Button>
  </div>
</template>
