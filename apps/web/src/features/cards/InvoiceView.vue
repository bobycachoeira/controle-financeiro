<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { ArrowLeft, Check } from "lucide-vue-next";
import {
  db,
  type LocalCategory,
  type LocalCreditCard,
  type LocalInvoice,
  type LocalTransaction,
} from "@/db/schema";
import { useSyncStore } from "@/stores/sync";
import { useAccountsStore } from "@/stores/accounts";
import { formatBRL } from "@/lib/format-input";
import { formatDate, formatDateShort } from "@/lib/format";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import CardContent from "@/components/ui/CardContent.vue";
import Badge from "@/components/ui/Badge.vue";
import InvoicePayModal from "./InvoicePayModal.vue";

const route = useRoute();
const router = useRouter();
const sync = useSyncStore();
const accountsStore = useAccountsStore();
const payModal = ref<InstanceType<typeof InvoicePayModal> | null>(null);

const invoice = ref<LocalInvoice | null>(null);
const card = ref<LocalCreditCard | null>(null);
const transactions = ref<LocalTransaction[]>([]);
const categories = ref<LocalCategory[]>([]);

const id = computed(() => String(route.params.id));
const cardLabel = computed(() => card.value?.bank?.trim() || "Cartão");
const purchases = computed(() =>
  [...transactions.value]
    .filter((tx) => !tx.deleted_at)
    .sort((a, b) => (a.date < b.date ? 1 : -1)),
);
const categoryById = computed(() => new Map(categories.value.map((category) => [category.id, category])));
const paidCents = computed(() => invoice.value?.paid_cents ?? 0);
const remainingCents = computed(() =>
  invoice.value ? Math.max(0, invoice.value.total_cents - paidCents.value) : 0,
);

async function load(): Promise<void> {
  await accountsStore.load();
  const record = await db.invoices.get(id.value);
  invoice.value = record && !record.deleted_at ? record : null;
  if (!record) return;
  card.value = (await db.credit_cards.get(record.credit_card)) ?? null;
  transactions.value = await db.transactions.where("invoice").equals(id.value).toArray();
  categories.value = (
    await db.categories.where("household").equals(record.household).toArray()
  ).filter((category) => !category.deleted_at);
}

function openPay(): void {
  if (invoice.value && card.value) payModal.value?.open(card.value, invoice.value);
}

async function onPaid(): Promise<void> {
  await load();
}

onMounted(load);
watch(() => sync.dataVersion, load);
</script>

<template>
  <div class="space-y-5">
    <div class="flex items-center gap-3">
      <button
        type="button"
        class="grid h-10 w-10 place-items-center rounded-full bg-card text-muted-foreground shadow-soft transition hover:text-foreground"
        aria-label="Voltar"
        @click="router.back()"
      >
        <ArrowLeft class="h-5 w-5" />
      </button>
      <div class="min-w-0">
        <p class="text-xs font-extrabold uppercase tracking-wider text-primary">Fatura</p>
        <h1 class="truncate font-display text-2xl font-black tracking-tight">
          {{ cardLabel }} · {{ invoice?.reference_month ?? "" }}
        </h1>
      </div>
    </div>

    <p v-if="!invoice" class="text-sm text-muted-foreground">Fatura não encontrada.</p>

    <template v-else>
      <Card>
        <CardContent class="space-y-3 p-4">
          <div class="flex items-center justify-between gap-2">
            <p class="text-xs font-semibold text-muted-foreground">
              Fecha {{ formatDate(invoice.closing_date) }} · Vence {{ formatDate(invoice.due_date) }}
            </p>
            <Badge
              :variant="
                invoice.status === 'paga'
                  ? 'success'
                  : invoice.status === 'vencida'
                    ? 'destructive'
                    : 'secondary'
              "
            >
              {{ invoice.status }}
            </Badge>
          </div>
          <div class="grid grid-cols-3 gap-2 text-center">
            <div class="rounded-2xl bg-muted/60 p-2">
              <p class="text-[0.6rem] font-extrabold uppercase tracking-wider text-muted-foreground">Total</p>
              <p class="font-display text-sm font-bold">{{ formatBRL(invoice.total_cents) }}</p>
            </div>
            <div class="rounded-2xl bg-muted/60 p-2">
              <p class="text-[0.6rem] font-extrabold uppercase tracking-wider text-muted-foreground">Pago</p>
              <p class="font-display text-sm font-bold text-leaf">{{ formatBRL(paidCents) }}</p>
            </div>
            <div class="rounded-2xl bg-muted/60 p-2">
              <p class="text-[0.6rem] font-extrabold uppercase tracking-wider text-muted-foreground">Falta</p>
              <p class="font-display text-sm font-bold">{{ formatBRL(remainingCents) }}</p>
            </div>
          </div>
          <Button v-if="invoice.status !== 'paga'" size="sm" data-testid="invoice-detail-pay" @click="openPay">
            <Check class="h-3.5 w-3.5" /> Pagar fatura
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent class="p-4">
          <p class="pb-2 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
            Lançamentos ({{ purchases.length }})
          </p>
          <p v-if="purchases.length === 0" class="text-sm text-muted-foreground">
            Nenhuma compra nesta fatura.
          </p>
          <ul v-else class="divide-y">
            <li
              v-for="tx in purchases"
              :key="tx.id"
              class="flex items-center justify-between gap-3 py-2.5 text-sm"
            >
              <RouterLink
                :to="{ name: 'transaction-edit', params: { id: tx.id } }"
                class="min-w-0 flex-1"
              >
                <p class="truncate font-bold">{{ tx.description || "Compra" }}</p>
                <p class="text-xs text-muted-foreground">
                  {{ formatDateShort(tx.date) }}
                  <template v-if="tx.category && categoryById.get(tx.category)">
                    · {{ categoryById.get(tx.category)?.name }}
                  </template>
                </p>
              </RouterLink>
              <span class="shrink-0 font-display font-bold">{{ formatBRL(tx.amount_cents) }}</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </template>

    <InvoicePayModal ref="payModal" @paid="onPaid" />
  </div>
</template>
