<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { todayISO } from "@cf/shared";
import { useRatesStore, parseRateToMicros } from "@/stores/rates";
import { useSyncStore } from "@/stores/sync";
import { useToast } from "@/composables/useToast";
import { formatDate } from "@/lib/format";
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

async function create(): Promise<void> {
  const micros = parseRateToMicros(rate.value);
  if (!currency.value || micros === null) {
    toast.error("Informe moeda e cotação válidas.");
    return;
  }
  saving.value = true;
  try {
    await store.create({ currency: currency.value, date: date.value, rate_micros: micros });
    toast.success("Cotação salva.");
    rate.value = "";
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Falha ao salvar cotação.");
  } finally {
    saving.value = false;
  }
}

function formatMicros(micros: number): string {
  return (micros / 1_000_000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 6 });
}

onMounted(() => store.load());
watch(() => sync.dataVersion, () => store.load());
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
              <Input id="rate-currency" v-model="currency" maxlength="8" placeholder="USD" />
            </div>
            <div class="space-y-2">
              <Label for="rate-date">Data</Label>
              <Input id="rate-date" v-model="date" type="date" />
            </div>
          </div>
          <div class="space-y-2">
            <Label for="rate-value">Cotação para BRL</Label>
            <Input id="rate-value" v-model="rate" inputmode="decimal" placeholder="5,20" />
          </div>
          <Button type="submit" :loading="saving">Salvar cotação</Button>
        </form>
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle>Histórico</CardTitle></CardHeader>
      <CardContent>
        <p v-if="store.items.length === 0" class="text-sm text-muted-foreground">
          Nenhuma cotação cadastrada.
        </p>
        <ul v-else class="divide-y">
          <li
            v-for="item in store.items"
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
      </CardContent>
    </Card>
  </div>
</template>
