<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { todayISO } from "@cf/shared";
import { ArrowLeft, CreditCard } from "lucide-vue-next";
import { db, type LocalCategory } from "@/db/schema";
import { useTransactionsStore } from "@/stores/transactions";
import { useAccountsStore } from "@/stores/accounts";
import { useCardsStore } from "@/stores/cards";
import { useSessionStore } from "@/stores/session";
import { usePeopleStore } from "@/stores/people";
import { useToast } from "@/composables/useToast";
import { parseAmountInput } from "@/lib/format-input";
import { formatBRL, formatCentsToInput } from "@/lib/format";
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
const people = usePeopleStore();
const route = useRoute();
const router = useRouter();
const toast = useToast();

const isEdit = computed(() => Boolean(route.params.id));
const amount = ref("");
const type = ref<"receita" | "despesa">("despesa");
const description = ref("");
const date = ref(todayISO());
const account = ref("");
const creditCard = ref("");
const attribution = ref("indefinido");
const status = ref<"pago" | "a_pagar">("pago");
const category = ref("");
const installments = ref(1);
const saving = ref(false);
const categories = ref<LocalCategory[]>([]);

const isCard = computed(() => creditCard.value !== "");
const card = computed(() => cardsStore.cards.find((item) => item.id === creditCard.value));

const filteredCategories = computed(() =>
  categories.value.filter(
    (item) => item.kind === (type.value === "receita" ? "entrada" : "saida") || item.kind === "ambos",
  ),
);

const accountOwner = computed<string>(() => {
  const accountId = isCard.value && card.value ? card.value.account : account.value;
  return accountsStore.items.find((item) => item.id === accountId)?.owner ?? "indefinido";
});

watch([account, creditCard], () => {
  if (!isEdit.value && accountOwner.value && accountOwner.value !== "indefinido") {
    attribution.value = accountOwner.value;
  }
});

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
    if (isEdit.value) {
      await transactionsStore.update(String(route.params.id), {
        account: account.value,
        amount_cents: cents,
        type: type.value,
        date: date.value,
        attribution: attribution.value,
        category: category.value || null,
        description: description.value,
        status: status.value,
      });
      toast.success("Lançamento atualizado.");
    } else if (isCard.value && card.value) {
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
  await Promise.all([accountsStore.load(), cardsStore.load(), loadCategories(), people.load()]);
  account.value = accountsStore.items.find((item) => item.type !== "cartao_credito")?.id ?? "";
  if (isEdit.value) {
    const tx = await db.transactions.get(String(route.params.id));
    if (tx) {
      amount.value = formatCentsToInput(tx.amount_cents);
      type.value = tx.type === "receita" ? "receita" : "despesa";
      description.value = tx.description;
      date.value = tx.date.slice(0, 10);
      account.value = tx.account;
      attribution.value = tx.attribution;
      status.value = tx.status;
      category.value = tx.category ?? "";
    }
  }
});
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
      <div>
        <p class="text-xs font-extrabold uppercase tracking-wider text-primary">
          {{ isEdit ? "Edição" : "Novo" }}
        </p>
        <h1 class="font-display text-2xl font-black tracking-tight">
          {{ isEdit ? "Editar lançamento" : "Novo lançamento" }}
        </h1>
      </div>
    </div>

    <Card class="overflow-hidden">
      <div class="bg-secondary/60 px-5 py-6 text-center">
        <Label for="amount" class="text-secondary-foreground/70">Valor</Label>
        <div class="mt-1 flex items-baseline justify-center gap-1 font-display">
          <span class="text-2xl font-bold text-muted-foreground">R$</span>
          <input
            id="amount"
            v-model="amount"
            inputmode="decimal"
            placeholder="0,00"
            class="w-40 bg-transparent text-center font-display text-4xl font-black tracking-tight outline-none placeholder:text-muted-foreground/40"
            autofocus
          />
        </div>
        <p class="mt-1 text-xs font-bold text-muted-foreground">
          {{ formatBRL(parseAmountInput(amount) ?? 0) }}
        </p>
      </div>

      <CardContent class="space-y-5 pt-5">
        <div class="grid grid-cols-2 gap-2 rounded-full bg-muted p-1">
          <button
            type="button"
            class="rounded-full py-2 text-sm font-extrabold transition"
            :class="type === 'despesa' ? 'bg-primary text-primary-foreground shadow-lift' : 'text-muted-foreground'"
            @click="type = 'despesa'"
          >
            Despesa
          </button>
          <button
            type="button"
            class="rounded-full py-2 text-sm font-extrabold transition"
            :class="type === 'receita' ? 'bg-leaf text-white shadow-lift' : 'text-muted-foreground'"
            @click="type = 'receita'"
          >
            Receita
          </button>
        </div>

        <div class="space-y-2">
          <Label for="description">Descrição</Label>
          <Input id="description" v-model="description" maxlength="200" placeholder="Ex.: Mercado da semana" />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-2">
            <Label for="date">Data</Label>
            <Input id="date" v-model="date" type="date" required />
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

        <div v-if="!isEdit && type === 'despesa'" class="space-y-2">
          <Label for="card" class="flex items-center gap-1">
            <CreditCard class="h-3.5 w-3.5" /> Cartão de crédito
          </Label>
          <Select id="card" v-model="creditCard">
            <option value="">Sem cartão</option>
            <option v-for="item in cardsStore.cards" :key="item.id" :value="item.id">
              {{ item.bank || "Cartão" }} •••• {{ item.closing_day }}/{{ item.due_day }}
            </option>
          </Select>
        </div>

        <div v-if="isCard && !isEdit" class="space-y-2">
          <Label for="installments">Parcelas</Label>
          <Select id="installments" v-model.number="installments">
            <option v-for="n in 12" :key="n" :value="n">{{ n }}x</option>
          </Select>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-2">
            <Label for="attribution">Atribuição</Label>
            <Select id="attribution" v-model="attribution">
              <option v-for="option in people.selectable" :key="option.value" :value="option.value">
                {{ option.label }}
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
        </div>

        <p v-if="isCard && card && !isEdit" class="rounded-2xl bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground">
          Cai na fatura pelo fechamento (dia {{ card.closing_day }}), em {{ installments }}x.
        </p>

        <div class="flex justify-end gap-2 pt-1">
          <Button variant="ghost" type="button" @click="router.back()">Cancelar</Button>
          <Button type="submit" :loading="saving" @click="submit">
            {{ isEdit ? "Salvar alterações" : "Salvar" }}
          </Button>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
