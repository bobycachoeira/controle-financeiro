<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { LineChart, PiggyBank, Plus, TrendingUp } from "lucide-vue-next";
import { accountBalanceEvolution, computeAccountBalance, monthOf, todayISO } from "@cf/shared";
import type { AccountLike } from "@cf/shared";
import { db, type LocalAccount, type LocalCategory } from "@/db/schema";
import { useAccountsStore } from "@/stores/accounts";
import { usePeopleStore } from "@/stores/people";
import { useSessionStore } from "@/stores/session";
import { useSyncStore } from "@/stores/sync";
import { useTransactionsStore } from "@/stores/transactions";
import { useTransfersStore } from "@/stores/transfers";
import { useToast } from "@/composables/useToast";
import { parseAmountInput } from "@/lib/format-input";
import { formatBRL } from "@/lib/format";
import AreaChart from "@/components/charts/AreaChart.vue";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import CardContent from "@/components/ui/CardContent.vue";
import Input from "@/components/ui/Input.vue";
import Label from "@/components/ui/Label.vue";
import Select from "@/components/ui/Select.vue";
import Modal from "@/components/ui/Modal.vue";

const accountsStore = useAccountsStore();
const people = usePeopleStore();
const transactionsStore = useTransactionsStore();
const transfersStore = useTransfersStore();
const session = useSessionStore();
const sync = useSyncStore();
const toast = useToast();

const month = todayISO().slice(0, 7);
const categories = ref<LocalCategory[]>([]);

const investments = computed(() =>
  accountsStore.items.filter((account) => account.type === "investimento"),
);

const sourceAccounts = computed(() =>
  accountsStore.items.filter(
    (account) => account.type !== "cartao_credito" && account.type !== "investimento",
  ),
);

const newOpen = ref(false);
const newName = ref("");
const newInitial = ref("");
const newOwner = ref("indefinido");
const savingNew = ref(false);

const aporteOpen = ref(false);
const aporteAccount = ref<LocalAccount | null>(null);
const aporteSource = ref("");
const aporteAmount = ref("");
const aporteDate = ref(todayISO());
const savingAporte = ref(false);

const yieldOpen = ref(false);
const yieldAccount = ref<LocalAccount | null>(null);
const yieldAmount = ref("");
const yieldNote = ref("");
const yieldDate = ref(todayISO());
const savingYield = ref(false);

function balanceOf(account: LocalAccount): number {
  return computeAccountBalance(
    account as AccountLike,
    transactionsStore.items as unknown as Parameters<typeof computeAccountBalance>[1],
  );
}

function chartFor(account: LocalAccount): { label: string; value: number }[] {
  return accountBalanceEvolution(
    account as AccountLike & { id: string },
    transactionsStore.items,
    month,
    6,
  ).map((point) => ({ label: point.label, value: point.balanceCents }));
}

function monthStats(account: LocalAccount): { contributions: number; yields: number } {
  const list = transactionsStore.items.filter(
    (tx) => !tx.deleted_at && tx.account === account.id && monthOf(tx.date) === month,
  );
  return {
    contributions: list
      .filter((tx) => tx.type === "transferencia" && tx.amount_cents > 0)
      .reduce((sum, tx) => sum + tx.amount_cents, 0),
    yields: list.filter((tx) => tx.type === "receita").reduce((sum, tx) => sum + tx.amount_cents, 0),
  };
}

function openNew(): void {
  newName.value = "";
  newInitial.value = "";
  newOwner.value = "indefinido";
  newOpen.value = true;
}

async function createInvestment(): Promise<void> {
  if (!newName.value.trim()) {
    toast.error("Informe um nome.");
    return;
  }
  const cents = newInitial.value ? parseAmountInput(newInitial.value) : 0;
  if (cents === null) {
    toast.error("Valor inicial inválido.");
    return;
  }
  savingNew.value = true;
  try {
    await accountsStore.create({
      name: newName.value.trim(),
      type: "investimento",
      initial_balance_cents: cents,
      owner: newOwner.value,
    });
    toast.success("Investimento criado.");
    newOpen.value = false;
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Falha ao criar.");
  } finally {
    savingNew.value = false;
  }
}

function openAporte(account: LocalAccount): void {
  aporteAccount.value = account;
  aporteSource.value = sourceAccounts.value[0]?.id ?? "";
  aporteAmount.value = "";
  aporteDate.value = todayISO();
  aporteOpen.value = true;
}

async function submitAporte(): Promise<void> {
  const account = aporteAccount.value;
  const cents = parseAmountInput(aporteAmount.value);
  if (!account || cents === null || cents <= 0 || !aporteSource.value) {
    toast.error("Informe a conta de origem e o valor.");
    return;
  }
  savingAporte.value = true;
  try {
    await transfersStore.create({
      source_account: aporteSource.value,
      destination_account: account.id,
      amount_cents: cents,
      date: aporteDate.value,
      description: `Aporte · ${account.name}`,
    });
    toast.success("Aporte registrado.");
    aporteOpen.value = false;
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Falha no aporte.");
  } finally {
    savingAporte.value = false;
  }
}

function openYield(account: LocalAccount): void {
  yieldAccount.value = account;
  yieldAmount.value = "";
  yieldNote.value = "";
  yieldDate.value = todayISO();
  yieldOpen.value = true;
}

async function submitYield(): Promise<void> {
  const account = yieldAccount.value;
  const cents = parseAmountInput(yieldAmount.value);
  if (!account || cents === null || cents <= 0) {
    toast.error("Informe um valor válido.");
    return;
  }
  savingYield.value = true;
  try {
    const rendimentos = categories.value.find((category) => category.name === "Rendimentos");
    await transactionsStore.create({
      account: account.id,
      credit_card: null,
      amount_cents: cents,
      type: "receita",
      date: yieldDate.value,
      attribution: account.owner && account.owner !== "indefinido" ? account.owner : "ambos",
      category: rendimentos?.id ?? null,
      description: yieldNote.value.trim() || "Rendimento",
      status: "pago",
    });
    toast.success("Rendimento registrado.");
    yieldOpen.value = false;
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Falha ao registrar.");
  } finally {
    savingYield.value = false;
  }
}

async function loadAll(): Promise<void> {
  await Promise.all([
    accountsStore.load(),
    transactionsStore.load(),
    transfersStore.load(),
    people.load(),
  ]);
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
    <div class="flex items-end justify-between gap-3">
      <div>
        <p class="text-xs font-extrabold uppercase tracking-wider text-primary">Patrimônio</p>
        <h1 class="font-display text-3xl font-black tracking-tight">Investimentos</h1>
      </div>
      <Button size="sm" @click="openNew"><Plus class="h-4 w-4" /> Novo</Button>
    </div>

    <p
      v-if="investments.length === 0"
      class="flex flex-col items-center gap-2 rounded-[1.6rem] border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground"
    >
      <LineChart class="h-8 w-8 text-muted-foreground/50" />
      Nenhum investimento ainda. Crie uma conta de investimento para acompanhar aportes e rendimentos.
    </p>

    <div class="stagger space-y-4">
      <Card v-for="account in investments" :key="account.id" data-testid="investment">
        <CardContent class="space-y-3 p-4">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="truncate font-display text-lg font-bold">{{ account.name }}</p>
              <p class="text-xs font-semibold text-muted-foreground">
                <template v-if="account.owner && account.owner !== 'indefinido'">
                  {{ people.label(account.owner) }} · investimento
                </template>
                <template v-else>Investimento</template>
              </p>
            </div>
            <p class="font-display text-xl font-black">{{ formatBRL(balanceOf(account)) }}</p>
          </div>

          <div class="grid grid-cols-2 gap-2 text-center">
            <div class="rounded-2xl bg-muted/60 p-2">
              <p class="text-[0.6rem] font-extrabold uppercase tracking-wider text-muted-foreground">
                Aportes no mês
              </p>
              <p class="font-display text-sm font-bold">{{ formatBRL(monthStats(account).contributions) }}</p>
            </div>
            <div class="rounded-2xl bg-muted/60 p-2">
              <p class="text-[0.6rem] font-extrabold uppercase tracking-wider text-muted-foreground">
                Rendimentos no mês
              </p>
              <p class="font-display text-sm font-bold text-leaf">
                {{ formatBRL(monthStats(account).yields) }}
              </p>
            </div>
          </div>

          <AreaChart :points="chartFor(account)" color="#3B82B6" />

          <div class="flex flex-wrap gap-2">
            <Button size="sm" @click="openAporte(account)">
              <PiggyBank class="h-3.5 w-3.5" /> Aportar
            </Button>
            <Button size="sm" variant="outline" @click="openYield(account)">
              <TrendingUp class="h-3.5 w-3.5" /> Rendimento
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>

    <Modal v-model="newOpen" title="Novo investimento">
      <form class="space-y-4" @submit.prevent="createInvestment">
        <div class="space-y-2">
          <Label for="inv-name">Nome</Label>
          <Input id="inv-name" v-model="newName" required maxlength="80" placeholder="Ex.: Tesouro / CDB" />
        </div>
        <div class="space-y-2">
          <Label for="inv-initial">Valor atual (R$)</Label>
          <Input id="inv-initial" v-model="newInitial" inputmode="decimal" placeholder="0,00" />
        </div>
        <div class="space-y-2">
          <Label for="inv-owner">De quem é</Label>
          <Select id="inv-owner" v-model="newOwner">
            <option v-for="option in people.selectable" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </Select>
        </div>
        <div class="flex justify-end gap-2 pt-1">
          <Button variant="ghost" type="button" @click="newOpen = false">Cancelar</Button>
          <Button type="submit" :loading="savingNew">Salvar</Button>
        </div>
      </form>
    </Modal>

    <Modal v-model="aporteOpen" title="Aportar" :description="aporteAccount?.name ?? ''">
      <form class="space-y-4" @submit.prevent="submitAporte">
        <div class="space-y-2">
          <Label for="aporte-source">Sai da conta</Label>
          <Select id="aporte-source" v-model="aporteSource" required>
            <option value="">Selecione</option>
            <option v-for="account in sourceAccounts" :key="account.id" :value="account.id">
              {{ account.name }}
            </option>
          </Select>
        </div>
        <div class="space-y-2">
          <Label for="aporte-amount">Valor (R$)</Label>
          <Input id="aporte-amount" v-model="aporteAmount" inputmode="decimal" required />
        </div>
        <div class="space-y-2">
          <Label for="aporte-date">Data</Label>
          <Input id="aporte-date" v-model="aporteDate" type="date" />
        </div>
        <div class="flex justify-end gap-2 pt-1">
          <Button variant="ghost" type="button" @click="aporteOpen = false">Cancelar</Button>
          <Button type="submit" :loading="savingAporte">Aportar</Button>
        </div>
      </form>
    </Modal>

    <Modal v-model="yieldOpen" title="Registrar rendimento" :description="yieldAccount?.name ?? ''">
      <form class="space-y-4" @submit.prevent="submitYield">
        <div class="space-y-2">
          <Label for="yield-amount">Valor (R$)</Label>
          <Input id="yield-amount" v-model="yieldAmount" inputmode="decimal" required />
        </div>
        <div class="space-y-2">
          <Label for="yield-date">Data</Label>
          <Input id="yield-date" v-model="yieldDate" type="date" />
        </div>
        <div class="space-y-2">
          <Label for="yield-note">Descrição (opcional)</Label>
          <Input id="yield-note" v-model="yieldNote" maxlength="200" placeholder="Ex.: CDB outubro" />
        </div>
        <div class="flex justify-end gap-2 pt-1">
          <Button variant="ghost" type="button" @click="yieldOpen = false">Cancelar</Button>
          <Button type="submit" :loading="savingYield">Registrar</Button>
        </div>
      </form>
    </Modal>
  </div>
</template>
