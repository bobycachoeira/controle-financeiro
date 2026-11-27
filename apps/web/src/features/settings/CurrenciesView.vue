<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { todayISO } from "@cf/shared";
import type { LocalExchangeRate } from "@/db/schema";
import { useRatesStore, parseRateToMicros } from "@/stores/rates";
import { useSyncStore } from "@/stores/sync";
import { useToast } from "@/composables/useToast";
import { formatDate } from "@/lib/format";
import { COMMON_CURRENCIES } from "@/lib/currencies";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import CardContent from "@/components/ui/CardContent.vue";
import CardHeader from "@/components/ui/CardHeader.vue";
import CardTitle from "@/components/ui/CardTitle.vue";
import Input from "@/components/ui/Input.vue";
import Label from "@/components/ui/Label.vue";

const store = useRatesStore();
const sync = useSyncStore();
const toast = useToast();

const currency = ref("USD");
const date = ref(todayISO());
const rate = ref("");
const saving = ref(false);
const fetching = ref(false);

const currencyGroups = computed(() => {
  const groups = new Map<string, LocalExchangeRate[]>();
  for (const item of store.items) {
    const list = groups.get(item.currency) ?? [];
    list.push(item);
    groups.set(item.currency, list);
  }
  return [...groups.entries()]
    .map(([code, items]) => ({
      code,
      items: [...items].sort((a, b) => (a.date < b.date ? 1 : -1)),
    }))
    .sort((a, b) => a.code.localeCompare(b.code));
});

async function create(): Promise<void> {
  const micros = parseRateToMicros(rate.value);
  const code = currency.value.trim().toUpperCase();
  if (!/^[A-Z]{3,8}$/.test(code) || micros === null) {
    toast.error("Informe moeda e cotação válidas.");
    return;
  }
  currency.value = code;
  saving.value = true;
  try {
    await store.create({ currency: code, date: date.value, rate_micros: micros });
    toast.success("Cotação salva.");
    rate.value = "";
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Falha ao salvar cotação.");
  } finally {
    saving.value = false;
  }
}

function formatMicros(micros: number): string {
  return (micros / 1_000_000).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}

async function fetchCurrent(): Promise<void> {
  const code = currency.value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code) || code === "BRL") {
    toast.error("Informe uma moeda de 3 letras (ex.: USD).");
    return;
  }
  fetching.value = true;
  try {
    const quote = await store.fetchQuote(code);
    currency.value = quote.currency;
    rate.value = formatMicros(quote.rate_micros);
    date.value = quote.date;
    toast.success(`Cotação ${quote.currency}/BRL preenchida. Confira e salve.`);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Falha ao buscar a cotação.");
  } finally {
    fetching.value = false;
  }
}

onMounted(() => store.load());
watch(
  () => sync.dataVersion,
  () => store.load(),
);
</script>

<template>
  <div class="space-y-4">
    <h1 class="text-xl font-bold">Moedas e cotações</h1>

    <Card>
      <CardHeader><CardTitle>Nova cotação</CardTitle></CardHeader>
      <CardContent>
        <form class="space-y-4" @submit.prevent="create">
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-2">
              <Label for="rate-currency">Moeda</Label>
              <Input
                id="rate-currency"
                v-model="currency"
                list="currency-options"
                maxlength="8"
                placeholder="USD"
              />
              <datalist id="currency-options">
                <option v-for="item in COMMON_CURRENCIES" :key="item.code" :value="item.code">
                  {{ item.label }}
                </option>
              </datalist>
            </div>
            <div class="space-y-2">
              <Label for="rate-date">Data</Label>
              <Input id="rate-date" v-model="date" type="date" />
            </div>
          </div>
          <div class="space-y-2">
            <Label for="rate-value">Cotação para BRL</Label>
            <div class="flex gap-2">
              <Input
                id="rate-value"
                v-model="rate"
                inputmode="decimal"
                placeholder="5,20"
                class="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                :loading="fetching"
                data-testid="rate-fetch"
                @click="fetchCurrent"
              >
                Buscar agora
              </Button>
            </div>
            <p class="text-xs text-muted-foreground">
              Busca gratuita na AwesomeAPI (USD, EUR e outras moedas).
            </p>
          </div>
          <Button type="submit" :loading="saving">Salvar cotação</Button>
        </form>
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle>Histórico</CardTitle></CardHeader>
      <CardContent>
        <p v-if="currencyGroups.length === 0" class="text-sm text-muted-foreground">
          Nenhuma cotação cadastrada.
        </p>
        <div v-else class="space-y-4">
          <div v-for="group in currencyGroups" :key="group.code" class="space-y-1">
            <p class="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
              {{ group.code }}
            </p>
            <ul class="divide-y">
              <li
                v-for="item in group.items"
                :key="item.id"
                class="flex items-center justify-between py-2 text-sm"
              >
                <span>{{ item.currency }} · {{ formatDate(item.date) }}</span>
                <span class="flex items-center gap-2">
                  R$ {{ formatMicros(item.rate_micros) }}
                  <Button size="sm" variant="ghost" @click="store.remove(item.id)">Excluir</Button>
                </span>
              </li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
