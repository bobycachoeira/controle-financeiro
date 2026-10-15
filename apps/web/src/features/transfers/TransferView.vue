<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { lastMonths, monthLabel, monthOf, todayISO } from "@cf/shared";
import { useTransfersStore } from "@/stores/transfers";
import { useAccountsStore } from "@/stores/accounts";
import { useSyncStore } from "@/stores/sync";
import { useToast } from "@/composables/useToast";
import { formatBRL } from "@/lib/format-input";
import { formatDate } from "@/lib/format";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import CardContent from "@/components/ui/CardContent.vue";
import CardHeader from "@/components/ui/CardHeader.vue";
import CardTitle from "@/components/ui/CardTitle.vue";
import CurrencyInput from "@/components/ui/CurrencyInput.vue";
import Input from "@/components/ui/Input.vue";
import Label from "@/components/ui/Label.vue";
import Select from "@/components/ui/Select.vue";
import BarsChart from "@/components/charts/BarsChart.vue";
import CategoryBars from "@/components/charts/CategoryBars.vue";

const transfersStore = useTransfersStore();
const accountsStore = useAccountsStore();
const sync = useSyncStore();
const toast = useToast();

const source = ref("");
const destination = ref("");
const amountCents = ref<number | null>(null);
const date = ref(todayISO());
const description = ref("");
const saving = ref(false);

const filter = ref<"todas" | "contas" | "faturas">("todas");
const FILTERS = [
  { value: "todas", label: "Todas" },
  { value: "contas", label: "Entre contas" },
  { value: "faturas", label: "Faturas" },
] as const;

const INVOICE_PREFIX = "Pagamento da fatura";
const COLOR_CONTA = "#3B82F6";
const COLOR_FATURA = "#8A6FD1";
const ROUTE_COLORS = ["#3B82F6", "#8A6FD1", "#3F9A6A", "#F2A93B", "#E4572E", "#0EA5E9"];

const accountById = computed(() => new Map(accountsStore.items.map((item) => [item.id, item.name])));

function accountName(id: string): string {
  return accountById.value.get(id) ?? "Conta";
}

function isInvoicePayment(transfer: { description: string | null }): boolean {
  return (transfer.description ?? "").startsWith(INVOICE_PREFIX);
}

const currentMonth = todayISO().slice(0, 7);

const months = computed(() => lastMonths(currentMonth, 6));
const buckets = computed(() => {
  const map = new Map(months.value.map((month) => [month, { conta: 0, fatura: 0 }]));
  for (const transfer of transfersStore.items) {
    if (transfer.deleted_at) continue;
    const bucket = map.get(monthOf(transfer.date));
    if (!bucket) continue;
    if (isInvoicePayment(transfer)) bucket.fatura += transfer.amount_cents;
    else bucket.conta += transfer.amount_cents;
  }
  return months.value.map((month) => ({ month, ...map.get(month)! }));
});

const chartCategories = computed(() => buckets.value.map((bucket) => monthLabel(bucket.month)));
const chartSeries = computed(() => [
  { label: "Entre contas", color: COLOR_CONTA, values: buckets.value.map((b) => b.conta) },
  { label: "Faturas de cartão", color: COLOR_FATURA, values: buckets.value.map((b) => b.fatura) },
]);
const hasData = computed(() => buckets.value.some((bucket) => bucket.conta > 0 || bucket.fatura > 0));

const summary = computed(() => {
  const current = buckets.value[buckets.value.length - 1];
  const list = transfersStore.items.filter((t) => !t.deleted_at && monthOf(t.date) === currentMonth);
  return {
    conta: current?.conta ?? 0,
    fatura: current?.fatura ?? 0,
    total: (current?.conta ?? 0) + (current?.fatura ?? 0),
    count: list.length,
  };
});

const routes = computed(() => {
  const totals = new Map<string, number>();
  for (const transfer of transfersStore.items) {
    if (transfer.deleted_at || monthOf(transfer.date) !== currentMonth) continue;
    if (filter.value === "contas" && isInvoicePayment(transfer)) continue;
    if (filter.value === "faturas" && !isInvoicePayment(transfer)) continue;
    const key = `${accountName(transfer.source_account)} → ${accountName(transfer.destination_account)}`;
    totals.set(key, (totals.get(key) ?? 0) + transfer.amount_cents);
  }
  return [...totals.entries()]
    .map(([name, totalCents], index) => ({
      name,
      totalCents,
      color: ROUTE_COLORS[index % ROUTE_COLORS.length]!,
    }))
    .sort((a, b) => b.totalCents - a.totalCents)
    .slice(0, 6);
});

const history = computed(() => {
  if (filter.value === "todas") return transfersStore.items;
  const wantInvoice = filter.value === "faturas";
  return transfersStore.items.filter((transfer) => isInvoicePayment(transfer) === wantInvoice);
});

async function submit(): Promise<void> {
  const cents = amountCents.value;
  if (cents === null || cents <= 0) {
    toast.error("Valor inválido.");
    return;
  }
  saving.value = true;
  try {
    await transfersStore.create({
      source_account: source.value,
      destination_account: destination.value,
      amount_cents: cents,
      date: date.value,
      description: description.value || "Transferência",
    });
    toast.success("Transferência registrada.");
    amountCents.value = null;
    description.value = "";
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Falha na transferência.");
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  await Promise.all([accountsStore.load(), transfersStore.load()]);
});

watch(
  () => sync.dataVersion,
  () => {
    void Promise.all([accountsStore.load(), transfersStore.load()]);
  },
);
</script>

<template>
  <div class="space-y-4">
    <div>
      <p class="text-xs font-extrabold uppercase tracking-wider text-primary">Movimentações</p>
      <h1 class="font-display text-3xl font-black tracking-tight">Transferências</h1>
    </div>

    <Card v-if="hasData">
      <CardHeader>
        <CardTitle>Movimentações por mês</CardTitle>
      </CardHeader>
      <CardContent>
        <div class="mb-4 grid grid-cols-3 gap-2 text-center">
          <div class="rounded-2xl bg-muted/60 p-2">
            <p class="text-[0.6rem] font-extrabold uppercase tracking-wider text-muted-foreground">Entre contas</p>
            <p class="font-display text-sm font-bold">{{ formatBRL(summary.conta) }}</p>
          </div>
          <div class="rounded-2xl bg-muted/60 p-2">
            <p class="text-[0.6rem] font-extrabold uppercase tracking-wider text-muted-foreground">Faturas</p>
            <p class="font-display text-sm font-bold">{{ formatBRL(summary.fatura) }}</p>
          </div>
          <div class="rounded-2xl bg-muted/60 p-2">
            <p class="text-[0.6rem] font-extrabold uppercase tracking-wider text-muted-foreground">Total (mês)</p>
            <p class="font-display text-sm font-bold">{{ formatBRL(summary.total) }}</p>
          </div>
        </div>
        <BarsChart :categories="chartCategories" :series="chartSeries" />
        <p class="mt-3 text-center text-xs font-semibold text-muted-foreground">
          {{ summary.count }} movimentação(ões) neste mês
        </p>
      </CardContent>
    </Card>

    <Card v-if="routes.length > 0">
      <CardHeader>
        <CardTitle>Principais rotas do mês</CardTitle>
      </CardHeader>
      <CardContent>
        <CategoryBars :items="routes" />
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle>Nova transferência</CardTitle></CardHeader>
      <CardContent>
        <form class="space-y-4" @submit.prevent="submit">
          <div class="space-y-2">
            <Label for="source">Conta de origem</Label>
            <Select id="source" v-model="source" required>
              <option value="">Selecione</option>
              <option v-for="item in accountsStore.items" :key="item.id" :value="item.id">
                {{ item.name }}
              </option>
            </Select>
          </div>
          <div class="space-y-2">
            <Label for="destination">Conta de destino</Label>
            <Select id="destination" v-model="destination" required>
              <option value="">Selecione</option>
              <option v-for="item in accountsStore.items" :key="item.id" :value="item.id">
                {{ item.name }}
              </option>
            </Select>
          </div>
          <div class="space-y-2">
            <Label for="transfer-amount">Valor (R$)</Label>
            <CurrencyInput id="transfer-amount" v-model="amountCents" />
          </div>
          <div class="space-y-2">
            <Label for="transfer-date">Data</Label>
            <Input id="transfer-date" v-model="date" type="date" />
          </div>
          <div class="space-y-2">
            <Label for="transfer-description">Descrição</Label>
            <Input id="transfer-description" v-model="description" maxlength="200" />
          </div>
          <Button type="submit" :loading="saving">Transferir</Button>
        </form>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Histórico</CardTitle>
          <div class="flex gap-1 rounded-full bg-muted p-1 text-xs font-extrabold">
            <button
              v-for="option in FILTERS"
              :key="option.value"
              type="button"
              class="rounded-full px-3 py-1 transition"
              :class="filter === option.value ? 'bg-card text-foreground shadow-soft' : 'text-muted-foreground'"
              @click="filter = option.value"
            >
              {{ option.label }}
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p v-if="history.length === 0" class="text-sm text-muted-foreground">Nenhuma movimentação.</p>
        <ul v-else class="divide-y">
          <li
            v-for="transfer in history"
            :key="transfer.id"
            class="flex items-center justify-between py-2 text-sm"
          >
            <div class="min-w-0">
              <p class="truncate font-medium">
                {{ transfer.description }}
                <span
                  v-if="isInvoicePayment(transfer)"
                  class="ml-1 rounded-full bg-sun/25 px-2 py-0.5 text-[0.58rem] font-black uppercase tracking-wider text-accent-foreground"
                >
                  fatura
                </span>
              </p>
              <p class="truncate text-xs text-muted-foreground">
                {{ accountName(transfer.source_account) }} → {{ accountName(transfer.destination_account) }}
                · {{ formatDate(transfer.date) }}
              </p>
            </div>
            <span class="shrink-0 font-semibold">{{ formatBRL(transfer.amount_cents) }}</span>
          </li>
        </ul>
      </CardContent>
    </Card>
  </div>
</template>
