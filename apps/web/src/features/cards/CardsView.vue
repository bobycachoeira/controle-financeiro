<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { CreditCard, Pencil, Plus, Trash2 } from "lucide-vue-next";
import { useCardsStore } from "@/stores/cards";
import { useSyncStore } from "@/stores/sync";
import { useToast } from "@/composables/useToast";
import { formatBRL, parseAmountInput } from "@/lib/format-input";
import { formatDate } from "@/lib/format";
import { colorForKey } from "@/lib/icons";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import CardContent from "@/components/ui/CardContent.vue";
import Badge from "@/components/ui/Badge.vue";
import Input from "@/components/ui/Input.vue";
import Label from "@/components/ui/Label.vue";
import Modal from "@/components/ui/Modal.vue";
import type { LocalCreditCard } from "@/db/schema";

const cardsStore = useCardsStore();
const sync = useSyncStore();
const toast = useToast();

const open = ref(false);
const editingId = ref<string | null>(null);
const name = ref("");
const bank = ref("");
const limit = ref("");
const closingDay = ref(15);
const dueDay = ref(25);
const saving = ref(false);

const statusVariant: Record<string, "secondary" | "success" | "warning" | "destructive"> = {
  aberta: "secondary",
  fechada: "warning",
  paga: "success",
  vencida: "destructive",
};

function cardGradient(card: LocalCreditCard): string {
  const base = colorForKey(card.bank || card.id);
  return `linear-gradient(135deg, ${base}, hsl(156 30% 16%))`;
}

function openCreate(): void {
  editingId.value = null;
  name.value = "";
  bank.value = "";
  limit.value = "";
  closingDay.value = 15;
  dueDay.value = 25;
  open.value = true;
}

function openEdit(card: LocalCreditCard): void {
  editingId.value = card.id;
  bank.value = card.bank ?? "";
  limit.value = card.limit_cents ? (card.limit_cents / 100).toFixed(2).replace(".", ",") : "";
  closingDay.value = card.closing_day;
  dueDay.value = card.due_day;
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
      });
      toast.success("Cartão atualizado.");
    } else {
      await cardsStore.create({
        name: name.value,
        bank: bank.value,
        limit_cents: cents,
        closing_day: Number(closingDay.value),
        due_day: Number(dueDay.value),
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

const cardLabel = (card: LocalCreditCard) => (card.bank ? card.bank : "Cartão");

onMounted(() => cardsStore.load());
watch(() => sync.dataVersion, () => cardsStore.load());
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
      <Card v-for="card in cardsStore.cards" :key="card.id" class="overflow-hidden">
        <div
          class="flex items-start justify-between px-5 py-5 text-primary-foreground"
          :style="{ background: cardGradient(card) }"
        >
          <div>
            <p class="text-[0.62rem] font-extrabold uppercase tracking-[0.2em] opacity-80">
              {{ cardLabel(card) }}
            </p>
            <p class="mt-1 font-display text-2xl font-black">•••• {{ card.closing_day }}/{{ card.due_day }}</p>
            <p class="mt-2 text-xs font-semibold opacity-90">
              Limite {{ formatBRL(card.limit_cents) }}
            </p>
          </div>
          <div class="flex gap-1">
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
          <p class="pb-1 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
            Faturas
          </p>
          <ul class="divide-y">
            <li
              v-for="invoice in cardsStore.invoicesFor(card.id)"
              :key="invoice.id"
              class="flex items-center justify-between py-2 text-sm"
            >
              <div>
                <p class="font-bold">{{ invoice.reference_month }}</p>
                <p class="text-xs text-muted-foreground">
                  Fecha {{ formatDate(invoice.closing_date) }} · Vence {{ formatDate(invoice.due_date) }}
                </p>
              </div>
              <span class="flex items-center gap-2">
                <span class="font-display font-bold">{{ formatBRL(invoice.total_cents) }}</span>
                <Badge :variant="statusVariant[invoice.status] ?? 'secondary'">{{ invoice.status }}</Badge>
              </span>
            </li>
          </ul>
          <p v-if="cardsStore.invoicesFor(card.id).length === 0" class="text-xs text-muted-foreground">
            Sem faturas ainda.
          </p>
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
            <Label for="card-closing">Dia de fechamento</Label>
            <Input id="card-closing" v-model.number="closingDay" type="number" min="1" max="31" />
          </div>
          <div class="space-y-2">
            <Label for="card-due">Dia de vencimento</Label>
            <Input id="card-due" v-model.number="dueDay" type="number" min="1" max="31" />
          </div>
        </div>
        <div class="flex justify-end gap-2 pt-1">
          <Button variant="ghost" type="button" @click="open = false">Cancelar</Button>
          <Button type="submit" :loading="saving">Salvar</Button>
        </div>
      </form>
    </Modal>
  </div>
</template>
