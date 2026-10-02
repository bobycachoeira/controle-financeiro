<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import type { AccountType } from "@cf/shared";
import { ACCOUNT_TYPES, computeAccountBalance } from "@cf/shared";
import { useAccountsStore } from "@/stores/accounts";
import { useTransactionsStore } from "@/stores/transactions";
import { useSyncStore } from "@/stores/sync";
import { useToast } from "@/composables/useToast";
import { formatBRL, parseAmountInput } from "@/lib/format-input";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import CardContent from "@/components/ui/CardContent.vue";
import Input from "@/components/ui/Input.vue";
import Label from "@/components/ui/Label.vue";
import Select from "@/components/ui/Select.vue";
import Modal from "@/components/ui/Modal.vue";

const accountsStore = useAccountsStore();
const transactionsStore = useTransactionsStore();
const sync = useSyncStore();
const toast = useToast();

const open = ref(false);
const name = ref("");
const type = ref<AccountType>("corrente");
const initial = ref("");
const saving = ref(false);

const typeLabels: Record<AccountType, string> = {
  corrente: "Conta corrente",
  poupanca: "Poupança",
  carteira: "Carteira",
  cartao_credito: "Cartão de crédito",
  investimento: "Investimento",
  outros: "Outros",
};

const balances = computed(() =>
  accountsStore.items.map((account) => ({
    account,
    balance: computeAccountBalance(account, transactionsStore.items),
  })),
);

async function loadAll(): Promise<void> {
  await Promise.all([accountsStore.load(), transactionsStore.load()]);
}

async function submit(): Promise<void> {
  const cents = parseAmountInput(initial.value);
  if (cents === null) {
    toast.error("Valor inicial inválido.");
    return;
  }
  saving.value = true;
  try {
    await accountsStore.create({ name: name.value, type: type.value, initial_balance_cents: cents });
    toast.success("Conta criada.");
    open.value = false;
    name.value = "";
    initial.value = "";
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Falha ao criar conta.");
  } finally {
    saving.value = false;
  }
}

onMounted(loadAll);
watch(() => sync.dataVersion, loadAll);
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-bold">Contas</h1>
      <Button size="sm" @click="open = true">Nova conta</Button>
    </div>

    <Card>
      <CardContent class="p-0">
        <p v-if="balances.length === 0" class="p-4 text-sm text-muted-foreground">
          Nenhuma conta ainda. Crie a primeira.
        </p>
        <ul v-else class="divide-y">
          <li
            v-for="row in balances"
            :key="row.account.id"
            class="flex items-center justify-between px-4 py-3 text-sm"
          >
            <div>
              <p class="font-medium">{{ row.account.name }}</p>
              <p class="text-xs text-muted-foreground">{{ typeLabels[row.account.type] }}</p>
            </div>
            <span class="font-semibold">{{ formatBRL(row.balance) }}</span>
          </li>
        </ul>
      </CardContent>
    </Card>

    <Modal v-model="open" title="Nova conta">
      <form class="space-y-4" @submit.prevent="submit">
        <div class="space-y-2">
          <Label for="account-name">Nome</Label>
          <Input id="account-name" v-model="name" required maxlength="80" />
        </div>
        <div class="space-y-2">
          <Label for="account-type">Tipo</Label>
          <Select id="account-type" v-model="type">
            <option v-for="option in ACCOUNT_TYPES" :key="option" :value="option">
              {{ typeLabels[option] }}
            </option>
          </Select>
        </div>
        <div class="space-y-2">
          <Label for="account-initial">Saldo inicial (R$)</Label>
          <Input id="account-initial" v-model="initial" inputmode="decimal" placeholder="0,00" />
        </div>
        <div class="flex justify-end gap-2">
          <Button variant="ghost" type="button" @click="open = false">Cancelar</Button>
          <Button type="submit" :loading="saving">Criar</Button>
        </div>
      </form>
    </Modal>
  </div>
</template>
