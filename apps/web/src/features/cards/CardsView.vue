<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { RouterLink } from "vue-router";
import { Check, ChevronDown, ChevronUp, CreditCard, Pencil, Plus, Trash2 } from "lucide-vue-next";
import { useCardsStore } from "@/stores/cards";
import { usePeopleStore } from "@/stores/people";
import { useAccountsStore } from "@/stores/accounts";
import { useSyncStore } from "@/stores/sync";
import { useToast } from "@/composables/useToast";
import { formatBRL, parseAmountInput } from "@/lib/format-input";
import { formatCentsToInput, formatDate } from "@/lib/format";
import { colorForKey } from "@/lib/icons";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import CardContent from "@/components/ui/CardContent.vue";
import Badge from "@/components/ui/Badge.vue";
import Input from "@/components/ui/Input.vue";
import Label from "@/components/ui/Label.vue";
import Select from "@/components/ui/Select.vue";
import Modal from "@/components/ui/Modal.vue";
import InvoicePayModal from "./InvoicePayModal.vue";
import { pickVisibleInvoices } from "./invoice-list";
import type { LocalCreditCard, LocalInvoice } from "@/db/schema";

const cardsStore = useCardsStore();
const people = usePeopleStore();
const accountsStore = useAccountsStore();
const sync = useSyncStore();
const toast = useToast();
const payModal = ref<InstanceType<typeof InvoicePayModal> | null>(null);
const expandedCards = ref<Record<string, boolean>>({});

/** Mostra só as próximas faturas a pagar; o resto atrás de "Ver todas". */
function visibleInvoices(cardId: string): LocalInvoice[] {
  return pickVisibleInvoices(cardsStore.invoicesFor(cardId), Boolean(expandedCards.value[cardId]));
}

const CARD_COLORS = [
  "#1B1B1F",
  "#0F172A",
  "#E4572E",
  "#F2A93B",
  "#3F9A6A",
  "#3B82B6",
  "#B0477E",
  "#8A6FD1",
  "#1F7A73",
  "#7C2D12",
];

const open = ref(false);
const editingId = ref<string | null>(null);
const name = ref("");
const bank = ref("");
const limit = ref("");
const closingDay = ref(15);
const dueDay = ref(25);
const color = ref<string>("#1B1B1F");
const paymentAccount = ref("");
const owner = ref("indefinido");
const saving = ref(false);

const statusVariant: Record<string, "secondary" | "success" | "warning" | "destructive"> = {
  aberta: "secondary",
  fechada: "warning",
  paga: "success",
  vencida: "destructive",
};

function cardGradient(card: LocalCreditCard): string {
  const base = card.color || colorForKey(card.bank || card.id);
  return `linear-gradient(135deg, ${base}, ${base}cc 55%, hsl(156 30% 14%))`;
}

function paymentAccountName(card: LocalCreditCard): string {
  if (!card.payment_account) return "";
  return accountsStore.items.find((a) => a.id === card.payment_account)?.name ?? "";
}

function openCreate(): void {
  editingId.value = null;
  name.value = "";
  bank.value = "";
  limit.value = "";
  closingDay.value = 15;
  dueDay.value = 25;
  color.value = CARD_COLORS[0]!;
  paymentAccount.value = "";
  owner.value = "indefinido";
  open.value = true;
}

function openEdit(card: LocalCreditCard): void {
  editingId.value = card.id;
  bank.value = card.bank ?? "";
  limit.value = card.limit_cents ? formatCentsToInput(card.limit_cents) : "";
  closingDay.value = card.closing_day;
  dueDay.value = card.due_day;
  color.value = card.color || colorForKey(card.bank || card.id);
  paymentAccount.value = card.payment_account ?? "";
  owner.value = card.owner ?? "indefinido";
  open.value = true;
}

async function submit(): Promise<void> {
  const cents = parseAmountInput(limit.value) ?? 0;
  if (!editingId.value && !name.value) {
    toast.error("Informe um nome.");
    return;
  }
  saving.value = true;
  try {
    if (editingId.value) {
      await cardsStore.update(editingId.value, {
        bank: bank.value,
        limit_cents: cents,
        closing_day: Number(closingDay.value),
        due_day: Number(dueDay.value),
        color: color.value,
        payment_account: paymentAccount.value || null,
        owner: owner.value,
      });
      toast.success("Cartão atualizado.");
    } else {
      await cardsStore.create({
        name: name.value,
        bank: bank.value,
        limit_cents: cents,
        closing_day: Number(closingDay.value),
        due_day: Number(dueDay.value),
        color: color.value,
        payment_account: paymentAccount.value || null,
        owner: owner.value,
      });
      toast.success("Cartão criado.");
    }
    open.value = false;
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Falha ao salvar cartão.");
  } finally {
    saving.value = false;
  }
}

function openPay(card: LocalCreditCard, invoice: LocalInvoice): void {
  payModal.value?.open(card, invoice);
}

async function onPaid(): Promise<void> {
  await cardsStore.load();
}

onMounted(async () => {
  await Promise.all([cardsStore.load(), accountsStore.load(), people.load()]);
  await cardsStore.ensureMonthlyInvoices();
  if (!editingId.value) color.value = CARD_COLORS[0]!;
});
watch(
  () => sync.dataVersion,
  async () => {
    await cardsStore.load();
    // Cartões criados em outro aparelho também ganham a fatura do ciclo.
    await cardsStore.ensureMonthlyInvoices();
  },
);
</script>

<template>
  <div class="space-y-5">
    <div class="flex items-end justify-between gap-3">
      <div>
        <p class="text-xs font-extrabold uppercase tracking-wider text-primary">Crédito</p>
        <h1 class="font-display text-3xl font-black tracking-tight">Cartões</h1>
      </div>
      <Button size="sm" @click="openCreate"><Plus class="h-4 w-4" /> Novo</Button>
    </div>

    <p
      v-if="cardsStore.cards.length === 0"
      class="flex flex-col items-center gap-2 rounded-[1.6rem] border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground"
    >
      <CreditCard class="h-8 w-8 text-muted-foreground/50" />
      Nenhum cartão cadastrado.
    </p>

    <div class="stagger space-y-5">
      <Card v-for="(card, cardIndex) in cardsStore.cards" :key="card.id" data-testid="card" class="overflow-hidden">
        <div
          class="flex items-start justify-between px-5 py-5 text-white"
          :style="{ background: cardGradient(card) }"
        >
          <div>
            <p class="text-[0.62rem] font-extrabold uppercase tracking-[0.25em] opacity-80">
              {{ card.bank || "Cartão" }}
            </p>
            <p class="mt-1 font-display text-xl font-black">
              fecha dia {{ card.closing_day }} · vence dia {{ card.due_day }}
            </p>
            <p class="mt-2 text-xs font-semibold opacity-90">Limite {{ formatBRL(card.limit_cents) }}</p>
            <p v-if="card.owner && card.owner !== 'indefinido'" class="mt-0.5 text-[0.68rem] font-semibold opacity-80">
              Titular: {{ people.label(card.owner) }}
            </p>
            <p v-if="paymentAccountName(card)" class="mt-0.5 text-[0.68rem] font-semibold opacity-80">
              Fatura paga por {{ paymentAccountName(card) }}
            </p>
          </div>
          <div class="grid grid-cols-2 gap-1">
            <button
              class="grid h-9 w-9 place-items-center rounded-full bg-white/20 transition hover:bg-white/30 disabled:opacity-30 disabled:hover:bg-white/20"
              aria-label="Mover cartão para cima"
              :disabled="cardIndex === 0"
              @click="cardsStore.move(card.id, -1)"
            >
              <ChevronUp class="h-4 w-4" />
            </button>
            <button
              class="grid h-9 w-9 place-items-center rounded-full bg-white/20 transition hover:bg-white/30 disabled:opacity-30 disabled:hover:bg-white/20"
              aria-label="Mover cartão para baixo"
              :disabled="cardIndex === cardsStore.cards.length - 1"
              @click="cardsStore.move(card.id, 1)"
            >
              <ChevronDown class="h-4 w-4" />
            </button>
            <button
              class="grid h-9 w-9 place-items-center rounded-full bg-white/20 transition hover:bg-white/30"
              aria-label="Editar cartão"
              @click="openEdit(card)"
            >
              <Pencil class="h-4 w-4" />
            </button>
            <button
              class="grid h-9 w-9 place-items-center rounded-full bg-white/20 transition hover:bg-white/30"
              aria-label="Excluir cartão"
              @click="cardsStore.remove(card.id)"
            >
              <Trash2 class="h-4 w-4" />
            </button>
          </div>
        </div>
        <CardContent class="p-4">
          <p class="pb-1 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">Faturas</p>
          <ul class="divide-y">
            <li
              v-for="invoice in visibleInvoices(card.id)"
              :key="invoice.id"
              class="flex items-center justify-between gap-2 py-2.5 text-sm"
            >
              <RouterLink
                :to="{ name: 'invoice', params: { id: invoice.id } }"
                class="min-w-0 flex-1"
              >
                <p class="font-bold">{{ invoice.reference_month }}</p>
                <p class="text-xs text-muted-foreground">
                  Fecha {{ formatDate(invoice.closing_date) }} · Vence {{ formatDate(invoice.due_date) }}
                </p>
              </RouterLink>
              <div class="flex items-center gap-2">
                <div class="text-right">
                  <span class="font-display font-bold">{{ formatBRL(invoice.total_cents) }}</span>
                  <p
                    v-if="(invoice.paid_cents ?? 0) > 0 && (invoice.paid_cents ?? 0) < invoice.total_cents"
                    class="text-[0.62rem] font-semibold text-muted-foreground"
                  >
                    pago {{ formatBRL(invoice.paid_cents) }} · falta
                    {{ formatBRL(invoice.total_cents - invoice.paid_cents) }}
                  </p>
                </div>
                <Badge :variant="statusVariant[invoice.status] ?? 'secondary'">{{ invoice.status }}</Badge>
                <Button
                  v-if="invoice.status !== 'paga'"
                  data-testid="invoice-pay"
                  size="sm"
                  variant="secondary"
                  @click="openPay(card, invoice)"
                >
                  <Check class="h-3.5 w-3.5" /> Pagar
                </Button>
              </div>
            </li>
          </ul>
          <p v-if="cardsStore.invoicesFor(card.id).length === 0" class="text-xs text-muted-foreground">
            Sem faturas ainda.
          </p>
          <button
            v-if="cardsStore.invoicesFor(card.id).length > 2"
            type="button"
            data-testid="invoices-toggle"
            class="mt-2 text-xs font-bold text-primary transition hover:underline"
            @click="expandedCards[card.id] = !expandedCards[card.id]"
          >
            {{
              expandedCards[card.id]
                ? "Ver menos"
                : `Ver todas (${cardsStore.invoicesFor(card.id).length})`
            }}
          </button>
          <RouterLink
            :to="{ name: 'transaction-new', query: { card: card.id } }"
            class="mt-2 block text-xs font-bold text-primary transition hover:underline"
          >
            Lançar compras anteriores (parcelas em andamento)
          </RouterLink>
        </CardContent>
      </Card>
    </div>

    <Modal v-model="open" :title="editingId ? 'Editar cartão' : 'Novo cartão'">
      <form class="space-y-4" @submit.prevent="submit">
        <div v-if="!editingId" class="space-y-2">
          <Label for="card-name">Nome</Label>
          <Input id="card-name" v-model="name" required />
        </div>
        <div class="space-y-2">
          <Label for="card-bank">Banco</Label>
          <Input id="card-bank" v-model="bank" />
        </div>
        <div class="space-y-2">
          <Label for="card-limit">Limite (R$)</Label>
          <Input id="card-limit" v-model="limit" inputmode="decimal" placeholder="0,00" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-2">
            <Label for="card-closing">Fechamento</Label>
            <Input id="card-closing" v-model.number="closingDay" type="number" min="1" max="31" />
          </div>
          <div class="space-y-2">
            <Label for="card-due">Vencimento</Label>
            <Input id="card-due" v-model.number="dueDay" type="number" min="1" max="31" />
          </div>
        </div>
        <div class="space-y-2">
          <Label for="card-owner">Titular do cartão</Label>
          <Select id="card-owner" v-model="owner">
            <option v-for="option in people.selectable" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </Select>
        </div>
        <div class="space-y-2">
          <Label for="card-payment">Conta que paga a fatura</Label>
          <Select id="card-payment" v-model="paymentAccount">
            <option value="">Não definida</option>
            <option
              v-for="item in accountsStore.items.filter((a) => a.type !== 'cartao_credito')"
              :key="item.id"
              :value="item.id"
            >
              {{ item.name }}
            </option>
          </Select>
        </div>
        <div class="space-y-2">
          <Label>Cor do cartão</Label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="c in CARD_COLORS"
              :key="c"
              type="button"
              class="grid h-9 w-9 place-items-center rounded-full text-white ring-offset-2 ring-offset-card transition"
              :class="c === color && 'ring-2'"
              :style="{ backgroundColor: c }"
              :aria-label="`cor ${c}`"
              @click="color = c"
            >
              <Check v-if="c === color" class="h-4 w-4" />
            </button>
          </div>
        </div>
        <div class="flex justify-end gap-2 pt-1">
          <Button variant="ghost" type="button" @click="open = false">Cancelar</Button>
          <Button type="submit" :loading="saving">Salvar</Button>
        </div>
      </form>
    </Modal>

    <InvoicePayModal ref="payModal" @paid="onPaid" />
  </div>
</template>
