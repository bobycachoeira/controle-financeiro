<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { ChevronLeft, ChevronRight } from "lucide-vue-next";
import { RouterLink } from "vue-router";
import { todayISO } from "@cf/shared";
import { db, type LocalBill, type LocalCreditCard, type LocalInvoice, type LocalTransaction } from "@/db/schema";
import { useSessionStore } from "@/stores/session";
import { useSyncStore } from "@/stores/sync";
import { formatBRL, formatDateShort, formatMonth } from "@/lib/format";
import Card from "@/components/ui/Card.vue";
import CardContent from "@/components/ui/CardContent.vue";
import Badge from "@/components/ui/Badge.vue";
import { buildMonthGrid, nextMonth, previousMonth } from "./calendar";

const session = useSessionStore();
const sync = useSyncStore();

const today = todayISO();
const month = ref(today.slice(0, 7));
const selected = ref(today);
const bills = ref<LocalBill[]>([]);
const invoices = ref<LocalInvoice[]>([]);
const cards = ref<LocalCreditCard[]>([]);
const transactions = ref<LocalTransaction[]>([]);
const visible = ref({ bills: true, invoices: true, transactions: true });

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];
const COLOR_IN = "#3F9A6A";
const COLOR_OUT = "#E4572E";
const COLOR_INVOICE = "#8A6FD1";

interface DayItem {
  id: string;
  kind: "bill" | "invoice" | "transaction";
  title: string;
  amountCents: number;
  nature: "entrada" | "saida";
  status: string;
  color: string;
}

const weeks = computed(() => buildMonthGrid(month.value));

const cardById = computed(() => new Map(cards.value.map((card) => [card.id, card])));

const itemsByDate = computed(() => {
  const map = new Map<string, DayItem[]>();
  const push = (date: string, item: DayItem): void => {
    const list = map.get(date) ?? [];
    list.push(item);
    map.set(date, list);
  };
  if (visible.value.bills) {
    for (const bill of bills.value) {
      if (bill.deleted_at) continue;
      if (bill.status !== "pendente" && bill.status !== "a_confirmar") continue;
      push(bill.due_date.slice(0, 10), {
        id: bill.id,
        kind: "bill",
        title: bill.title,
        amountCents: bill.amount_cents,
        nature: bill.nature,
        status: bill.status,
        color: bill.nature === "entrada" ? COLOR_IN : COLOR_OUT,
      });
    }
  }
  if (visible.value.invoices) {
    for (const invoice of invoices.value) {
      if (invoice.deleted_at || invoice.status === "paga") continue;
      const bank = cardById.value.get(invoice.credit_card)?.bank?.trim() || "Cartão";
      push(invoice.due_date.slice(0, 10), {
        id: invoice.id,
        kind: "invoice",
        title: `Fatura ${bank} ${formatMonth(invoice.reference_month)}`,
        amountCents: Math.max(0, invoice.total_cents - (invoice.paid_cents ?? 0)),
        nature: "saida",
        status: invoice.status,
        color: COLOR_INVOICE,
      });
    }
  }
  if (visible.value.transactions) {
    for (const tx of transactions.value) {
      if (tx.deleted_at || tx.type === "transferencia") continue;
      push(tx.date.slice(0, 10), {
        id: tx.id,
        kind: "transaction",
        title: tx.merchant || tx.description || "Lançamento",
        amountCents: tx.amount_cents,
        nature: tx.type === "receita" ? "entrada" : "saida",
        status: tx.status,
        color: tx.type === "receita" ? COLOR_IN : COLOR_OUT,
      });
    }
  }
  return map;
});

const selectedItems = computed(() => itemsByDate.value.get(selected.value) ?? []);

function shiftMonth(delta: number): void {
  month.value = delta < 0 ? previousMonth(month.value) : nextMonth(month.value);
  selected.value = today.startsWith(month.value) ? today : `${month.value}-01`;
}

function dotsFor(date: string): DayItem[] {
  return (itemsByDate.value.get(date) ?? []).slice(0, 3);
}

const filters = computed(() => [
  { key: "bills" as const, label: "Contas" },
  { key: "invoices" as const, label: "Faturas" },
  { key: "transactions" as const, label: "Lançamentos" },
]);

function toggleFilter(key: "bills" | "invoices" | "transactions"): void {
  visible.value[key] = !visible.value[key];
}

function kindLabel(item: DayItem): string {
  if (item.kind === "invoice") return "Fatura do cartão";
  if (item.kind === "bill") return "Conta";
  return item.nature === "entrada" ? "Receita" : "Despesa";
}

async function loadAll(): Promise<void> {
  if (!session.currentHouseholdId) return;
  const household = session.currentHouseholdId;
  bills.value = (await db.bills.where("household").equals(household).toArray()).filter(
    (bill) => !bill.deleted_at,
  );
  invoices.value = (await db.invoices.where("household").equals(household).toArray()).filter(
    (invoice) => !invoice.deleted_at,
  );
  cards.value = (await db.credit_cards.where("household").equals(household).toArray()).filter(
    (card) => !card.deleted_at,
  );
  transactions.value = (
    await db.transactions.where("household").equals(household).toArray()
  ).filter((tx) => !tx.deleted_at && tx.type !== "transferencia");
}

onMounted(loadAll);
watch(() => sync.dataVersion, loadAll);
</script>

<template>
  <div class="space-y-5">
    <div>
      <p class="text-xs font-extrabold uppercase tracking-wider text-primary">Agenda</p>
      <h1 class="font-display text-3xl font-black tracking-tight">Calendário</h1>
    </div>

    <Card>
      <CardContent class="space-y-3 p-4">
        <div class="flex items-center justify-between">
          <button
            class="grid h-11 w-11 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-primary"
            aria-label="Mês anterior"
            @click="shiftMonth(-1)"
          >
            <ChevronLeft class="h-4 w-4" />
          </button>
          <p class="font-display text-lg font-bold first-letter:uppercase">{{ formatMonth(month) }}</p>
          <button
            class="grid h-11 w-11 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-primary"
            aria-label="Próximo mês"
            @click="shiftMonth(1)"
          >
            <ChevronRight class="h-4 w-4" />
          </button>
        </div>

        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="option in filters"
            :key="option.key"
            type="button"
            data-compact
            class="rounded-full border px-3 py-1 text-xs font-bold transition"
            :class="
              visible[option.key]
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground'
            "
            @click="toggleFilter(option.key)"
          >
            {{ option.label }}
          </button>
        </div>

        <div class="grid grid-cols-7 gap-1 text-center text-[0.62rem] font-extrabold uppercase text-muted-foreground">
          <span v-for="(label, index) in WEEKDAYS" :key="index">{{ label }}</span>
        </div>

        <div v-for="(week, weekIndex) in weeks" :key="weekIndex" class="grid grid-cols-7 gap-1">
          <button
            v-for="day in week"
            :key="day.date"
            type="button"
            class="flex h-12 flex-col items-center justify-center rounded-xl border text-sm transition"
            :class="[
              day.inMonth ? 'text-foreground' : 'text-muted-foreground/50',
              selected === day.date
                ? 'border-primary bg-primary/10 font-black'
                : 'border-transparent hover:bg-muted/70',
              day.date === today && selected !== day.date ? 'border-border' : '',
            ]"
            @click="selected = day.date"
          >
            <span>{{ Number(day.date.slice(8)) }}</span>
            <span class="mt-0.5 flex h-1.5 items-center gap-0.5">
              <span
                v-for="item in dotsFor(day.date)"
                :key="item.id"
                class="h-1.5 w-1.5 rounded-full"
                :style="{ backgroundColor: item.color }"
              />
            </span>
          </button>
        </div>

        <div class="flex flex-wrap gap-3 border-t border-border/60 pt-2 text-[0.62rem] font-bold text-muted-foreground">
          <span class="flex items-center gap-1">
            <span class="h-2 w-2 rounded-full" :style="{ backgroundColor: COLOR_IN }" /> entrada
          </span>
          <span class="flex items-center gap-1">
            <span class="h-2 w-2 rounded-full" :style="{ backgroundColor: COLOR_OUT }" /> saída
          </span>
          <span class="flex items-center gap-1">
            <span class="h-2 w-2 rounded-full" :style="{ backgroundColor: COLOR_INVOICE }" /> fatura
          </span>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardContent class="p-4">
        <p class="pb-2 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
          {{ formatDateShort(selected) }}
        </p>
        <p v-if="selectedItems.length === 0" class="text-sm text-muted-foreground">
          Nada vencendo neste dia.
        </p>
        <ul v-else class="divide-y">
          <li
            v-for="item in selectedItems"
            :key="item.id"
            class="flex items-center justify-between gap-2 py-2.5 text-sm"
          >
            <div class="min-w-0">
              <p class="truncate font-bold">{{ item.title }}</p>
              <p class="text-xs text-muted-foreground">
                {{ kindLabel(item) }} ·
                <Badge v-if="item.kind !== 'transaction'" :variant="item.status === 'vencida' ? 'destructive' : 'secondary'">
                  {{ item.status }}
                </Badge>
                <Badge v-else-if="item.status === 'a_pagar'" variant="warning">a pagar</Badge>
              </p>
            </div>
            <span
              class="font-display font-bold"
              :class="item.nature === 'entrada' ? 'text-leaf' : 'text-primary'"
            >
              {{ item.nature === "entrada" ? "+" : "−" }}{{ formatBRL(item.amountCents) }}
            </span>
          </li>
        </ul>
        <div class="flex gap-3 pt-2 text-xs font-bold">
          <RouterLink :to="{ name: 'bills' }" class="text-primary">Contas</RouterLink>
          <RouterLink :to="{ name: 'cards' }" class="text-primary">Faturas</RouterLink>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
