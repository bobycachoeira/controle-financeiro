<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import type { AccountType } from "@cf/shared";
import { ACCOUNT_TYPES, computeAccountBalance } from "@cf/shared";
import { Pencil, Plus, Trash2, Wallet, ChevronDown, ChevronUp } from "lucide-vue-next";
import { useAccountsStore } from "@/stores/accounts";
import { useTransactionsStore } from "@/stores/transactions";
import { useSyncStore } from "@/stores/sync";
import { usePeopleStore } from "@/stores/people";
import { useToast } from "@/composables/useToast";
import { formatBRL, parseAmountInput } from "@/lib/format-input";
import { formatCentsToInput } from "@/lib/format";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import CardContent from "@/components/ui/CardContent.vue";
import Input from "@/components/ui/Input.vue";
import Label from "@/components/ui/Label.vue";
import Select from "@/components/ui/Select.vue";
import Modal from "@/components/ui/Modal.vue";
import IconChip from "@/components/ui/IconChip.vue";
import IconColorField from "@/components/ui/IconColorField.vue";
import { accountIconName } from "@/lib/icons";
import type { LocalAccount } from "@/db/schema";

const accountsStore = useAccountsStore();
const transactionsStore = useTransactionsStore();
const sync = useSyncStore();
const people = usePeopleStore();
const toast = useToast();

const open = ref(false);
const editingId = ref<string | null>(null);
const name = ref("");
const type = ref<AccountType>("corrente");
const initial = ref("");
const icon = ref<string | null>(null);
const color = ref<string | null>(null);
const owner = ref("indefinido");
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
  accountsStore.items
    // A conta interna do cartão é gerida na aba Cartões; aqui só contas reais.
    .filter((account) => account.type !== "cartao_credito")
    .map((account) => ({
      account,
      balance: computeAccountBalance(account, transactionsStore.items),
    })),
);

async function loadAll(): Promise<void> {
  await Promise.all([accountsStore.load(), transactionsStore.load(), people.load()]);
}

function openCreate(): void {
  editingId.value = null;
  name.value = "";
  type.value = "corrente";
  initial.value = "";
  icon.value = null;
  color.value = null;
  owner.value = "indefinido";
  open.value = true;
}

function openEdit(account: LocalAccount): void {
  editingId.value = account.id;
  name.value = account.name;
  type.value = account.type;
  initial.value = formatCentsToInput(account.initial_balance_cents);
  icon.value = account.icon ?? accountIconName(account.type);
  color.value = account.color ?? null;
  owner.value = account.owner ?? "indefinido";
  open.value = true;
}

async function submit(): Promise<void> {
  const cents = initial.value ? parseAmountInput(initial.value) : 0;
  if (cents === null) {
    toast.error("Valor inicial inválido.");
    return;
  }
  saving.value = true;
  try {
    const payload = {
      name: name.value,
      type: type.value,
      initial_balance_cents: cents,
      icon: icon.value,
      color: color.value,
      owner: owner.value,
    };
    if (editingId.value) {
      await accountsStore.update(editingId.value, payload);
      toast.success("Conta atualizada.");
    } else {
      await accountsStore.create(payload);
      toast.success("Conta criada.");
    }
    open.value = false;
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Falha ao salvar conta.");
  } finally {
    saving.value = false;
  }
}

async function remove(account: LocalAccount): Promise<void> {
  await accountsStore.remove(account.id);
  toast.info("Conta removida.");
}

onMounted(loadAll);
watch(() => sync.dataVersion, loadAll);
</script>

<template>
  <div class="space-y-5">
    <div class="flex items-end justify-between gap-3">
      <div>
        <p class="text-xs font-extrabold uppercase tracking-wider text-primary">Carteira</p>
        <h1 class="font-display text-3xl font-black tracking-tight">Contas</h1>
      </div>
      <Button size="sm" @click="openCreate"><Plus class="h-4 w-4" /> Nova</Button>
    </div>

    <Card>
      <CardContent class="p-2">
        <p
          v-if="balances.length === 0"
          class="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-muted-foreground"
        >
          <Wallet class="h-8 w-8 text-muted-foreground/50" />
          Nenhuma conta ainda. Crie a primeira.
        </p>
        <ul v-else class="stagger">
          <li
            v-for="(row, rowIndex) in balances"
            :key="row.account.id"
            class="group flex items-center gap-3 rounded-[1.3rem] px-3 py-3 transition hover:bg-muted/70"
          >
            <IconChip
              :name="row.account.icon ?? accountIconName(row.account.type)"
              :color="row.account.color"
              :seed="row.account.name"
            />
            <button class="min-w-0 flex-1 text-left" @click="openEdit(row.account)">
              <p class="truncate font-bold">{{ row.account.name }}</p>
              <p class="truncate text-xs font-semibold text-muted-foreground">
                {{ typeLabels[row.account.type] }}
                <template v-if="row.account.owner && row.account.owner !== 'indefinido'">
                  · {{ people.label(row.account.owner) }}
                </template>
              </p>
            </button>
            <span
              class="whitespace-nowrap font-display text-lg font-bold"
              :class="row.balance < 0 ? 'text-destructive' : 'text-foreground'"
            >
              {{ formatBRL(row.balance) }}
            </span>
            <div class="grid grid-cols-2 gap-1 opacity-100 transition md:opacity-0 md:group-hover:opacity-100">
              <button
                class="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:bg-card hover:text-primary disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                aria-label="Mover conta para cima"
                :disabled="rowIndex === 0"
                @click="accountsStore.move(row.account.id, -1)"
              >
                <ChevronUp class="h-3.5 w-3.5" />
              </button>
              <button
                class="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:bg-card hover:text-primary disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                aria-label="Mover conta para baixo"
                :disabled="rowIndex === balances.length - 1"
                @click="accountsStore.move(row.account.id, 1)"
              >
                <ChevronDown class="h-3.5 w-3.5" />
              </button>
              <button
                class="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:bg-card hover:text-primary"
                aria-label="Editar conta"
                @click="openEdit(row.account)"
              >
                <Pencil class="h-3.5 w-3.5" />
              </button>
              <button
                class="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:bg-card hover:text-destructive"
                aria-label="Excluir conta"
                @click="remove(row.account)"
              >
                <Trash2 class="h-3.5 w-3.5" />
              </button>
            </div>
          </li>
        </ul>
      </CardContent>
    </Card>

    <Modal v-model="open" :title="editingId ? 'Editar conta' : 'Nova conta'">
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
        <div class="space-y-2">
          <Label for="account-owner">Titular (quem paga/recebe)</Label>
          <Select id="account-owner" v-model="owner">
            <option v-for="option in people.selectable" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </Select>
        </div>
        <div class="space-y-2">
          <Label>Ícone e cor</Label>
          <IconColorField v-model:icon="icon" v-model:color="color" :name="name" />
        </div>
        <div class="flex justify-end gap-2 pt-1">
          <Button variant="ghost" type="button" @click="open = false">Cancelar</Button>
          <Button type="submit" :loading="saving">Salvar</Button>
        </div>
      </form>
    </Modal>
  </div>
</template>
