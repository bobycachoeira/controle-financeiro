<script setup lang="ts">
import { computed, ref } from "vue";
import { RouterLink } from "vue-router";
import { addMonths, fixedCostsForMonth, formatISOMonth, parseISOMonth } from "@cf/shared";
import type { LocalBill, LocalRecurrence, LocalTransaction } from "@/db/schema";
import { formatMonth, formatDate, formatBRL } from "@/lib/format";
import Card from "@/components/ui/Card.vue";
import CardContent from "@/components/ui/CardContent.vue";
import Badge from "@/components/ui/Badge.vue";
import IconChip from "@/components/ui/IconChip.vue";

const props = defineProps<{
  recurrences: LocalRecurrence[];
  bills: LocalBill[];
  transactions: LocalTransaction[];
  month: string;
}>();

const STATUS_LABELS = {
  pago: "pago",
  pendente: "pendente",
  a_confirmar: "a confirmar",
  previsto: "previsto",
} as const;

const STATUS_VARIANTS = {
  pago: "success",
  pendente: "warning",
  a_confirmar: "secondary",
  previsto: "outline",
} as const;

const period = ref<"current" | "next">("current");

const nextMonth = computed(() => {
  const { year, month } = parseISOMonth(props.month);
  const next = addMonths(year, month, 1);
  return formatISOMonth(next.year, next.month);
});
const selectedMonth = computed(() => (period.value === "current" ? props.month : nextMonth.value));
const items = computed(() =>
  fixedCostsForMonth({
    recurrences: props.recurrences,
    bills: props.bills,
    transactions: props.transactions,
    month: selectedMonth.value,
  }),
);
const costs = computed(() => items.value.filter((item) => item.nature === "saida"));
const incomes = computed(() => items.value.filter((item) => item.nature === "entrada"));
const totalCosts = computed(() => costs.value.reduce((sum, item) => sum + item.amountCents, 0));
const totalIncomes = computed(() => incomes.value.reduce((sum, item) => sum + item.amountCents, 0));
</script>

<template>
  <Card data-testid="fixed-costs">
    <CardContent class="space-y-3 p-4">
      <div class="flex items-center gap-2">
        <IconChip name="repeat" color="#3B82B6" size="sm" />
        <h2 class="font-display text-lg font-bold">Custos fixos</h2>
        <RouterLink
          :to="{ name: 'recurrences' }"
          class="ml-auto flex min-h-11 items-center px-1 text-xs font-bold text-primary"
        >
          Gerenciar
        </RouterLink>
      </div>

      <div class="flex gap-1 rounded-full bg-muted p-1 text-xs font-extrabold">
        <button
          type="button"
          class="flex min-h-11 flex-1 items-center justify-center rounded-full px-3 transition"
          :class="period === 'current' ? 'bg-card shadow-soft' : 'text-muted-foreground'"
          @click="period = 'current'"
        >
          Este mês
        </button>
        <button
          type="button"
          class="flex min-h-11 flex-1 items-center justify-center rounded-full px-3 transition"
          :class="period === 'next' ? 'bg-card shadow-soft' : 'text-muted-foreground'"
          @click="period = 'next'"
        >
          Próximo mês
        </button>
      </div>

      <p
        class="text-xs font-extrabold uppercase tracking-wider text-muted-foreground first-letter:uppercase"
      >
        {{ formatMonth(selectedMonth) }}
      </p>
      <div>
        <p class="font-display text-3xl font-black">{{ formatBRL(totalCosts) }}</p>
        <p class="text-xs text-muted-foreground">em custos fixos previstos</p>
        <p v-if="totalIncomes > 0" class="mt-1 text-xs font-bold text-leaf">
          + {{ formatBRL(totalIncomes) }} em entradas fixas
        </p>
      </div>

      <ul v-if="costs.length > 0" class="max-h-72 space-y-2 overflow-y-auto pr-1">
        <li
          v-for="item in costs"
          :key="item.key"
          class="flex items-center justify-between gap-2 border-b border-border/60 pb-2 text-sm last:border-0 last:pb-0"
        >
          <div class="min-w-0">
            <p class="truncate font-semibold">{{ item.name }}</p>
            <p class="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
              {{ formatDate(item.dueDate ?? item.occurrence) }}
              <Badge :variant="STATUS_VARIANTS[item.status]">
                {{ STATUS_LABELS[item.status] }}
              </Badge>
            </p>
          </div>
          <span class="shrink-0 font-display font-bold">{{ formatBRL(item.amountCents) }}</span>
        </li>
      </ul>
      <p v-else class="text-sm text-muted-foreground">
        Nenhum custo fixo previsto para este mês.
        <RouterLink
          :to="{ name: 'recurrences' }"
          class="inline-flex min-h-11 items-center font-bold text-primary"
        >
          Criar recorrência
        </RouterLink>
      </p>

      <p class="text-xs text-muted-foreground">
        <template v-if="period === 'next'">
          Previsão pelas recorrências. O valor pode mudar quando a conta chegar.
        </template>
        <template v-else>
          Contas já geradas usam o valor e o status reais; as demais são previsão.
        </template>
      </p>
    </CardContent>
  </Card>
</template>
