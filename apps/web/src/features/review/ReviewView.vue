<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { RouterLink } from "vue-router";
import { CheckCircle2, Pencil } from "lucide-vue-next";
import { todayISO } from "@cf/shared";
import { db, type LocalCategory, type LocalTransaction } from "@/db/schema";
import { useAccountsStore } from "@/stores/accounts";
import { useSessionStore } from "@/stores/session";
import { useSyncStore } from "@/stores/sync";
import { useTransactionsStore } from "@/stores/transactions";
import { useToast } from "@/composables/useToast";
import { formatBRL, formatDateShort } from "@/lib/format";
import Card from "@/components/ui/Card.vue";
import CardContent from "@/components/ui/CardContent.vue";
import CategorySelect from "@/components/ui/CategorySelect.vue";
import {
  placeholderCategoryIds,
  REVIEW_WINDOW_DAYS,
  REVIEW_WINDOW_DAYS_LONG,
  selectReviewQueue,
} from "./review";

const transactionsStore = useTransactionsStore();
const accountsStore = useAccountsStore();
const session = useSessionStore();
const sync = useSyncStore();
const toast = useToast();

const categories = ref<LocalCategory[]>([]);
const windowDays = ref<number>(REVIEW_WINDOW_DAYS);

const queue = computed(() =>
  selectReviewQueue(transactionsStore.items, {
    uncategorizedIds: placeholderCategoryIds(categories.value),
    knownIds: new Set(categories.value.map((category) => category.id)),
    today: todayISO(),
    days: windowDays.value,
  }),
);

const accountById = computed(() => new Map(accountsStore.items.map((item) => [item.id, item.name])));

async function assign(tx: LocalTransaction, categoryId: string): Promise<void> {
  if (!categoryId) return;
  await transactionsStore.update(tx.id, { category: categoryId });
  toast.success("Categoria atualizada.");
}

async function loadAll(): Promise<void> {
  await Promise.all([transactionsStore.load(), accountsStore.load()]);
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
    <div>
      <p class="text-xs font-extrabold uppercase tracking-wider text-primary">Organizar</p>
      <h1 class="font-display text-3xl font-black tracking-tight">Revisar</h1>
    </div>

    <p class="text-sm text-muted-foreground">
      Lançamentos sem categoria útil. Coloque a categoria no próprio item — ou abra para editar os
      detalhes. Nada aqui é obrigatório: é só para os relatórios ficarem certos.
    </p>

    <div class="flex items-center justify-between gap-2">
      <span class="rounded-full bg-muted px-3 py-1 text-xs font-bold text-muted-foreground">
        {{ queue.length }} para revisar
      </span>
      <div class="flex gap-1 rounded-full bg-muted p-1 text-xs font-extrabold">
        <button
          type="button"
          data-compact
          class="rounded-full px-3 py-1 transition"
          :class="windowDays === REVIEW_WINDOW_DAYS ? 'bg-card shadow-soft' : 'text-muted-foreground'"
          @click="windowDays = REVIEW_WINDOW_DAYS"
        >
          30 dias
        </button>
        <button
          type="button"
          data-compact
          class="rounded-full px-3 py-1 transition"
          :class="
            windowDays === REVIEW_WINDOW_DAYS_LONG ? 'bg-card shadow-soft' : 'text-muted-foreground'
          "
          @click="windowDays = REVIEW_WINDOW_DAYS_LONG"
        >
          90 dias
        </button>
      </div>
    </div>

    <Card>
      <CardContent class="p-2">
        <p
          v-if="queue.length === 0"
          class="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-muted-foreground"
        >
          <CheckCircle2 class="h-8 w-8 text-leaf" />
          Tudo categorizado nos últimos {{ windowDays }} dias.
        </p>
        <ul v-else class="stagger divide-y">
          <li
            v-for="tx in queue"
            :key="tx.id"
            data-testid="review-row"
            class="flex flex-col gap-2 px-2 py-3"
          >
            <div class="flex items-center justify-between gap-2">
              <div class="min-w-0">
                <p class="truncate font-bold">{{ tx.description || "Lançamento" }}</p>
                <p class="text-xs font-semibold text-muted-foreground">
                  {{ formatDateShort(tx.date) }}
                  <template v-if="accountById.get(tx.account)">
                    · {{ accountById.get(tx.account) }}</template
                  >
                </p>
              </div>
              <span
                class="shrink-0 font-display font-bold"
                :class="tx.type === 'receita' ? 'text-leaf' : 'text-foreground'"
              >
                {{ tx.type === "receita" ? "+" : "−" }}{{ formatBRL(tx.amount_cents) }}
              </span>
            </div>
            <div class="flex items-center gap-2">
              <div data-testid="review-category" class="min-w-0 flex-1">
                <CategorySelect
                  :model-value="tx.category ?? ''"
                  :kind="tx.type === 'receita' ? 'entrada' : 'saida'"
                  @update:model-value="(value: string) => assign(tx, value)"
                />
              </div>
              <RouterLink
                :to="{ name: 'transaction-edit', params: { id: tx.id } }"
                class="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-primary"
                aria-label="Editar lançamento"
              >
                <Pencil class="h-4 w-4" />
              </RouterLink>
            </div>
          </li>
        </ul>
      </CardContent>
    </Card>

    <p v-if="queue.length > 0" class="text-center text-xs font-semibold text-muted-foreground">
      Dica: itens em “Outros” somam
      {{ formatBRL(queue.reduce((sum, tx) => sum + (tx.type === "despesa" ? tx.amount_cents : -tx.amount_cents), 0)) }}
      no período.
    </p>

    <RouterLink
      :to="{ name: 'transactions' }"
      class="flex h-11 w-full items-center justify-center rounded-full font-extrabold text-foreground/80 transition hover:bg-muted hover:text-foreground"
    >
      Ver todos os lançamentos
    </RouterLink>
  </div>
</template>
