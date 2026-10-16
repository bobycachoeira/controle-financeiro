<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { todayISO } from "@cf/shared";
import { ChevronDown, CreditCard } from "lucide-vue-next";
import { db, type LocalCategory, type LocalTransaction } from "@/db/schema";
import { useTransactionsStore } from "@/stores/transactions";
import { useAccountsStore } from "@/stores/accounts";
import { useCardsStore } from "@/stores/cards";
import { usePeopleStore } from "@/stores/people";
import { useSessionStore } from "@/stores/session";
import { useToast } from "@/composables/useToast";
import { haptic } from "@/lib/haptics";
import { trackUx } from "@/lib/ux-metrics";
import type { QuickAddPrefill } from "@/stores/quick-add";
import { matchImportRule, parseImportRules, type ImportRule } from "@/lib/import-rules";
import { loadHouseholdSetting, waitForHousehold } from "@/lib/household-settings";
import { compressImageFile, dataUrlSizeLabel } from "@/lib/photo";
import { formatBRL } from "@/lib/format";
import {
  buildHistoryIndex,
  recentAccountIds,
  recentCategoryIds,
  suggestDescriptions,
} from "./suggestions";
import Modal from "@/components/ui/Modal.vue";
import Button from "@/components/ui/Button.vue";
import CurrencyInput from "@/components/ui/CurrencyInput.vue";
import Input from "@/components/ui/Input.vue";
import Label from "@/components/ui/Label.vue";
import Select from "@/components/ui/Select.vue";
import CategorySelect from "@/components/ui/CategorySelect.vue";
import PayerPickerModal from "./PayerPickerModal.vue";

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    prefill?: QuickAddPrefill | null;
  }>(),
  { prefill: null },
);
const emit = defineEmits<{ "update:modelValue": [boolean]; saved: [LocalTransaction] }>();

const transactionsStore = useTransactionsStore();
const accountsStore = useAccountsStore();
const cardsStore = useCardsStore();
const people = usePeopleStore();
const session = useSessionStore();
const toast = useToast();

const INSTALLMENT_OPTIONS = [1, 2, 3, 4, 5, 6, 10, 12];

const amountCents = ref<number | null>(null);
const amountError = ref("");
const type = ref<"receita" | "despesa">("despesa");
const description = ref("");
const date = ref(todayISO());
const account = ref("");
const creditCard = ref("");
const attribution = ref("indefinido");
const status = ref<"pago" | "a_pagar">("pago");
const category = ref("");
const tagsInput = ref("");
const attachment = ref<string | null>(null);
const attachmentBusy = ref(false);
const photoInput = ref<HTMLInputElement | null>(null);
const installments = ref(1);
const paidInstallments = ref(0);
const showMore = ref(false);
const saving = ref(false);
const dirty = ref(false);
let openedAt = 0;
let savedInSession = false;

const amountInput = ref<InstanceType<typeof CurrencyInput> | null>(null);
const categories = ref<LocalCategory[]>([]);
const history = ref<LocalTransaction[]>([]);
const rules = ref<ImportRule[]>([]);
const fallbackCategories = ref<{ saida: string | null; entrada: string | null }>({
  saida: null,
  entrada: null,
});

const isCard = computed(() => creditCard.value !== "");
const card = computed(() => cardsStore.cards.find((item) => item.id === creditCard.value));
const historyIndex = computed(() => buildHistoryIndex(history.value));
const suggestions = computed(() => suggestDescriptions(description.value, historyIndex.value, 3));

const recentCategories = computed(() => {
  const ids = recentCategoryIds(history.value, {
    kind: type.value,
    today: todayISO(),
    days: 90,
    limit: 5,
  });
  return ids
    .map((id) => categories.value.find((item) => item.id === id))
    .filter((item): item is LocalCategory => Boolean(item));
});

const recentAccounts = computed(() => {
  const ids = recentAccountIds(history.value, 3);
  const ordered = ids
    .map((id) => accountsStore.items.find((item) => item.id === id && item.type !== "cartao_credito"))
    .filter((item): item is (typeof accountsStore.items)[number] => Boolean(item));
  for (const item of accountsStore.items) {
    if (item.type === "cartao_credito") continue;
    if (!ordered.some((existing) => existing.id === item.id)) ordered.push(item);
  }
  return ordered.slice(0, 3);
});

const accountsOnly = computed(() =>
  accountsStore.items.filter((item) => item.type !== "cartao_credito"),
);

const pickerOpen = ref(false);

/** Até 2 contas à mão; o resto vai para o seletor (evita parede de chips). */
const visibleAccounts = computed(() => {
  const shown = recentAccounts.value.slice(0, 2);
  if (!isCard.value && account.value && !shown.some((item) => item.id === account.value)) {
    const selected = accountsOnly.value.find((item) => item.id === account.value);
    if (selected) {
      if (shown.length >= 2) shown.splice(shown.length - 1, 1, selected);
      else shown.push(selected);
    }
  }
  return shown;
});

const hiddenAccountsCount = computed(() =>
  Math.max(0, accountsOnly.value.length - visibleAccounts.value.length),
);

/** Até 3 cartões à mão; o resto vai para o seletor. */
const visibleCards = computed(() => {
  const shown = cardsStore.cards.slice(0, 3);
  if (creditCard.value && !shown.some((item) => item.id === creditCard.value)) {
    const selected = cardsStore.cards.find((item) => item.id === creditCard.value);
    if (selected) {
      if (shown.length >= 3) shown.splice(shown.length - 1, 1, selected);
      else shown.push(selected);
    }
  }
  return shown;
});

const hiddenCardsCount = computed(() => Math.max(0, cardsStore.cards.length - visibleCards.value.length));

function onPayerPick(event: { kind: "account" | "card"; id: string }): void {
  if (event.kind === "card") selectCard(event.id);
  else selectAccount(event.id);
}

const ruleMatch = computed(() =>
  description.value ? matchImportRule(description.value, rules.value) : null,
);

function resolvedCategory(): string | null {
  if (category.value) return category.value;
  if (ruleMatch.value) return ruleMatch.value.category;
  return type.value === "receita" ? fallbackCategories.value.entrada : fallbackCategories.value.saida;
}

const accountOwner = computed<string>(() => {
  if (isCard.value && card.value) {
    if (card.value.owner && card.value.owner !== "indefinido") return card.value.owner;
    return accountsStore.items.find((item) => item.id === card.value?.account)?.owner ?? "indefinido";
  }
  return accountsStore.items.find((item) => item.id === account.value)?.owner ?? "indefinido";
});

watch([account, creditCard], () => {
  const owner = accountOwner.value !== "indefinido" ? accountOwner.value : people.currentKey;
  if (owner && owner !== "indefinido") attribution.value = owner;
  if (isCard.value) status.value = "a_pagar";
  dirty.value = true;
});

watch([description, amountCents, category], () => {
  dirty.value = true;
  if (amountError.value && amountCents.value && amountCents.value > 0) amountError.value = "";
});

function parseTags(): string[] {
  const list = tagsInput.value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  return [...new Set(list)].slice(0, 8);
}

function applySuggestion(suggestion: { description: string; category: string | null }): void {
  description.value = suggestion.description;
  if (!category.value && suggestion.category) category.value = suggestion.category;
}

function toggleCategory(id: string): void {
  category.value = category.value === id ? "" : id;
}

function selectAccount(id: string): void {
  creditCard.value = "";
  account.value = id;
}

function selectCard(id: string): void {
  if (creditCard.value === id) {
    creditCard.value = "";
    account.value = defaultAccountId();
    return;
  }
  const selected = cardsStore.cards.find((item) => item.id === id);
  if (!selected) return;
  creditCard.value = id;
  account.value = selected.account;
}

function defaultAccountId(): string {
  const recent = recentAccountIds(history.value, 1)[0];
  const preferred = recent
    ? accountsStore.items.find((item) => item.id === recent && item.type !== "cartao_credito")
    : undefined;
  return preferred?.id ?? accountsStore.items.find((item) => item.type !== "cartao_credito")?.id ?? "";
}

async function prepare(): Promise<void> {
  const prefill = props.prefill;
  openedAt = Date.now();
  savedInSession = false;
  trackUx("quick_add_opened");
  amountCents.value = prefill?.amountCents ?? null;
  amountError.value = "";
  type.value = prefill?.type ?? "despesa";
  description.value = prefill?.description ?? "";
  date.value = prefill?.date ?? todayISO();
  account.value = prefill?.account ?? "";
  creditCard.value = prefill?.creditCard ?? "";
  attribution.value = prefill?.attribution ?? "indefinido";
  status.value = "pago";
  category.value = prefill?.category ?? "";
  tagsInput.value = (prefill?.tags ?? []).join(", ");
  attachment.value = null;
  installments.value = 1;
  paidInstallments.value = 0;
  showMore.value = false;
  dirty.value = Boolean(prefill?.amountCents || prefill?.description);

  const household = session.currentHouseholdId;
  await Promise.all([
    accountsStore.load(),
    cardsStore.load(),
    people.load(),
    household ? loadHistory(household) : Promise.resolve(),
  ]);
  if (household) {
    await waitForHousehold(household);
    rules.value = parseImportRules(await loadHouseholdSetting(household, "import_rules", []));
    const list = await db.categories.where("household").equals(household).toArray();
    categories.value = list.filter((item) => !item.deleted_at && item.active !== false);
    const saida = categories.value.find((item) => item.name === "Outros");
    const entrada = categories.value.find((item) => item.name === "Outras receitas");
    fallbackCategories.value = { saida: saida?.id ?? null, entrada: entrada?.id ?? null };
  }
  if (!creditCard.value && !account.value) account.value = defaultAccountId();
  if (isCard.value) status.value = "a_pagar";

  await nextTick();
  requestAnimationFrame(() => amountInput.value?.focus());
}

async function loadHistory(household: string): Promise<void> {
  const rows = await db.transactions.where("household").equals(household).toArray();
  history.value = rows.filter((tx) => !tx.deleted_at);
}

async function onPhotoChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  attachmentBusy.value = true;
  try {
    attachment.value = await compressImageFile(file);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Falha ao processar a foto.");
  } finally {
    attachmentBusy.value = false;
  }
}

async function submit(continueAfter = false): Promise<void> {
  const cents = amountCents.value;
  if (cents === null || cents <= 0) {
    amountError.value = "Informe um valor maior que zero.";
    amountInput.value?.focus();
    return;
  }
  saving.value = true;
  try {
    let record: LocalTransaction;
    if (isCard.value && card.value) {
      record = await transactionsStore.createCardPurchase({
        account: card.value.account,
        credit_card: card.value.id,
        amount_cents: cents,
        date: date.value,
        attribution: attribution.value,
        category: resolvedCategory(),
        description: description.value,
        status: "a_pagar",
        tags: parseTags(),
        attachment: attachment.value,
        installments: installments.value,
        paid_installments: paidInstallments.value,
        closing_day: card.value.closing_day,
        due_day: card.value.due_day,
      });
    } else {
      record = await transactionsStore.create({
        account: account.value,
        credit_card: null,
        amount_cents: cents,
        type: type.value,
        date: date.value,
        attribution: attribution.value,
        category: resolvedCategory(),
        description: description.value,
        status: status.value,
        tags: parseTags(),
        attachment: attachment.value,
      });
    }
    haptic(12);
    savedInSession = true;
    trackUx("quick_add_saved", Date.now() - openedAt);
    toast.success(
      "Lançamento salvo.",
      record.invoice
        ? undefined
        : {
            label: "Desfazer",
            run: async () => {
              await transactionsStore.remove(record.id);
            },
          },
    );
    emit("saved", record);
    dirty.value = false;
    if (continueAfter) {
      amountCents.value = null;
      description.value = "";
      category.value = "";
      tagsInput.value = "";
      attachment.value = null;
      status.value = isCard.value ? "a_pagar" : "pago";
      await nextTick();
      amountInput.value?.focus();
      return;
    }
    emit("update:modelValue", false);
  } catch (error) {
    haptic([20, 40, 20]);
    toast.error(error instanceof Error ? error.message : "Falha ao salvar.");
  } finally {
    saving.value = false;
  }
}

function close(): void {
  emit("update:modelValue", false);
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      void prepare();
    } else if (!savedInSession && dirty.value) {
      trackUx("quick_add_abandoned");
    }
  },
);
</script>

<template>
  <Modal
    :model-value="modelValue"
    title="Novo lançamento"
    :close-on-outside="false"
    @update:model-value="close"
  >
    <div data-testid="quick-add-sheet" class="space-y-4">
      <div class="rounded-3xl bg-secondary/60 px-5 py-5 text-center">
        <Label for="qa-amount" class="text-secondary-foreground/70">Valor</Label>
        <div class="mt-1 flex items-baseline justify-center gap-1 font-display">
          <span class="text-2xl font-bold text-muted-foreground">R$</span>
          <CurrencyInput
            id="qa-amount"
            ref="amountInput"
            v-model="amountCents"
            class="h-auto w-40 border-0 bg-transparent text-center font-display text-4xl font-black tracking-tight shadow-none"
          />
        </div>
        <p v-if="amountError" class="mt-1 text-xs font-bold text-destructive" role="alert">
          {{ amountError }}
        </p>
        <p v-else class="mt-1 text-xs font-bold text-muted-foreground">
          {{ formatBRL(amountCents ?? 0) }}
        </p>
      </div>

      <div class="grid grid-cols-2 gap-2 rounded-full bg-muted p-1">
        <button
          type="button"
          class="h-11 rounded-full text-sm font-extrabold transition"
          :class="type === 'despesa' ? 'bg-primary text-primary-foreground shadow-lift' : 'text-muted-foreground'"
          @click="type = 'despesa'"
        >
          Despesa
        </button>
        <button
          type="button"
          class="h-11 rounded-full text-sm font-extrabold transition"
          :class="type === 'receita' ? 'bg-leaf text-white shadow-lift' : 'text-muted-foreground'"
          @click="type = 'receita'"
        >
          Receita
        </button>
      </div>

      <div class="space-y-2">
        <Label for="qa-description">Descrição</Label>
        <Input
          id="qa-description"
          v-model="description"
          maxlength="200"
          placeholder="Ex.: Mercado da semana"
          autocomplete="off"
        />
        <div v-if="suggestions.length > 0" class="flex flex-wrap gap-1.5">
          <button
            v-for="suggestion in suggestions"
            :key="suggestion.description"
            type="button"
            data-testid="qa-suggestion"
            data-compact
            class="max-w-full truncate rounded-full border border-border bg-card px-3 py-1.5 text-xs font-bold text-muted-foreground transition hover:border-primary hover:text-primary"
            @click="applySuggestion(suggestion)"
          >
            {{ suggestion.description }}
          </button>
        </div>
        <p
          v-if="ruleMatch && category === ruleMatch.category"
          class="text-[0.62rem] font-semibold text-primary"
        >
          Sugerida pela regra “{{ ruleMatch.pattern }}”
        </p>
      </div>

      <div class="space-y-2">
        <Label for="qa-date">Data</Label>
        <Input id="qa-date" v-model="date" type="date" />
      </div>

      <div class="space-y-2">
        <Label>Categoria</Label>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="item in recentCategories"
            :key="item.id"
            type="button"
            data-testid="qa-category-chip"
            data-compact
            class="rounded-full border px-3 py-1.5 text-xs font-bold transition"
            :class="
              category === item.id
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-card text-muted-foreground hover:border-primary hover:text-primary'
            "
            @click="toggleCategory(item.id)"
          >
            {{ item.name }}
          </button>
        </div>
        <CategorySelect
          id="qa-category"
          v-model="category"
          :kind="type === 'receita' ? 'entrada' : 'saida'"
          allow-empty
          empty-label="Sem categoria (Outros)"
          placeholder="Outra categoria…"
          class="w-full"
        />
      </div>

      <div class="space-y-3">
        <Label>Pagar com</Label>

        <div class="space-y-1.5">
          <p class="text-[0.62rem] font-extrabold uppercase tracking-wide text-muted-foreground">
            Contas
          </p>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="item in visibleAccounts"
              :key="item.id"
              type="button"
              data-testid="qa-payer-chip"
              data-compact
              class="rounded-full border px-3 py-1.5 text-xs font-bold transition"
              :class="
                !isCard && account === item.id
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card text-muted-foreground hover:border-primary hover:text-primary'
              "
              @click="selectAccount(item.id)"
            >
              {{ item.name }}
            </button>
            <button
              v-if="hiddenAccountsCount > 0"
              type="button"
              data-testid="qa-more-payers"
              data-compact
              class="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1.5 text-xs font-bold text-muted-foreground transition hover:border-primary hover:text-primary"
              @click="pickerOpen = true"
            >
              Mais contas ({{ hiddenAccountsCount }})…
            </button>
          </div>
        </div>

        <div v-if="cardsStore.cards.length > 0" class="space-y-1.5">
          <p class="text-[0.62rem] font-extrabold uppercase tracking-wide text-muted-foreground">
            Cartões
          </p>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="item in visibleCards"
              :key="item.id"
              type="button"
              data-testid="qa-payer-chip"
              data-compact
              class="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-bold transition"
              :class="
                creditCard === item.id
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card text-muted-foreground hover:border-primary hover:text-primary'
              "
              @click="selectCard(item.id)"
            >
              <CreditCard class="h-3 w-3" aria-hidden="true" />
              {{ item.bank || "Cartão" }}
            </button>
            <button
              v-if="hiddenCardsCount > 0"
              type="button"
              data-testid="qa-more-payers"
              data-compact
              class="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1.5 text-xs font-bold text-muted-foreground transition hover:border-primary hover:text-primary"
              @click="pickerOpen = true"
            >
              Mais cartões ({{ hiddenCardsCount }})…
            </button>
          </div>
        </div>

        <p
          v-if="isCard && card"
          class="rounded-2xl bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground"
        >
          Cai na fatura pelo fechamento (dia {{ card.closing_day }}){{ installments > 1 ? `, em ${installments}x` : "" }}.
        </p>
      </div>

      <div v-if="isCard" class="space-y-2">
        <Label>Parcelas</Label>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="option in INSTALLMENT_OPTIONS"
            :key="option"
            type="button"
            data-compact
            class="h-9 min-w-[3rem] rounded-full border px-3 text-xs font-bold transition"
            :class="
              installments === option
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-card text-muted-foreground hover:border-primary hover:text-primary'
            "
            @click="installments = option"
          >
            {{ option }}x
          </button>
        </div>
      </div>

      <div>
        <button
          type="button"
          data-testid="qa-more"
          class="flex w-full items-center justify-between rounded-2xl bg-muted px-4 py-3 text-sm font-extrabold text-muted-foreground transition hover:text-foreground"
          :aria-expanded="showMore"
          @click="showMore = !showMore"
        >
          Mais opções
          <ChevronDown class="h-4 w-4 transition-transform" :class="showMore && 'rotate-180'" />
        </button>

        <div v-if="showMore" class="mt-3 space-y-4 rounded-2xl border-2 border-border p-4" data-testid="qa-more-fields">
          <div v-if="!isCard" class="space-y-2">
            <Label for="qa-status">Status</Label>
            <Select id="qa-status" v-model="status">
              <option value="pago">Pago</option>
              <option value="a_pagar">A pagar</option>
            </Select>
          </div>
          <div class="space-y-2">
            <Label for="qa-attribution">Atribuição</Label>
            <Select id="qa-attribution" v-model="attribution">
              <option v-for="option in people.selectable" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </Select>
          </div>
          <div v-if="isCard" class="space-y-2">
            <Label for="qa-paid">Parcelas já pagas (compra em andamento)</Label>
            <Input
              id="qa-paid"
              v-model.number="paidInstallments"
              type="number"
              :min="0"
              :max="Math.max(0, installments - 1)"
              :disabled="installments === 1"
            />
          </div>
          <div class="space-y-2">
            <Label for="qa-tags">Etiquetas (opcional)</Label>
            <Input id="qa-tags" v-model="tagsInput" placeholder="Ex.: viagem, trabalho" />
          </div>
          <div class="space-y-2">
            <Label for="qa-photo">Comprovante (foto, opcional)</Label>
            <input
              id="qa-photo"
              ref="photoInput"
              type="file"
              accept="image/*"
              capture="environment"
              class="hidden"
              @change="onPhotoChange"
            />
            <div v-if="!attachment">
              <Button
                variant="outline"
                size="sm"
                type="button"
                :loading="attachmentBusy"
                @click="photoInput?.click()"
              >
                Anexar foto
              </Button>
            </div>
            <div v-else class="flex items-center gap-3 rounded-2xl border-2 border-border p-2">
              <img :src="attachment" alt="Comprovante" class="h-16 w-16 rounded-xl object-cover" />
              <p class="min-w-0 flex-1 text-xs text-muted-foreground">
                Foto anexada · {{ dataUrlSizeLabel(attachment) }}
              </p>
              <Button variant="ghost" size="sm" type="button" @click="attachment = null">
                Remover
              </Button>
            </div>
          </div>
        </div>
      </div>

      <p v-if="isCard && installments > 1" class="text-xs font-semibold text-muted-foreground">
        Ficam {{ installments }} parcelas de {{ formatBRL(amountCents ?? 0) }} na fatura.
      </p>

      <div
        class="sticky bottom-0 -mx-6 -mb-6 border-t border-border bg-card px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3"
      >
        <div class="grid grid-cols-2 gap-2">
          <Button
            data-testid="qa-save-continue"
            variant="outline"
            class="whitespace-nowrap px-2 text-xs min-[380px]:px-4 min-[380px]:text-sm"
            :disabled="saving"
            @click="submit(true)"
          >
            Salvar e continuar
          </Button>
          <Button
            data-testid="qa-save"
            :loading="saving"
            @click="submit(false)"
          >
            Salvar
          </Button>
        </div>
      </div>

      <PayerPickerModal
        v-model="pickerOpen"
        :accounts="accountsOnly"
        :cards="cardsStore.cards"
        :selected-account="account"
        :selected-card="creditCard"
        @pick="onPayerPick"
      />
    </div>
  </Modal>
</template>
