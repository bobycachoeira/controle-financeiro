<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { RouterLink } from "vue-router";
import { ArrowRightLeft, HandCoins, Users } from "lucide-vue-next";
import {
  SETTLEMENT_TRANSFER_PREFIX,
  computeSettlement,
  monthOf,
  todayISO,
  type SettlementSuggestion,
} from "@cf/shared";
import { useAccountsStore } from "@/stores/accounts";
import { usePeopleStore } from "@/stores/people";
import { useSyncStore } from "@/stores/sync";
import { useTransactionsStore } from "@/stores/transactions";
import { useTransfersStore } from "@/stores/transfers";
import { useToast } from "@/composables/useToast";
import { formatBRL, parseAmountInput } from "@/lib/format-input";
import { formatCentsToInput, formatMonth } from "@/lib/format";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import CardContent from "@/components/ui/CardContent.vue";
import CardHeader from "@/components/ui/CardHeader.vue";
import CardTitle from "@/components/ui/CardTitle.vue";
import Input from "@/components/ui/Input.vue";
import Label from "@/components/ui/Label.vue";
import Modal from "@/components/ui/Modal.vue";
import Select from "@/components/ui/Select.vue";

const people = usePeopleStore();
const accountsStore = useAccountsStore();
const transactionsStore = useTransactionsStore();
const transfersStore = useTransfersStore();
const sync = useSyncStore();
const toast = useToast();

const month = ref(todayISO().slice(0, 7));
type SuggestionWithLabels = SettlementSuggestion & { fromLabel: string; toLabel: string };
const payOpen = ref(false);
const activeSuggestion = ref<SuggestionWithLabels | null>(null);
const sourceAccount = ref("");
const destinationAccount = ref("");
const amountInput = ref("");
const registering = ref(false);

const realAccounts = computed(() =>
  accountsStore.items.filter((account) => account.type !== "cartao_credito"),
);

const settlement = computed(() => {
  const ownerByAccount = new Map(
    accountsStore.items.map((account) => [account.id, account.owner ?? "indefinido"]),
  );
  return computeSettlement({
    people: people.options.map((option) => ({ key: option.key, label: option.label })),
    legacyMap: { meu: 0, dela: 1 },
    month: month.value,
    transactions: transactionsStore.items,
    transfers: transfersStore.items.map((transfer) => ({
      amount_cents: transfer.amount_cents,
      date: transfer.date,
      description: transfer.description,
      source_owner: ownerByAccount.get(transfer.source_account) ?? null,
      destination_owner: ownerByAccount.get(transfer.destination_account) ?? null,
      deleted_at: transfer.deleted_at,
    })),
  });
});

const suggestions = computed(() => {
  const labelByKey = new Map(settlement.value.people.map((person) => [person.key, person.label]));
  return settlement.value.suggestions.map((suggestion) => ({
    ...suggestion,
    fromLabel: labelByKey.get(suggestion.fromKey) ?? suggestion.fromKey,
    toLabel: labelByKey.get(suggestion.toKey) ?? suggestion.toKey,
  }));
});

const settlements = computed(() =>
  transfersStore.items.filter(
    (transfer) =>
      !transfer.deleted_at &&
      monthOf(transfer.date) === month.value &&
      (transfer.description ?? "").startsWith(SETTLEMENT_TRANSFER_PREFIX),
  ),
);

const monthLabel = computed(() => formatMonth(month.value));
const isDividir = computed(() => people.splitMode === "dividir");

function accountFor(personKey: string): string {
  const owned = realAccounts.value.find((account) => account.owner === personKey);
  return owned?.id ?? realAccounts.value[0]?.id ?? "";
}

function openRegister(suggestion: SuggestionWithLabels): void {
  activeSuggestion.value = suggestion;
  sourceAccount.value = accountFor(suggestion.fromKey);
  destinationAccount.value = accountFor(suggestion.toKey);
  amountInput.value = formatCentsToInput(suggestion.amountCents);
  payOpen.value = true;
}

async function register(): Promise<void> {
  const cents = parseAmountInput(amountInput.value);
  if (cents === null || cents <= 0 || !sourceAccount.value || !destinationAccount.value) {
    toast.error("Informe valor e contas.");
    return;
  }
  registering.value = true;
  try {
    await transfersStore.create({
      source_account: sourceAccount.value,
      destination_account: destinationAccount.value,
      amount_cents: cents,
      date: todayISO(),
      description: `${SETTLEMENT_TRANSFER_PREFIX} ${month.value}`,
    });
    toast.success("Acerto registrado.");
    payOpen.value = false;
    await Promise.all([transfersStore.load(), accountsStore.load()]);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Falha ao registrar.");
  } finally {
    registering.value = false;
  }
}

async function loadAll(): Promise<void> {
  await Promise.all([
    people.load(),
    accountsStore.load(),
    transactionsStore.load(),
    transfersStore.load(),
  ]);
}

onMounted(loadAll);
watch(() => sync.dataVersion, loadAll);
</script>

<template>
  <div class="space-y-5">
    <div class="flex items-end justify-between gap-3">
      <div>
        <p class="text-xs font-extrabold uppercase tracking-wider text-primary">Casal</p>
        <h1 class="font-display text-3xl font-black tracking-tight">Acerto do mês</h1>
      </div>
      <Input v-model="month" type="month" class="w-40" aria-label="Mês do acerto" />
    </div>

    <Card v-if="!isDividir">
      <CardHeader>
        <CardTitle>Vocês estão no modo “tudo junto”</CardTitle>
      </CardHeader>
      <CardContent class="space-y-3 text-sm text-muted-foreground">
        <p>
          O dinheiro é dos dois — não há cobrança entre vocês. Abaixo está quanto cada um
          contribuiu (pagou) em {{ monthLabel }}.
        </p>
        <ul class="space-y-1">
          <li v-for="person in settlement.people" :key="person.key" class="flex items-center justify-between">
            <span class="font-bold text-foreground">{{ person.label }}</span>
            <span>pagou {{ formatBRL(person.paidCents) }}</span>
          </li>
        </ul>
        <RouterLink
          :to="{ name: 'family' }"
          class="inline-flex items-center gap-2 text-xs font-bold text-primary"
        >
          <Users class="h-3.5 w-3.5" /> Mudar para “dividir e acertar”
        </RouterLink>
      </CardContent>
    </Card>

    <template v-else>
      <Card>
        <CardHeader><CardTitle>Como está {{ monthLabel }}</CardTitle></CardHeader>
        <CardContent class="space-y-3">
          <div
            v-for="person in settlement.people"
            :key="person.key"
            class="flex items-center justify-between rounded-2xl bg-muted/60 px-4 py-3 text-sm"
          >
            <div>
              <p class="font-bold">{{ person.label }}</p>
              <p class="text-xs text-muted-foreground">
                pagou {{ formatBRL(person.paidCents) }} · parte {{ formatBRL(person.shareCents) }}
              </p>
            </div>
            <span
              class="font-display font-bold"
              :class="person.netCents > 0 ? 'text-leaf' : person.netCents < 0 ? 'text-destructive' : ''"
            >
              {{ person.netCents > 0 ? "a receber" : person.netCents < 0 ? "a pagar" : "em dia" }}
              <template v-if="person.netCents !== 0"> {{ formatBRL(Math.abs(person.netCents)) }}</template>
            </span>
          </div>
          <p v-if="settlement.ignoredCents > 0" class="text-xs text-muted-foreground">
            {{ formatBRL(settlement.ignoredCents) }} em despesas sem pagador identificado ficaram
            fora do acerto.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Transferências sugeridas</CardTitle></CardHeader>
        <CardContent class="space-y-3">
          <p v-if="suggestions.length === 0" class="text-sm text-muted-foreground">
            Tudo acertado neste mês.
          </p>
          <div
            v-for="suggestion in suggestions"
            :key="`${suggestion.fromKey}-${suggestion.toKey}`"
            data-testid="settle-suggestion"
            class="flex items-center justify-between gap-3 rounded-2xl border-2 border-border px-4 py-3"
          >
            <div class="min-w-0">
              <p class="flex items-center gap-2 font-bold">
                {{ suggestion.fromLabel }}
                <ArrowRightLeft class="h-3.5 w-3.5 text-muted-foreground" />
                {{ suggestion.toLabel }}
              </p>
              <p class="font-display text-lg font-bold">{{ formatBRL(suggestion.amountCents) }}</p>
            </div>
            <Button size="sm" @click="openRegister(suggestion)">
              <HandCoins class="h-3.5 w-3.5" /> Registrar
            </Button>
          </div>

          <div v-if="settlements.length > 0" class="border-t border-border/60 pt-3">
            <p class="pb-2 text-[0.62rem] font-extrabold uppercase tracking-wider text-muted-foreground">
              Acertos registrados
            </p>
            <ul class="space-y-1 text-xs text-muted-foreground">
              <li v-for="transfer in settlements" :key="transfer.id" class="flex justify-between">
                <span>{{ transfer.description }}</span>
                <span>{{ formatBRL(transfer.amount_cents) }}</span>
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </template>

    <Modal v-model="payOpen" title="Registrar acerto" description="Cria a transferência entre as contas escolhidas.">
      <form class="space-y-4" @submit.prevent="register">
        <p v-if="activeSuggestion" class="rounded-2xl bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground">
          {{ activeSuggestion.fromLabel }} → {{ activeSuggestion.toLabel }} · {{ monthLabel }}
        </p>
        <div class="space-y-2">
          <Label for="settle-amount">Valor (R$)</Label>
          <Input id="settle-amount" v-model="amountInput" inputmode="decimal" required />
        </div>
        <div class="space-y-2">
          <Label for="settle-source">Sai da conta de</Label>
          <Select id="settle-source" v-model="sourceAccount" required>
            <option value="">Selecione</option>
            <option v-for="account in realAccounts" :key="account.id" :value="account.id">
              {{ account.name }}
            </option>
          </Select>
        </div>
        <div class="space-y-2">
          <Label for="settle-destination">Entra na conta de</Label>
          <Select id="settle-destination" v-model="destinationAccount" required>
            <option value="">Selecione</option>
            <option v-for="account in realAccounts" :key="account.id" :value="account.id">
              {{ account.name }}
            </option>
          </Select>
        </div>
        <div class="flex justify-end gap-2 pt-1">
          <Button variant="ghost" type="button" @click="payOpen = false">Cancelar</Button>
          <Button type="submit" :loading="registering">Registrar</Button>
        </div>
      </form>
    </Modal>
  </div>
</template>
