<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { todayISO } from "@cf/shared";
import { ArrowLeft, CreditCard } from "lucide-vue-next";
import { db } from "@/db/schema";
import { useTransactionsStore } from "@/stores/transactions";
import { useAccountsStore } from "@/stores/accounts";
import { useCardsStore } from "@/stores/cards";
import { usePeopleStore } from "@/stores/people";
import { useSessionStore } from "@/stores/session";
import { useSyncStore } from "@/stores/sync";
import { useToast } from "@/composables/useToast";
import { matchImportRule, parseImportRules, type ImportRule } from "@/lib/import-rules";
import { loadHouseholdSetting, waitForHousehold } from "@/lib/household-settings";
import { compressImageFile, dataUrlSizeLabel } from "@/lib/photo";
import { formatBRL } from "@/lib/format";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import CardContent from "@/components/ui/CardContent.vue";
import CurrencyInput from "@/components/ui/CurrencyInput.vue";
import Input from "@/components/ui/Input.vue";
import Label from "@/components/ui/Label.vue";
import Select from "@/components/ui/Select.vue";
import CategorySelect from "@/components/ui/CategorySelect.vue";

const transactionsStore = useTransactionsStore();
const accountsStore = useAccountsStore();
const cardsStore = useCardsStore();
const people = usePeopleStore();
const session = useSessionStore();
const sync = useSyncStore();
const route = useRoute();
const router = useRouter();
const toast = useToast();

const isEdit = computed(() => Boolean(route.params.id));
const amountCents = ref<number | null>(null);
const type = ref<"receita" | "despesa">("despesa");
const description = ref("");
const date = ref(todayISO());
const account = ref("");
const creditCard = ref("");
const attribution = ref("indefinido");
const status = ref<"pago" | "a_pagar">("pago");
const category = ref("");
const rules = ref<ImportRule[]>([]);
const fallbackCategories = ref<{ saida: string | null; entrada: string | null }>({
  saida: null,
  entrada: null,
});

const ruleMatch = computed(() =>
  description.value ? matchImportRule(description.value, rules.value) : null,
);

function resolvedCategory(): string | null {
  if (category.value) return category.value;
  if (ruleMatch.value) return ruleMatch.value.category;
  return type.value === "receita" ? fallbackCategories.value.entrada : fallbackCategories.value.saida;
}

watch(description, () => {
  if (!category.value && ruleMatch.value) category.value = ruleMatch.value.category;
});
const tagsInput = ref("");
const attachment = ref<string | null>(null);
const attachmentBusy = ref(false);
const photoInput = ref<HTMLInputElement | null>(null);
const installments = ref(1);
const paidInstallments = ref(0);
const installmentInfo = ref<{ number: number; total: number } | null>(null);
const saving = ref(false);

const remainingInstallments = computed(() =>
  Math.max(1, installments.value - paidInstallments.value),
);

function parseTags(): string[] {
  const list = tagsInput.value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  return [...new Set(list)].slice(0, 8);
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

const isCard = computed(() => creditCard.value !== "");
const card = computed(() => cardsStore.cards.find((item) => item.id === creditCard.value));

const accountOwner = computed<string>(() => {
  if (isCard.value && card.value) {
    if (card.value.owner && card.value.owner !== "indefinido") return card.value.owner;
    return accountsStore.items.find((item) => item.id === card.value?.account)?.owner ?? "indefinido";
  }
  return accountsStore.items.find((item) => item.id === account.value)?.owner ?? "indefinido";
});

watch([account, creditCard], () => {
  if (isEdit.value) return;
  const owner = accountOwner.value !== "indefinido" ? accountOwner.value : people.currentKey;
  if (owner && owner !== "indefinido") attribution.value = owner;
});

watch(installments, (value) => {
  if (paidInstallments.value > value - 1) {
    paidInstallments.value = Math.max(0, value - 1);
  }
});

async function submit(): Promise<void> {
  const cents = amountCents.value;
  if (cents === null || cents <= 0) {
    toast.error("Informe um valor válido.");
    return;
  }
  saving.value = true;
  try {
    if (isEdit.value) {
      if (isCard.value && type.value === "despesa") {
        await transactionsStore.updateCardPurchase(String(route.params.id), {
          account: account.value,
          amount_cents: cents,
          type: type.value,
          date: date.value,
          attribution: attribution.value,
          category: resolvedCategory(),
          description: description.value,
          status: status.value,
          tags: parseTags(),
          attachment: attachment.value,
          credit_card: creditCard.value,
        });
      } else {
        await transactionsStore.update(String(route.params.id), {
          account: account.value,
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
      toast.success("Lançamento atualizado.");
    } else if (isCard.value && card.value) {
      await transactionsStore.createCardPurchase({
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
      toast.success("Compra no cartão registrada e parcelada.");
    } else {
      await transactionsStore.create({
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
      toast.success("Lançamento salvo.");
    }
    router.push({ name: "transactions" });
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Falha ao salvar.");
  } finally {
    saving.value = false;
  }
}

async function loadRulesAndFallbacks(): Promise<void> {
  const household = session.currentHouseholdId;
  if (!household) return;
  await waitForHousehold(household);
  rules.value = parseImportRules(await loadHouseholdSetting(household, "import_rules", []));
  const list = await db.categories.where("household").equals(household).toArray();
  const saida = list.find((item) => !item.deleted_at && item.name === "Outros");
  const entrada = list.find((item) => !item.deleted_at && item.name === "Outras receitas");
  fallbackCategories.value = { saida: saida?.id ?? null, entrada: entrada?.id ?? null };
  // Descrição digitada antes das regras carregarem também é categorizada.
  if (!category.value && ruleMatch.value) category.value = ruleMatch.value.category;
}

onMounted(async () => {
  await Promise.all([accountsStore.load(), cardsStore.load(), people.load()]);
  await loadRulesAndFallbacks();
  account.value = accountsStore.items.find((item) => item.type !== "cartao_credito")?.id ?? "";
  if (isEdit.value) {
    const tx = await db.transactions.get(String(route.params.id));
    if (tx) {
      amountCents.value = tx.amount_cents;
      type.value = tx.type === "receita" ? "receita" : "despesa";
      description.value = tx.description;
      date.value = tx.date.slice(0, 10);
      account.value = tx.account;
      creditCard.value = tx.credit_card ?? "";
      attribution.value = tx.attribution;
      status.value = tx.status;
      category.value = tx.category ?? "";
      tagsInput.value = (tx.tags ?? []).join(", ");
      attachment.value = tx.attachment ?? null;
      const rows = await db.installments.where("root_transaction").equals(tx.id).toArray();
      const row = rows.find((item) => !item.deleted_at);
      installmentInfo.value = row ? { number: row.number, total: row.total } : null;
    }
  } else {
    const queryCard = route.query.card;
    if (typeof queryCard === "string" && cardsStore.cards.some((item) => item.id === queryCard)) {
      creditCard.value = queryCard;
    }
  }
});

watch(
  () => sync.dataVersion,
  () => {
    void Promise.all([accountsStore.load(), cardsStore.load(), people.load()]);
  },
);
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
        <Label for="amount" class="text-secondary-foreground/70">
          {{ isCard && !isEdit && paidInstallments > 0 ? "Valor de cada parcela" : "Valor" }}
        </Label>
        <div class="mt-1 flex items-baseline justify-center gap-1 font-display">
          <span class="text-2xl font-bold text-muted-foreground">R$</span>
          <CurrencyInput
            id="amount"
            v-model="amountCents"
            class="h-auto w-40 border-0 bg-transparent text-center font-display text-4xl font-black tracking-tight shadow-none"
            autofocus
          />
        </div>
        <p class="mt-1 text-xs font-bold text-muted-foreground">
          {{ formatBRL(amountCents ?? 0) }}
        </p>
      </div>

      <CardContent class="space-y-5 pt-5">
        <div class="grid grid-cols-2 gap-2 rounded-full bg-muted p-1">
          <button
            type="button"
            class="rounded-full py-2 text-sm font-extrabold transition disabled:opacity-50"
            :class="type === 'despesa' ? 'bg-primary text-primary-foreground shadow-lift' : 'text-muted-foreground'"
            :disabled="isEdit && isCard"
            @click="type = 'despesa'"
          >
            Despesa
          </button>
          <button
            type="button"
            class="rounded-full py-2 text-sm font-extrabold transition disabled:opacity-50"
            :class="type === 'receita' ? 'bg-leaf text-white shadow-lift' : 'text-muted-foreground'"
            :disabled="isEdit && isCard"
            @click="type = 'receita'"
          >
            Receita
          </button>
        </div>

        <div class="space-y-2">
          <Label for="description">Descrição</Label>
          <Input id="description" v-model="description" maxlength="200" placeholder="Ex.: Mercado da semana" />
        </div>

        <div class="space-y-2">
          <Label for="tags">Etiquetas (opcional)</Label>
          <Input
            id="tags"
            v-model="tagsInput"
            placeholder="Ex.: viagem, trabalho (separadas por vírgula)"
          />
        </div>

        <div class="space-y-2">
          <Label for="photo">Comprovante (foto, opcional)</Label>
          <input
            id="photo"
            ref="photoInput"
            type="file"
            accept="image/*"
            capture="environment"
            class="hidden"
            @change="onPhotoChange"
          />
          <div v-if="!attachment" class="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              type="button"
              :loading="attachmentBusy"
              @click="photoInput?.click()"
            >
              Anexar foto
            </Button>
            <span class="text-xs text-muted-foreground">A imagem é comprimida antes de salvar.</span>
          </div>
          <div v-else class="flex items-center gap-3 rounded-2xl border-2 border-border p-2">
            <img :src="attachment" alt="Comprovante" class="h-16 w-16 rounded-xl object-cover" />
            <p class="min-w-0 flex-1 text-xs text-muted-foreground">
              Foto anexada · {{ dataUrlSizeLabel(attachment) }}
            </p>
            <Button variant="ghost" size="sm" type="button" @click="attachment = null">Remover</Button>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-2">
            <Label for="date">Data</Label>
            <Input id="date" v-model="date" type="date" required />
          </div>
          <div class="space-y-2">
            <Label for="category">Categoria</Label>
            <CategorySelect
              id="category"
              v-model="category"
              :kind="type === 'receita' ? 'entrada' : 'saida'"
              allow-empty
            />
            <p
              v-if="ruleMatch && category === ruleMatch.category"
              class="text-[0.62rem] font-semibold text-primary"
            >
              Sugerida pela regra “{{ ruleMatch.pattern }}”
            </p>
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

        <div v-if="type === 'despesa' && (!isEdit || isCard)" class="space-y-2">
          <Label for="card" class="flex items-center gap-1">
            <CreditCard class="h-3.5 w-3.5" /> Cartão de crédito
          </Label>
          <Select id="card" v-model="creditCard" :disabled="isEdit && !isCard">
            <option v-if="!isEdit || !isCard" value="">Sem cartão</option>
            <option v-for="item in cardsStore.cards" :key="item.id" :value="item.id">
              {{ item.bank || "Cartão" }} •••• {{ item.closing_day }}/{{ item.due_day }}
            </option>
          </Select>
        </div>

        <div v-if="isCard && !isEdit" class="grid grid-cols-2 gap-3">
          <div class="space-y-2">
            <Label for="installments">Parcelas (total)</Label>
            <Select id="installments" v-model.number="installments">
              <option v-for="n in 12" :key="n" :value="n">{{ n }}x</option>
            </Select>
          </div>
          <div class="space-y-2">
            <Label for="paid-installments">Já pagas</Label>
            <Input
              id="paid-installments"
              v-model.number="paidInstallments"
              type="number"
              :min="0"
              :max="Math.max(0, installments - 1)"
              :disabled="installments === 1"
            />
          </div>
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
          <template v-if="paidInstallments > 0">
            Compra em andamento: o valor digitado é <strong>cada parcela</strong>. Entram as parcelas
            {{ paidInstallments + 1 }} a {{ installments }} ({{ remainingInstallments }}x), a partir
            da fatura pelo fechamento (dia {{ card.closing_day }}).
          </template>
          <template v-else>
            Cai na fatura pelo fechamento (dia {{ card.closing_day }}), em {{ installments }}x.
          </template>
        </p>

        <p v-if="isEdit && installmentInfo" class="rounded-2xl bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground">
          Parcela {{ installmentInfo.number }} de {{ installmentInfo.total }} desta compra.
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
