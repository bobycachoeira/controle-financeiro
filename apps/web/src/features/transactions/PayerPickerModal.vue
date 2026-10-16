<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { AccountType } from "@cf/shared";
import { Check, CreditCard, Search, Wallet } from "lucide-vue-next";
import type { LocalAccount, LocalCreditCard } from "@/db/schema";
import Modal from "@/components/ui/Modal.vue";
import Input from "@/components/ui/Input.vue";

const props = defineProps<{
  modelValue: boolean;
  accounts: LocalAccount[];
  cards: LocalCreditCard[];
  selectedAccount: string;
  selectedCard: string;
}>();
const emit = defineEmits<{
  "update:modelValue": [boolean];
  pick: [{ kind: "account" | "card"; id: string }];
}>();

const TYPE_LABELS: Record<AccountType, string> = {
  corrente: "Conta corrente",
  poupanca: "Poupança",
  carteira: "Carteira",
  cartao_credito: "Cartão de crédito",
  investimento: "Investimento",
  outros: "Outros",
};

const query = ref("");

watch(
  () => props.modelValue,
  (open) => {
    if (open) query.value = "";
  },
);

const showSearch = computed(() => props.accounts.length + props.cards.length > 6);

const filteredAccounts = computed(() => matches(props.accounts));
const filteredCards = computed(() => matches(props.cards));

function matches<T extends { name?: string | null; bank?: string | null }>(list: T[]): T[] {
  const term = query.value.trim().toLowerCase();
  if (!term) return list;
  return list.filter((item) => (item.name ?? item.bank ?? "").toLowerCase().includes(term));
}

function pick(kind: "account" | "card", id: string): void {
  emit("pick", { kind, id });
  emit("update:modelValue", false);
}
</script>

<template>
  <Modal
    :model-value="modelValue"
    title="Pagar com"
    description="Escolha a conta ou o cartão"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div data-testid="payer-picker" class="space-y-4">
      <div v-if="showSearch" class="relative">
        <Search
          class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input v-model="query" class="pl-9" placeholder="Buscar conta ou cartão…" />
      </div>

      <div v-if="filteredAccounts.length > 0" class="space-y-1">
        <p class="px-1 text-[0.62rem] font-extrabold uppercase tracking-wide text-muted-foreground">
          Contas
        </p>
        <ul class="divide-y">
          <li v-for="item in filteredAccounts" :key="item.id">
            <button
              type="button"
              class="flex min-h-11 w-full items-center gap-3 px-1 text-left"
              @click="pick('account', item.id)"
            >
              <span
                class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"
              >
                <Wallet class="h-4 w-4" aria-hidden="true" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate font-bold">{{ item.name }}</span>
                <span class="block truncate text-xs text-muted-foreground">
                  {{ TYPE_LABELS[item.type] }}
                </span>
              </span>
              <Check
                v-if="!selectedCard && selectedAccount === item.id"
                class="h-4 w-4 shrink-0 text-primary"
              />
            </button>
          </li>
        </ul>
      </div>

      <div v-if="filteredCards.length > 0" class="space-y-1">
        <p class="px-1 text-[0.62rem] font-extrabold uppercase tracking-wide text-muted-foreground">
          Cartões
        </p>
        <ul class="divide-y">
          <li v-for="item in filteredCards" :key="item.id">
            <button
              type="button"
              class="flex min-h-11 w-full items-center gap-3 px-1 text-left"
              @click="pick('card', item.id)"
            >
              <span
                class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"
              >
                <CreditCard class="h-4 w-4" aria-hidden="true" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate font-bold">{{ item.bank || "Cartão" }}</span>
                <span class="block truncate text-xs text-muted-foreground">
                  fecha dia {{ item.closing_day }} · vence dia {{ item.due_day }}
                </span>
              </span>
              <Check
                v-if="selectedCard === item.id"
                class="h-4 w-4 shrink-0 text-primary"
              />
            </button>
          </li>
        </ul>
      </div>

      <p
        v-if="filteredAccounts.length === 0 && filteredCards.length === 0"
        class="py-4 text-center text-sm text-muted-foreground"
      >
        Nada encontrado.
      </p>
    </div>
  </Modal>
</template>
