<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import type { Attribution } from "@cf/shared";
import { todayISO } from "@cf/shared";
import { db, type LocalCategory } from "@/db/schema";
import { useTransactionsStore } from "@/stores/transactions";
import { useAccountsStore } from "@/stores/accounts";
import { useCardsStore } from "@/stores/cards";
import { useSessionStore } from "@/stores/session";
import { useToast } from "@/composables/useToast";
import { parseAmountInput } from "@/lib/format-input";
import { formatBRL } from "@/lib/format";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import CardContent from "@/components/ui/CardContent.vue";
import Input from "@/components/ui/Input.vue";
import Label from "@/components/ui/Label.vue";
import Select from "@/components/ui/Select.vue";

const transactionsStore = useTransactionsStore();
const accountsStore = useAccountsStore();
const cardsStore = useCardsStore();
const session = useSessionStore();
const router = useRouter();
const toast = useToast();

const amount = ref("");
const type = ref<"receita" | "despesa">("despesa");
const description = ref("");
const date = ref(todayISO());
const account = ref("");
const creditCard = ref("");
const attribution = ref<Attribution>("indefinido");
const status = ref<"pago" | "a_pagar">("pago");
const category = ref("");
const installments = ref(1);
const saving = ref(false);
const categories = ref<LocalCategory[]>([]);

const isCard = computed(() => creditCard.value !== "");
const card = computed(() => cardsStore.cards.find((item) => item.id === creditCard.value));

const filteredCategories = computed(() =>
  categories.value.filter((item) => item.kind === (type.value === "receita" ? "entrada" : "saida")),
);

async function loadCategories(): Promise<void> {
  if (!session.currentHouseholdId) return;
  categories.value = (
    await db.categories.where("household").equals(session.currentHouseholdId).toArray()
  ).filter((item) => !item.deleted_at);
}

async function submit(): Promise<void> {
  const cents = parseAmountInput(amount.value);
  if (cents === null || cents <= 0) {
    toast.error("Informe um valor válido.");
    return;
  }
  if (type.value === "despesa" && !category.value) {
    toast.error("Selecione uma categoria.");
    return;
  }
  saving.value = true;
  try {
    if (isCard.value && card.value) {
      await transactionsStore.createCardPurchase({
        account: card.value.account,
        credit_card: card.value.id,
        amount_cents: cents,
        date: date.value,
        attribution: attribution.value,
        category: category.value || null,
        description: description.value,
        status: "a_pagar",
        installments: installments.value,
        closing_day: card.value.closing_day,
        due_day: card.value.due_day,
      });
      toast.success("Compra no cartão registrada e parcelada.");
    } else {
      await transactionsStore.create({
        account: account.value,
        credit_card: null,
        amount_cents: cents,
        type: type.value,
        date: date.value,
        attribution: attribution.value,
        category: category.value || null,
        description: description.value,
        status: status.value,
      });
      toast.success("Lançamento salvo.");
    }
    router.push({ name: "transactions" });
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Falha ao salvar.");
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  await Promise.all([accountsStore.load(), cardsStore.load(), loadCategories()]);
  account.value = accountsStore.items.find((item) => item.type !== "cartao_credito")?.id ?? "";
});
</script>

<template>
  <div class="space-y-4">
    <h1 class="text-xl font-bold">Novo lançamento</h1>

    <Card>
      <CardContent class="space-y-4 pt-4">
        <div class="space-y-2">
          <Label for="amount">Valor (R$)</Label>
          <Input
            id="amount"
            v-model="amount"
            inputmode="decimal"
            placeholder="0,00"
            class="text-2xl font-semibold"
            autofocus
          />
        </div>

        <div class="space-y-2">
          <Label>Tipo</Label>
          <div class="grid grid-cols-2 gap-2">
            <Button :variant="type === 'despesa' ? 'default' : 'outline'" type="button" @click="type = 'despesa'">
              Despesa
            </Button>
            <Button :variant="type === 'receita' ? 'default' : 'outline'" type="button" @click="type = 'receita'">
              Receita
            </Button>
          </div>
        </div>

        <div class="space-y-2">
          <Label for="description">Descrição</Label>
          <Input id="description" v-model="description" maxlength="200" />
        </div>

        <div class="space-y-2">
          <Label for="date">Data</Label>
          <Input id="date" v-model="date" type="date" required />
        </div>

        <div class="space-y-2">
          <Label for="account">Conta</Label>
          <Select id="account" v-model="account" :disabled="isCard">
            <option value="">Selecione</option>
            <option
              v-for="item in accountsStore.items.filter((a) => a.type !== 'cartao_credito')"
              :key="item.id"
              :value="item.id"
            >
              {{ item.name }}
            </option>
          </Select>
        </div>

        <div v-if="type === 'despesa'" class="space-y-2">
          <Label for="card">Cartão de crédito (opcional)</Label>
          <Select id="card" v-model="creditCard">
            <option value="">Sem cartão</option>
            <option v-for="item in cardsStore.cards" :key="item.id" :value="item.id">
              {{ item.bank ? `${item.bank} · ` : "" }}•••• {{ item.closing_day }}/{{ item.due_day }}
            </option>
          </Select>
        </div>

        <div v-if="isCard" class="space-y-2">
          <Label for="installments">Parcelas</Label>
          <Select id="installments" v-model.number="installments">
            <option v-for="n in 12" :key="n" :value="n">1x {{ n }}</option>
          </Select>
        </div>

        <div class="space-y-2">
          <Label for="attribution">Atribuição</Label>
          <Select id="attribution" v-model="attribution">
            <option value="meu">Eu</option>
            <option value="dela">Ela</option>
            <option value="ambos">Ambos</option>
            <option value="indefinido">Indefinido</option>
          </Select>
        </div>

        <div class="space-y-2">
          <Label for="category">Categoria</Label>
          <Select id="category" v-model="category" :required="type === 'despesa'">
            <option value="">Selecione</option>
            <option v-for="item in filteredCategories" :key="item.id" :value="item.id">
              {{ item.group }} · {{ item.name }}
            </option>
          </Select>
        </div>

        <div v-if="!isCard" class="space-y-2">
          <Label for="status">Status</Label>
          <Select id="status" v-model="status">
            <option value="pago">Pago</option>
            <option value="a_pagar">A pagar</option>
          </Select>
        </div>

        <p v-if="isCard && card" class="text-xs text-muted-foreground">
          Compra entra na fatura conforme o fechamento (dia {{ card.closing_day }}), com
          {{ installments }}x.
        </p>

        <p class="text-xs text-muted-foreground">
          Prévia: {{ formatBRL(parseAmountInput(amount) ?? 0) }}
        </p>

        <div class="flex justify-end gap-2">
          <Button variant="ghost" type="button" @click="router.back()">Cancelar</Button>
          <Button type="submit" :loading="saving" @click="submit">Salvar</Button>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
