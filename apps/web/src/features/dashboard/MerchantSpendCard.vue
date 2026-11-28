<script setup lang="ts">
import { computed, ref } from "vue";
import { lastMonths, spendingByCategory, spendingByMerchant } from "@cf/shared";
import type { LocalAccount, LocalCategory, LocalCreditCard, LocalTransaction } from "@/db/schema";
import { formatBRL } from "@/lib/format";
import Card from "@/components/ui/Card.vue";
import CardContent from "@/components/ui/CardContent.vue";
import IconChip from "@/components/ui/IconChip.vue";
import Label from "@/components/ui/Label.vue";
import Select from "@/components/ui/Select.vue";
import DonutChart from "@/components/charts/DonutChart.vue";

const props = defineProps<{
  transactions: LocalTransaction[];
  accounts: LocalAccount[];
  cards?: LocalCreditCard[];
  categories: LocalCategory[];
  month: string;
}>();

const PERIODS = [
  { value: "1", label: "Mês" },
  { value: "3", label: "3 meses" },
  { value: "6", label: "6 meses" },
  { value: "12", label: "12 meses" },
];

const COLORS = ["#E4572E", "#3F9A6A", "#3B82B6", "#B0477E", "#F2A93B", "#7C5CBF"];
const OTHER_COLOR = "#94a3b8";

const mode = ref<"merchant" | "category">("merchant");
const period = ref("1");
const source = ref("");
const category = ref("");

const accountOptions = computed(() =>
  props.accounts.filter((account) => account.type !== "cartao_credito" && !account.deleted_at),
);
const cardOptions = computed(() => props.cards ?? []);

type SpendRow = {
  name: string;
  totalCents: number;
  color?: string;
};

const scopedTransactions = computed(() => {
  if (source.value.startsWith("account:")) {
    const accountId = source.value.slice("account:".length);
    return props.transactions.filter((tx) => tx.account === accountId);
  }
  if (source.value.startsWith("card:")) {
    const cardId = source.value.slice("card:".length);
    return props.transactions.filter((tx) => tx.credit_card === cardId);
  }
  return props.transactions;
});

const merchantRows = computed<SpendRow[]>(() =>
  spendingByMerchant(scopedTransactions.value, {
    months: lastMonths(props.month, Number(period.value)),
    categoryId: mode.value === "merchant" ? category.value || undefined : undefined,
  }).map((row) => ({ name: row.name, totalCents: row.totalCents })),
);

const categoryRows = computed<SpendRow[]>(() => {
  const totals = new Map<string, SpendRow>();
  for (const month of lastMonths(props.month, Number(period.value))) {
    for (const row of spendingByCategory(scopedTransactions.value, props.categories, month, 999)) {
      const key = row.categoryId ?? "__none__";
      const existing = totals.get(key);
      if (existing) existing.totalCents += row.totalCents;
      else totals.set(key, { name: row.name, totalCents: row.totalCents, color: row.color });
    }
  }
  return [...totals.values()].sort((a, b) => b.totalCents - a.totalCents);
});

const rows = computed<SpendRow[]>(() =>
  mode.value === "merchant" ? merchantRows.value : categoryRows.value,
);

const totalCents = computed(() => rows.value.reduce((sum, row) => sum + row.totalCents, 0));

const items = computed(() => {
  const top = rows.value.slice(0, 6).map((row, index) => ({
    name: row.name,
    value: row.totalCents,
    color: row.color ?? COLORS[index % COLORS.length] ?? OTHER_COLOR,
  }));
  const other = rows.value.slice(6).reduce((sum, row) => sum + row.totalCents, 0);
  if (other > 0) {
    top.push({
      name: mode.value === "category" ? "Outras categorias" : "Outros",
      value: other,
      color: OTHER_COLOR,
    });
  }
  return top;
});

function percentOf(value: number): number {
  return totalCents.value > 0 ? Math.round((value / totalCents.value) * 100) : 0;
}
</script>

<template>
  <Card data-testid="merchant-spend">
    <CardContent class="space-y-4 p-4">
      <div class="flex items-center gap-2">
        <IconChip name="shopping-cart" color="#B0477E" size="sm" />
        <h2 class="font-display text-base font-bold">
          Gastos por {{ mode === "merchant" ? "estabelecimento" : "categoria" }}
        </h2>
      </div>

      <div class="flex gap-1 rounded-full bg-muted p-1 text-xs font-extrabold">
        <button
          type="button"
          class="flex min-h-11 flex-1 items-center justify-center rounded-full px-3 transition"
          :class="mode === 'merchant' ? 'bg-card shadow-soft' : 'text-muted-foreground'"
          @click="mode = 'merchant'"
        >
          Estabelecimento
        </button>
        <button
          type="button"
          data-testid="spend-tab-category"
          class="flex min-h-11 flex-1 items-center justify-center rounded-full px-3 transition"
          :class="mode === 'category' ? 'bg-card shadow-soft' : 'text-muted-foreground'"
          @click="mode = 'category'"
        >
          Categoria
        </button>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <div class="space-y-1">
          <Label for="merchant-period">Período</Label>
          <Select id="merchant-period" v-model="period">
            <option v-for="option in PERIODS" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </Select>
        </div>
        <div class="space-y-1">
          <Label for="merchant-source">Conta ou cartão</Label>
          <Select id="merchant-source" v-model="source">
            <option value="">Todos</option>
            <optgroup v-if="accountOptions.length > 0" label="Contas">
              <option
                v-for="account in accountOptions"
                :key="account.id"
                :value="`account:${account.id}`"
              >
                {{ account.name }}
              </option>
            </optgroup>
            <optgroup v-if="cardOptions.length > 0" label="Cartões">
              <option v-for="card in cardOptions" :key="card.id" :value="`card:${card.id}`">
                {{ card.bank?.trim() || "Cartão" }}
              </option>
            </optgroup>
          </Select>
        </div>
        <div v-if="mode === 'merchant'" class="col-span-2 space-y-1">
          <Label for="merchant-category">Categoria</Label>
          <Select id="merchant-category" v-model="category">
            <option value="">Todas</option>
            <option v-for="item in categories" :key="item.id" :value="item.id">
              {{ item.name }}
            </option>
          </Select>
        </div>
      </div>

      <p v-if="rows.length === 0" class="py-6 text-center text-sm text-muted-foreground">
        Sem despesas nesse filtro.
      </p>
      <template v-else>
        <DonutChart :items="items" :total-cents="totalCents" label="Total gasto" />
        <ul class="space-y-2">
          <li
            v-for="item in items"
            :key="item.name"
            class="flex items-center justify-between gap-2 text-sm"
          >
            <span class="flex min-w-0 items-center gap-2">
              <span
                class="h-2.5 w-2.5 shrink-0 rounded-full"
                :style="{ backgroundColor: item.color }"
              />
              <span class="truncate font-semibold">{{ item.name }}</span>
            </span>
            <span class="flex shrink-0 items-center gap-2">
              <span class="font-display font-bold">{{ formatBRL(item.value) }}</span>
              <span class="w-9 text-right text-xs text-muted-foreground"
                >{{ percentOf(item.value) }}%</span
              >
            </span>
          </li>
        </ul>
      </template>
    </CardContent>
  </Card>
</template>
