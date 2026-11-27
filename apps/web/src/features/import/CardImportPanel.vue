<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { RouterLink } from "vue-router";
import { useCardsStore } from "@/stores/cards";
import { useCardImportStore } from "@/stores/card-import";
import { useSyncStore } from "@/stores/sync";
import { useToast } from "@/composables/useToast";
import { formatBRL, formatDate } from "@/lib/format";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import CardContent from "@/components/ui/CardContent.vue";
import CardHeader from "@/components/ui/CardHeader.vue";
import CardTitle from "@/components/ui/CardTitle.vue";
import Badge from "@/components/ui/Badge.vue";
import CategorySelect from "@/components/ui/CategorySelect.vue";
import Label from "@/components/ui/Label.vue";
import Select from "@/components/ui/Select.vue";
import Textarea from "@/components/ui/Textarea.vue";
import type { LocalCreditCard } from "@/db/schema";

const cardsStore = useCardsStore();
const store = useCardImportStore();
const sync = useSyncStore();
const toast = useToast();

const cardId = ref("");
const defaultCategory = ref<string | null>(null);
const text = ref("");

const selectedCard = computed<LocalCreditCard | null>(
  () => cardsStore.cards.find((card) => card.id === cardId.value) ?? null,
);
const singleCard = computed(() => cardsStore.cards.length === 1);

function cardLabel(card: LocalCreditCard): string {
  const name = card.bank || "Cartão";
  return `${name} · fecha ${card.closing_day} · vence ${card.due_day}`;
}

async function loadCards(): Promise<void> {
  await cardsStore.load();
  if (singleCard.value) cardId.value = cardsStore.cards[0]?.id ?? "";
}

function parseText(): void {
  if (!text.value.trim()) {
    toast.error("Cole o CSV ou escolha um arquivo.");
    return;
  }
  store.parse(text.value);
  if (store.rows.length === 0) {
    toast.error("Nenhuma compra reconhecida. Confira o cabeçalho do CSV.");
    return;
  }
  if (store.validRows.length === 0) toast.error("Nenhuma linha válida para importar.");
}

async function onFile(event: Event): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  text.value = await file.text();
  parseText();
}

async function confirmImport(): Promise<void> {
  const card = selectedCard.value;
  if (!card) {
    toast.error("Selecione o cartão.");
    return;
  }
  try {
    const result = await store.confirm(card, defaultCategory.value || null);
    const parts = [`${result.created} compra(s) importada(s)`];
    if (result.skipped > 0) parts.push(`${result.skipped} já existente(s)`);
    if (result.invalid > 0) parts.push(`${result.invalid} inválida(s)`);
    toast.success(parts.join(" · "));
    text.value = "";
    await cardsStore.load();
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Falha ao importar as compras.");
  }
}

onMounted(loadCards);
watch(() => sync.dataVersion, loadCards);
</script>

<template>
  <div class="space-y-4">
    <Card>
      <CardHeader>
        <CardTitle>Compras do cartão</CardTitle>
        <p class="text-sm text-muted-foreground">
          Importe compras parceladas em andamento. O valor informado é o de
          <strong>cada parcela</strong>.
        </p>
      </CardHeader>
      <CardContent class="space-y-4">
        <p
          v-if="cardsStore.cards.length === 0"
          class="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground"
        >
          Nenhum cartão cadastrado. Cadastre em
          <RouterLink :to="{ name: 'cards' }" class="font-bold text-primary">Cartões</RouterLink>
          antes de importar.
        </p>

        <template v-else>
          <div class="space-y-2">
            <Label for="card-import-card">Cartão</Label>
            <Select id="card-import-card" v-model="cardId">
              <option value="">Selecione</option>
              <option v-for="card in cardsStore.cards" :key="card.id" :value="card.id">
                {{ cardLabel(card) }}
              </option>
            </Select>
          </div>
          <div class="space-y-2">
            <Label for="card-import-file">Arquivo CSV</Label>
            <input
              id="card-import-file"
              type="file"
              accept=".csv,.txt,text/csv"
              class="block w-full text-sm"
              @change="onFile"
            />
          </div>
          <div class="space-y-2">
            <Label for="card-import-text">Ou cole o conteúdo</Label>
            <Textarea
              id="card-import-text"
              v-model="text"
              :rows="5"
              placeholder="data_proxima_parcela;valor_parcela;parcelas_total;parcelas_pagas;estabelecimento;categoria"
            />
          </div>
          <div class="space-y-2">
            <Label for="card-import-category">Categoria padrão</Label>
            <CategorySelect
              id="card-import-category"
              v-model="defaultCategory"
              kind="saida"
              allow-empty
            />
          </div>
          <Button @click="parseText">Pré-visualizar</Button>
        </template>
      </CardContent>
    </Card>

    <Card v-if="store.rows.length > 0">
      <CardHeader>
        <CardTitle>Prévia</CardTitle>
        <p class="text-sm text-muted-foreground">
          {{ store.validRows.length }} compra(s) · {{ store.remainingCount }} parcela(s) restante(s)
          · {{ formatBRL(store.totalPerParcelCents) }} em parcelas
        </p>
        <p v-if="store.invalidCount > 0" class="text-xs font-bold text-amber-600">
          {{ store.invalidCount }} linha(s) inválida(s) — serão ignoradas
        </p>
      </CardHeader>
      <CardContent class="space-y-3">
        <ul class="divide-y text-sm">
          <li
            v-for="(row, index) in store.rows"
            :key="`${row.externalRef}-${index}`"
            class="flex items-start justify-between gap-3 py-2"
          >
            <div class="min-w-0">
              <p class="truncate font-semibold">
                {{ row.merchant || "(sem estabelecimento)" }}
              </p>
              <p class="text-xs text-muted-foreground">
                <template v-if="row.date">{{ formatDate(row.date) }} · </template>
                Parcela {{ row.paidInstallments + 1 }}/{{ row.installments }}
                <template v-if="!row.error">
                  · restam {{ row.installments - row.paidInstallments }}
                </template>
              </p>
              <Badge v-if="row.categoryName" variant="secondary" class="mt-1">
                {{ row.categoryName }}
              </Badge>
            </div>
            <div class="flex shrink-0 flex-col items-end gap-1">
              <span class="font-bold">{{ formatBRL(row.amountCents) }}</span>
              <Badge v-if="row.error" variant="destructive">{{ row.error }}</Badge>
            </div>
          </li>
        </ul>
        <Button :loading="store.importing" :disabled="!cardId" @click="confirmImport">
          Confirmar importação
        </Button>
        <p class="text-xs text-muted-foreground">
          Reimportar o mesmo arquivo não duplica as compras já importadas.
        </p>
      </CardContent>
    </Card>
  </div>
</template>
