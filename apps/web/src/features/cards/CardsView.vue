<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { useCardsStore } from "@/stores/cards";
import { useSyncStore } from "@/stores/sync";
import { useToast } from "@/composables/useToast";
import { formatBRL, parseAmountInput } from "@/lib/format-input";
import { formatDate } from "@/lib/format";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import CardContent from "@/components/ui/CardContent.vue";
import CardHeader from "@/components/ui/CardHeader.vue";
import CardTitle from "@/components/ui/CardTitle.vue";
import Badge from "@/components/ui/Badge.vue";
import Input from "@/components/ui/Input.vue";
import Label from "@/components/ui/Label.vue";
import Modal from "@/components/ui/Modal.vue";

const cardsStore = useCardsStore();
const sync = useSyncStore();
const toast = useToast();

const open = ref(false);
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

async function submit(): Promise<void> {
  const cents = parseAmountInput(limit.value) ?? 0;
  if (!name.value) {
    toast.error("Informe um nome.");
    return;
  }
  saving.value = true;
  try {
    await cardsStore.create({
      name: name.value,
      bank: bank.value,
      limit_cents: cents,
      closing_day: Number(closingDay.value),
      due_day: Number(dueDay.value),
    });
    toast.success("Cartão criado.");
    open.value = false;
    name.value = "";
    bank.value = "";
    limit.value = "";
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Falha ao criar cartão.");
  } finally {
    saving.value = false;
  }
}

onMounted(() => cardsStore.load());
watch(() => sync.dataVersion, () => cardsStore.load());
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-bold">Cartões de crédito</h1>
      <Button size="sm" @click="open = true">Novo cartão</Button>
    </div>

    <p v-if="cardsStore.cards.length === 0" class="text-sm text-muted-foreground">
      Nenhum cartão cadastrado.
    </p>

    <Card v-for="card in cardsStore.cards" :key="card.id">
      <CardHeader>
        <CardTitle>{{ card.bank ? `${card.bank} · ` : "" }}Cartão</CardTitle>
      </CardHeader>
      <CardContent class="space-y-3">
        <p class="text-sm text-muted-foreground">
          Fecha dia {{ card.closing_day }} · Vence dia {{ card.due_day }} · Limite
          {{ formatBRL(card.limit_cents) }}
        </p>
        <ul class="divide-y">
          <li
            v-for="invoice in cardsStore.invoicesFor(card.id)"
            :key="invoice.id"
            class="flex items-center justify-between py-2 text-sm"
          >
            <div>
              <p class="font-medium">{{ invoice.reference_month }}</p>
              <p class="text-xs text-muted-foreground">
                Fecha {{ formatDate(invoice.closing_date) }} · Vence {{ formatDate(invoice.due_date) }}
              </p>
            </div>
            <span class="flex items-center gap-2">
              {{ formatBRL(invoice.total_cents) }}
              <Badge :variant="statusVariant[invoice.status] ?? 'secondary'">{{ invoice.status }}</Badge>
            </span>
          </li>
        </ul>
        <p
          v-if="cardsStore.invoicesFor(card.id).length === 0"
          class="text-xs text-muted-foreground"
        >
          Sem faturas ainda.
        </p>
      </CardContent>
    </Card>

    <Modal v-model="open" title="Novo cartão">
      <form class="space-y-4" @submit.prevent="submit">
        <div class="space-y-2">
          <Label for="card-name">Nome</Label>
          <Input id="card-name" v-model="name" required />
        </div>
        <div class="space-y-2">
          <Label for="card-bank">Banco (opcional)</Label>
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
        <div class="flex justify-end gap-2">
          <Button variant="ghost" type="button" @click="open = false">Cancelar</Button>
          <Button type="submit" :loading="saving">Criar</Button>
        </div>
      </form>
    </Modal>
  </div>
</template>
