<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import type { BillNature, BillType } from "@cf/shared";
import { addDays, billDueDate, computeBillsTotals, occurrencesBetween, todayISO } from "@cf/shared";
import { Check, Clock, CreditCard, Pause, Pencil, Play, Plus, RefreshCw, RotateCcw, Trash2, Wallet } from "lucide-vue-next";
import { apiClient } from "@/api/client";
import { db, type LocalBill, type LocalCategory } from "@/db/schema";
import { createLocal, newSyncId, newLocalId, updateLocal } from "@/db/repositories";
import { useSessionStore } from "@/stores/session";
import { useSyncStore } from "@/stores/sync";
import { useRecurrencesStore } from "@/stores/recurrences";
import { useTransactionsStore } from "@/stores/transactions";
import { useAccountsStore } from "@/stores/accounts";
import { useCardsStore } from "@/stores/cards";
import { useToast } from "@/composables/useToast";
import { parseAmountInput, formatBRL } from "@/lib/format-input";
import { formatCentsToInput, formatDate } from "@/lib/format";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import CardContent from "@/components/ui/CardContent.vue";
import Badge from "@/components/ui/Badge.vue";
import Input from "@/components/ui/Input.vue";
import Label from "@/components/ui/Label.vue";
import Select from "@/components/ui/Select.vue";
import Modal from "@/components/ui/Modal.vue";
import IconChip from "@/components/ui/IconChip.vue";

const session = useSessionStore();
const sync = useSyncStore();
const recurrencesStore = useRecurrencesStore();
const transactionsStore = useTransactionsStore();
const accountsStore = useAccountsStore();
const cardsStore = useCardsStore();
const toast = useToast();

const bills = ref<LocalBill[]>([]);
const categories = ref<LocalCategory[]>([]);
const month = ref(todayISO().slice(0, 7));
const totals = computed(() => computeBillsTotals(bills.value, month.value));

const recurringBills = computed(() =>
  recurrencesStore.items.filter((recurrence) => recurrence.target === "bill" && !recurrence.deleted_at),
);
const pendingConfirm = computed(() => bills.value.filter((b) => b.status === "a_confirmar"));
const payable = computed(() => bills.value.filter((b) => b.status === "pendente"));
const settled = computed(() => bills.value.filter((b) => b.status === "pago" || b.status === "cancelado"));

// choose type
const chooserOpen = ref(false);

// one-off bill
const oneOpen = ref(false);
const editingId = ref<string | null>(null);
const title = ref("");
const amount = ref("");
const nature = ref<BillNature>("saida");
const type = ref<BillType>("fixa");
const dueDate = ref(todayISO());
const saving = ref(false);

// recurring bill
const recOpen = ref(false);
const recEditingId = ref<string | null>(null);
const recOriginalStart = ref<string | null>(null);
const recName = ref("");
const recNature = ref<BillNature>("saida");
const recPeriodicity = ref("mensal");
const recEmissionDay = ref(5);
const recDueDay = ref(15);
const recAmount = ref("");
const recVariable = ref(true);
const recDuration = ref("sempre");
const recMonths = ref(12);
const recCategory = ref("");
const recAttribution = ref<"meu" | "dela" | "ambos">("ambos");
const recSaving = ref(false);

// confirm value
const confirmOpen = ref(false);
const confirming = ref<LocalBill | null>(null);
const confirmAmount = ref("");

// pay
const payOpen = ref(false);
const payingBill = ref<LocalBill | null>(null);
const payMode = ref<"conta" | "cartao">("conta");
const payAccount = ref("");
const payCard = ref("");
const payDate = ref(todayISO());
const paying = ref(false);

const upcoming = computed(() => {
  const today = todayISO();
  const from = addDays(today, -120);
  const to = addDays(today, 60);
  const generatedKeys = new Set(
    bills.value.map((bill) => `${bill.recurrence}|${(bill.emission_date ?? "").slice(0, 10)}`),
  );
  const list: {
    key: string;
    name: string;
    emission: string;
    due: string;
    amountCents: number;
    nature: BillNature;
    confirmRequired: boolean;
    recurrenceId: string;
    category: string | null;
    attribution: "meu" | "dela" | "ambos";
    periodicity: string;
    overdue: boolean;
  }[] = [];
  for (const rec of recurrencesStore.items) {
    if (rec.target !== "bill" || !rec.active || rec.deleted_at) continue;
    const template = rec.template;
    const start = rec.start_date.slice(0, 10);
    const dueDay = template.due_day ?? Number(start.slice(8, 10));
    const attribution =
      template.attribution === "meu" || template.attribution === "dela" ? template.attribution : "ambos";
    const occurrences = occurrencesBetween(rec.rrule, start, from, to);
    for (const emission of occurrences) {
      if (generatedKeys.has(`${rec.id}|${emission}`)) continue;
      list.push({
        key: `${rec.id}-${emission}`,
        name: rec.name,
        emission,
        due: billDueDate(emission, dueDay),
        amountCents: template.default_amount_cents ?? template.amount_cents ?? 0,
        nature: template.nature ?? "saida",
        confirmRequired: Boolean(template.confirm_required),
        recurrenceId: rec.id,
        category: template.category ?? null,
        attribution,
        periodicity: periodicityFromRrule(rec.rrule),
        overdue: emission < today,
      });
    }
  }
  return list.sort((a, b) => (a.emission < b.emission ? -1 : 1)).slice(0, 12);
});

const confirmEarly = ref(false);

async function confirmUpcoming(item: (typeof upcoming.value)[number]): Promise<void> {
  const existing = bills.value.find(
    (bill) => bill.recurrence === item.recurrenceId && (bill.emission_date ?? "").slice(0, 10) === item.emission,
  );
  if (existing) {
    openConfirm(existing);
    return;
  }
  const created = (await createLocal("bills", {
    id: newLocalId(),
    household: session.currentHouseholdId ?? "",
    sync_id: newSyncId(),
    title: item.name,
    amount_cents: item.amountCents,
    currency: "BRL",
    type: item.confirmRequired ? "variavel" : "fixa",
    nature: item.nature,
    due_date: item.due,
    periodicity: item.periodicity,
    status: item.confirmRequired ? "a_confirmar" : "pendente",
    attribution: item.attribution,
    responsible_user: null,
    category: item.category,
    recurrence: item.recurrenceId,
    reminder_config: {},
    last_generation: null,
    next_generation: null,
    emission_date: item.emission,
    confirmed_at: item.confirmRequired ? null : new Date().toISOString(),
    updated_by: session.user?.id ?? null,
    deleted_at: null,
  })) as unknown as LocalBill;
  await load();
  if (item.confirmRequired) {
    openConfirm(created);
  } else {
    toast.success("Emissão lançada.");
  }
}

async function load(): Promise<void> {
  if (!session.currentHouseholdId) return;
  const h = session.currentHouseholdId;
  bills.value = (await db.bills.where("household").equals(h).toArray())
    .filter((bill) => !bill.deleted_at)
    .sort((a, b) => (a.due_date < b.due_date ? 1 : -1));
  categories.value = (await db.categories.where("household").equals(h).toArray()).filter(
    (category) => !category.deleted_at,
  );
}

function nextEmissionDate(day: number): string {
  const today = todayISO();
  const [year, month] = today.split("-").map(Number);
  const clamp = (y: number, m: number, d: number) =>
    Math.min(d, new Date(Date.UTC(y, m, 0)).getUTCDate());
  const thisMonth = `${year}-${String(month).padStart(2, "0")}-${String(clamp(year!, month!, day)).padStart(2, "0")}`;
  if (thisMonth >= today) return thisMonth;
  const nm = month === 12 ? { y: year! + 1, m: 1 } : { y: year!, m: month! + 1 };
  return `${nm.y}-${String(nm.m).padStart(2, "0")}-${String(clamp(nm.y, nm.m, day)).padStart(2, "0")}`;
}

function openOne(): void {
  editingId.value = null;
  title.value = "";
  amount.value = "";
  nature.value = "saida";
  type.value = "variavel";
  dueDate.value = todayISO();
  oneOpen.value = true;
}

function openEdit(bill: LocalBill): void {
  editingId.value = bill.id;
  title.value = bill.title;
  amount.value = formatCentsToInput(bill.amount_cents);
  nature.value = bill.nature;
  type.value = bill.type;
  dueDate.value = bill.due_date.slice(0, 10);
  oneOpen.value = true;
}

async function submitOne(): Promise<void> {
  const cents = parseAmountInput(amount.value);
  if (!title.value || cents === null || cents <= 0) {
    toast.error("Preencha título e valor.");
    return;
  }
  saving.value = true;
  try {
    if (editingId.value) {
      const existing = await db.bills.get(editingId.value);
      if (existing) {
        await updateLocal("bills", {
          ...existing,
          title: title.value,
          amount_cents: cents,
          nature: nature.value,
          type: type.value,
          due_date: dueDate.value,
        });
      }
      toast.success("Conta atualizada.");
    } else {
      await createLocal("bills", {
        id: newLocalId(),
        household: session.currentHouseholdId ?? "",
        sync_id: newSyncId(),
        title: title.value,
        amount_cents: cents,
        currency: "BRL",
        type: type.value,
        nature: nature.value,
        due_date: dueDate.value,
        periodicity: "unica",
        status: "pendente",
        attribution: "ambos",
        responsible_user: null,
        category: null,
        recurrence: null,
        reminder_config: {},
        last_generation: null,
        next_generation: null,
        emission_date: null,
        confirmed_at: null,
        updated_by: session.user?.id ?? null,
        deleted_at: null,
      });
      toast.success("Conta adicionada.");
    }
    oneOpen.value = false;
    await load();
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Falha ao salvar.");
  } finally {
    saving.value = false;
  }
}

function periodicityFromRrule(rrule: string): string {
  if (/FREQ=YEARLY/i.test(rrule)) return "anual";
  const interval = Number(rrule.match(/INTERVAL=(\d+)/i)?.[1] ?? "1");
  if (interval === 2) return "bimestral";
  if (interval === 3) return "trimestral";
  return "mensal";
}

function openRecurring(): void {
  recEditingId.value = null;
  recOriginalStart.value = null;
  recName.value = "";
  recNature.value = "saida";
  recPeriodicity.value = "mensal";
  recEmissionDay.value = 5;
  recDueDay.value = 15;
  recAmount.value = "";
  recVariable.value = true;
  recDuration.value = "sempre";
  recMonths.value = 12;
  recCategory.value = "";
  recAttribution.value = "ambos";
  recOpen.value = true;
}

function openEditRecurring(recurrence: (typeof recurrencesStore.items)[number]): void {
  recEditingId.value = recurrence.id;
  recOriginalStart.value = recurrence.start_date.slice(0, 10);
  recName.value = recurrence.name;
  recNature.value = recurrence.template.nature ?? "saida";
  recPeriodicity.value = periodicityFromRrule(recurrence.rrule);
  recEmissionDay.value = recurrence.template.emission_day ?? Number(recurrence.start_date.slice(8, 10));
  recDueDay.value = recurrence.template.due_day ?? Number(recurrence.start_date.slice(8, 10));
  recVariable.value = Boolean(recurrence.template.confirm_required);
  const reference = recurrence.template.default_amount_cents ?? recurrence.template.amount_cents ?? 0;
  recAmount.value = reference > 0 ? formatCentsToInput(reference) : "";
  const countMatch = recurrence.rrule.match(/COUNT=(\d+)/i);
  recDuration.value = countMatch ? "meses" : "sempre";
  recMonths.value = countMatch ? Number(countMatch[1]) : 12;
  recCategory.value = recurrence.template.category ?? "";
  recAttribution.value =
    recurrence.template.attribution === "meu" || recurrence.template.attribution === "dela"
      ? recurrence.template.attribution
      : "ambos";
  recOpen.value = true;
}

function anchorDate(originalStart: string, emissionDay: number): string {
  const [year, month] = originalStart.split("-").map(Number);
  const clamp = Math.min(emissionDay, new Date(Date.UTC(year!, month!, 0)).getUTCDate());
  return `${year}-${String(month).padStart(2, "0")}-${String(clamp).padStart(2, "0")}`;
}

async function submitRecurring(): Promise<void> {
  if (!recName.value) {
    toast.error("Informe o nome da conta recorrente.");
    return;
  }
  const defaultCents = recVariable.value ? (parseAmountInput(recAmount.value) ?? 0) : parseAmountInput(recAmount.value);
  if (!recVariable.value && (defaultCents === null || defaultCents <= 0)) {
    toast.error("Informe o valor da conta.");
    return;
  }
  recSaving.value = true;
  try {
    const freq: Record<string, string> = {
      mensal: "FREQ=MONTHLY;INTERVAL=1",
      bimestral: "FREQ=MONTHLY;INTERVAL=2",
      trimestral: "FREQ=MONTHLY;INTERVAL=3",
      anual: "FREQ=YEARLY;INTERVAL=1",
    };
    let rrule = freq[recPeriodicity.value] ?? "FREQ=MONTHLY;INTERVAL=1";
    if (recDuration.value === "meses" && Number(recMonths.value) > 0) {
      rrule += `;COUNT=${Number(recMonths.value)}`;
    }
    const startDate =
      recEditingId.value && recOriginalStart.value
        ? anchorDate(recOriginalStart.value, Number(recEmissionDay.value))
        : nextEmissionDate(Number(recEmissionDay.value));
    const payload = {
      name: recName.value,
      rrule,
      start_date: startDate,
      target: "bill" as const,
      creates_status: "a_pagar" as const,
      template: {
        amount_cents: defaultCents ?? 0,
        default_amount_cents: defaultCents ?? 0,
        confirm_required: recVariable.value,
        type: (recNature.value === "entrada" ? "receita" : "despesa") as "receita" | "despesa",
        nature: recNature.value,
        category: recCategory.value || null,
        attribution: recAttribution.value,
        description: recName.value,
        emission_day: Number(recEmissionDay.value),
        due_day: Number(recDueDay.value),
      },
    };
    if (recEditingId.value) {
      await recurrencesStore.update(recEditingId.value, payload);
      toast.success("Conta recorrente atualizada.");
    } else {
      await recurrencesStore.create(payload);
      toast.success("Conta recorrente criada. As parcelas aparecerão para confirmação.");
    }
    recOpen.value = false;
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Falha ao salvar recorrência.");
  } finally {
    recSaving.value = false;
  }
}

async function toggleRecurring(recurrence: (typeof recurrencesStore.items)[number]): Promise<void> {
  await recurrencesStore.setActive(recurrence.id, !recurrence.active);
}

async function removeRecurring(id: string): Promise<void> {
  await recurrencesStore.remove(id);
  toast.info("Conta recorrente removida.");
}

function openConfirm(bill: LocalBill): void {
  confirming.value = bill;
  confirmEarly.value = (bill.emission_date ?? "").slice(0, 10) > todayISO();
  confirmAmount.value = bill.amount_cents > 0 ? formatCentsToInput(bill.amount_cents) : "";
  confirmOpen.value = true;
}

async function confirmValue(): Promise<void> {
  const bill = confirming.value;
  const cents = parseAmountInput(confirmAmount.value);
  if (!bill || cents === null || cents <= 0) {
    toast.error("Informe o valor correto.");
    return;
  }
  await updateLocal("bills", {
    ...bill,
    amount_cents: cents,
    status: "pendente",
    confirmed_at: new Date().toISOString(),
  });
  confirmOpen.value = false;
  await load();
  toast.success("Valor confirmado. A conta está pronta para pagamento.");
}

function openPay(bill: LocalBill): void {
  payingBill.value = bill;
  payMode.value = "conta";
  payAccount.value = accountsStore.items.find((a) => a.type !== "cartao_credito")?.id ?? "";
  payCard.value = "";
  payDate.value = todayISO();
  payOpen.value = true;
}

async function confirmPay(): Promise<void> {
  const bill = payingBill.value;
  if (!bill) return;
  paying.value = true;
  try {
    const isIncome = bill.nature === "entrada";
    if (payMode.value === "cartao" && !isIncome) {
      const card = cardsStore.cards.find((c) => c.id === payCard.value);
      if (!card) {
        toast.error("Escolha o cartão.");
        return;
      }
      await transactionsStore.createCardPurchase({
        account: card.account,
        credit_card: card.id,
        amount_cents: bill.amount_cents,
        date: payDate.value,
        attribution: bill.attribution === "dela" ? "dela" : bill.attribution === "meu" ? "meu" : "ambos",
        category: bill.category ?? null,
        description: bill.title,
        status: "a_pagar",
        installments: 1,
        closing_day: card.closing_day,
        due_day: card.due_day,
      });
    } else {
      if (!payAccount.value) {
        toast.error("Escolha a conta.");
        return;
      }
      await transactionsStore.create({
        account: payAccount.value,
        credit_card: null,
        amount_cents: bill.amount_cents,
        type: isIncome ? "receita" : "despesa",
        date: payDate.value,
        attribution: bill.attribution,
        category: bill.category ?? null,
        description: bill.title,
        status: "pago",
      });
    }
    await updateLocal("bills", { ...bill, status: "pago" });
    payOpen.value = false;
    await load();
    toast.success(isIncome ? "Conta recebida e lançada." : "Conta paga e lançada.");
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Falha ao registrar.");
  } finally {
    paying.value = false;
  }
}

async function setStatus(bill: LocalBill, status: LocalBill["status"]): Promise<void> {
  await updateLocal("bills", { ...bill, status });
  await load();
}

const generating = ref(false);

async function generateNow(): Promise<void> {
  generating.value = true;
  try {
    if (sync.online) await sync.syncNow();
    await apiClient.post("/bills/generate", {});
    await load();
  } catch {
    // offline ou sem sessão: as emissões serão geradas na próxima verificação
  } finally {
    generating.value = false;
  }
}

onMounted(async () => {
  await Promise.all([
    accountsStore.load(),
    cardsStore.load(),
    transactionsStore.load(),
    recurrencesStore.load(),
    load(),
  ]);
  void generateNow();
});
watch(() => sync.dataVersion, async () => {
  await Promise.all([accountsStore.load(), cardsStore.load(), recurrencesStore.load(), load()]);
});
</script>

<template>
  <div class="space-y-5">
    <div class="flex items-end justify-between gap-3">
      <div>
        <p class="text-xs font-extrabold uppercase tracking-wider text-primary">Compromissos</p>
        <h1 class="font-display text-3xl font-black tracking-tight">Contas</h1>
      </div>
      <div class="flex gap-2">
        <Button
          size="icon"
          variant="outline"
          :loading="generating"
          aria-label="Verificar emissões"
          @click="generateNow"
        >
          <RefreshCw class="h-4 w-4" />
        </Button>
        <Button size="sm" @click="chooserOpen = true"><Plus class="h-4 w-4" /> Nova</Button>
      </div>
    </div>

    <div class="grid grid-cols-3 gap-3">
      <Card>
        <CardContent class="flex flex-col items-center gap-1 p-3 text-center">
          <IconChip name="calendar-clock" color="#F2A93B" size="sm" />
          <p class="text-[0.6rem] font-extrabold uppercase tracking-wider text-muted-foreground">A confirmar</p>
          <p class="font-display text-base font-bold">{{ pendingConfirm.length }}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent class="flex flex-col items-center gap-1 p-3 text-center">
          <IconChip name="receipt" color="#E4572E" size="sm" />
          <p class="text-[0.6rem] font-extrabold uppercase tracking-wider text-muted-foreground">A pagar</p>
          <p class="font-display text-base font-bold">{{ formatBRL(totals.pendenteCents) }}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent class="flex flex-col items-center gap-1 p-3 text-center">
          <IconChip name="banknote" color="#3F9A6A" size="sm" />
          <p class="text-[0.6rem] font-extrabold uppercase tracking-wider text-muted-foreground">Pago</p>
          <p class="font-display text-base font-bold">{{ formatBRL(totals.pagoCents) }}</p>
        </CardContent>
      </Card>
    </div>

    <Card v-if="pendingConfirm.length > 0" class="border-sun/60">
      <CardContent class="p-3">
        <p class="flex items-center gap-2 px-1 pb-1 text-xs font-extrabold uppercase tracking-wider text-primary">
          <Clock class="h-3.5 w-3.5" /> Confirme o valor
        </p>
        <ul class="stagger">
          <li
            v-for="bill in pendingConfirm"
            :key="bill.id"
            class="flex items-center gap-3 rounded-[1.2rem] px-2 py-2.5"
          >
            <IconChip name="calendar-clock" color="#F2A93B" size="md" />
            <div class="min-w-0 flex-1">
              <p class="truncate font-bold">{{ bill.title }}</p>
              <p class="text-xs font-semibold text-muted-foreground">
                emitida {{ formatDate(bill.emission_date ?? bill.due_date) }} · vence
                {{ formatDate(bill.due_date) }}
              </p>
            </div>
            <Button size="sm" variant="sun" @click="openConfirm(bill)">Confirmar valor</Button>
          </li>
        </ul>
      </CardContent>
    </Card>

    <Card v-if="upcoming.length > 0" class="border-dashed">
      <CardContent class="p-3">
        <p class="px-1 pb-1 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
          Emissões para confirmar
        </p>
        <ul class="stagger">
          <li
            v-for="item in upcoming"
            :key="item.key"
            class="flex items-center gap-3 rounded-[1.2rem] px-2 py-2 text-sm"
          >
            <IconChip
              name="calendar-clock"
              :color="item.overdue ? '#E4572E' : '#8A6FD1'"
              size="sm"
            />
            <div class="min-w-0 flex-1">
              <p class="truncate font-bold">{{ item.name }}</p>
              <p class="text-xs font-semibold text-muted-foreground">
                emite {{ formatDate(item.emission) }} · vence {{ formatDate(item.due) }}
              </p>
            </div>
            <Badge :variant="item.overdue ? 'warning' : 'secondary'">
              {{ item.overdue ? "atrasada" : "prevista" }}
            </Badge>
            <span class="text-xs font-bold text-muted-foreground">
              {{ item.confirmRequired ? "a confirmar" : formatBRL(item.amountCents) }}
            </span>
            <Button
              v-if="item.confirmRequired"
              size="sm"
              variant="sun"
              @click="confirmUpcoming(item)"
            >
              Confirmar
            </Button>
            <Button
              v-else-if="item.overdue"
              size="sm"
              variant="secondary"
              @click="confirmUpcoming(item)"
            >
              Lançar
            </Button>
          </li>
        </ul>
      </CardContent>
    </Card>

    <Card>
      <CardContent class="p-3">
        <p class="px-1 pb-1 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
          A pagar / receber
        </p>
        <p v-if="payable.length === 0" class="px-2 py-6 text-center text-sm text-muted-foreground">
          Nada em aberto.
        </p>
        <ul v-else class="stagger">
          <li
            v-for="bill in payable"
            :key="bill.id"
            class="group flex items-center gap-3 rounded-[1.2rem] px-2 py-2.5 transition hover:bg-muted/70"
          >
            <IconChip
              :name="bill.nature === 'entrada' ? 'hand-coins' : 'receipt'"
              :color="bill.nature === 'entrada' ? '#3F9A6A' : '#E4572E'"
              size="md"
            />
            <button class="min-w-0 flex-1 text-left" @click="openEdit(bill)">
              <p class="truncate font-bold">{{ bill.title }}</p>
              <p class="truncate text-xs font-semibold text-muted-foreground">
                vence {{ formatDate(bill.due_date) }}
              </p>
            </button>
            <span class="font-display font-bold">{{ formatBRL(bill.amount_cents) }}</span>
            <div class="flex gap-1 opacity-0 transition group-hover:opacity-100">
              <button
                class="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:bg-card hover:text-leaf"
                aria-label="Pagar conta"
                @click="openPay(bill)"
              >
                <Check class="h-4 w-4" />
              </button>
              <button
                class="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:bg-card hover:text-primary"
                aria-label="Editar conta"
                @click="openEdit(bill)"
              >
                <Pencil class="h-3.5 w-3.5" />
              </button>
              <button
                class="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:bg-card hover:text-destructive"
                aria-label="Excluir conta"
                @click="setStatus(bill, 'cancelado')"
              >
                <Trash2 class="h-3.5 w-3.5" />
              </button>
            </div>
          </li>
        </ul>
      </CardContent>
    </Card>

    <Card v-if="recurringBills.length > 0">
      <CardContent class="p-3">
        <p class="px-1 pb-1 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
          Contas recorrentes
        </p>
        <p class="px-1 pb-2 text-xs text-muted-foreground">
          As parcelas aparecem em “Emissões para confirmar” (previstas ou atrasadas). Toque em ⟳ para verificar as emissões agora.
        </p>
        <ul class="stagger">
          <li
            v-for="recurrence in recurringBills"
            :key="recurrence.id"
            class="group flex items-center gap-3 rounded-[1.2rem] px-2 py-2.5 transition hover:bg-muted/70"
          >
            <IconChip name="repeat" color="#8A6FD1" size="md" />
            <div class="min-w-0 flex-1">
              <p class="truncate font-bold">
                {{ recurrence.name }}
                <span v-if="!recurrence.active" class="text-xs font-semibold text-muted-foreground">(pausada)</span>
              </p>
              <p class="truncate text-xs font-semibold text-muted-foreground">
                {{ periodicityFromRrule(recurrence.rrule) }} · emite dia {{ recurrence.template.emission_day ?? "—" }} ·
                vence dia {{ recurrence.template.due_day ?? "—" }}
              </p>
            </div>
            <Badge :variant="recurrence.template.confirm_required ? 'warning' : 'secondary'">
              {{ recurrence.template.confirm_required ? "variável" : "fixa" }}
            </Badge>
            <div class="flex gap-1 opacity-0 transition group-hover:opacity-100">
              <button
                class="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:bg-card hover:text-primary"
                aria-label="Editar conta recorrente"
                @click="openEditRecurring(recurrence)"
              >
                <Pencil class="h-3.5 w-3.5" />
              </button>
              <button
                class="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:bg-card hover:text-foreground"
                :aria-label="recurrence.active ? 'Pausar' : 'Ativar'"
                @click="toggleRecurring(recurrence)"
              >
                <Pause v-if="recurrence.active" class="h-3.5 w-3.5" />
                <Play v-else class="h-3.5 w-3.5" />
              </button>
              <button
                class="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:bg-card hover:text-destructive"
                aria-label="Excluir conta recorrente"
                @click="removeRecurring(recurrence.id)"
              >
                <Trash2 class="h-3.5 w-3.5" />
              </button>
            </div>
          </li>
        </ul>
      </CardContent>
    </Card>

    <Card v-if="settled.length > 0">
      <CardContent class="p-3">
        <p class="px-1 pb-1 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
          Pagas / canceladas
        </p>
        <ul>
          <li
            v-for="bill in settled"
            :key="bill.id"
            class="flex items-center gap-3 rounded-[1.2rem] px-2 py-2 text-sm"
          >
            <span class="min-w-0 flex-1 truncate">{{ bill.title }}</span>
            <Badge :variant="bill.status === 'pago' ? 'success' : 'destructive'">{{ bill.status }}</Badge>
            <button
              class="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label="Reabrir"
              @click="setStatus(bill, 'pendente')"
            >
              <RotateCcw class="h-3.5 w-3.5" />
            </button>
          </li>
        </ul>
      </CardContent>
    </Card>

    <!-- Escolha do tipo -->
    <Modal v-model="chooserOpen" title="O que você quer criar?" description="Escolha o tipo de conta.">
      <div class="grid gap-3">
        <button
          type="button"
          class="flex items-center gap-3 rounded-2xl border-2 border-border p-4 text-left transition hover:border-primary hover:bg-muted"
          @click="chooserOpen = false; openOne()"
        >
          <IconChip name="receipt" color="#E4572E" size="lg" />
          <span>
            <span class="block font-bold">Conta única</span>
            <span class="block text-xs text-muted-foreground">Uma conta pontual, com valor e vencimento.</span>
          </span>
        </button>
        <button
          type="button"
          class="flex items-center gap-3 rounded-2xl border-2 border-border p-4 text-left transition hover:border-primary hover:bg-muted"
          @click="chooserOpen = false; openRecurring()"
        >
          <IconChip name="repeat" color="#8A6FD1" size="lg" />
          <span>
            <span class="block font-bold">Conta recorrente</span>
            <span class="block text-xs text-muted-foreground">
              Emite todo mês num dia (ex.: água/luz) para você confirmar o valor.
            </span>
          </span>
        </button>
      </div>
    </Modal>

    <!-- Nova/editar conta avulsa -->
    <Modal v-model="oneOpen" :title="editingId ? 'Editar conta' : 'Nova conta'">
      <form class="space-y-4" @submit.prevent="submitOne">
        <div class="space-y-2">
          <Label for="bill-title">Título</Label>
          <Input id="bill-title" v-model="title" required maxlength="120" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-2">
            <Label for="bill-amount">Valor (R$)</Label>
            <Input id="bill-amount" v-model="amount" inputmode="decimal" placeholder="0,00" />
          </div>
          <div class="space-y-2">
            <Label for="bill-due">Vencimento</Label>
            <Input id="bill-due" v-model="dueDate" type="date" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-2">
            <Label for="bill-nature">Tipo</Label>
            <Select id="bill-nature" v-model="nature">
              <option value="saida">A pagar</option>
              <option value="entrada">A receber</option>
            </Select>
          </div>
          <div class="space-y-2">
            <Label for="bill-type">Variação</Label>
            <Select id="bill-type" v-model="type">
              <option value="fixa">Fixa</option>
              <option value="variavel">Variável</option>
            </Select>
          </div>
        </div>
        <div class="flex justify-end gap-2 pt-1">
          <Button variant="ghost" type="button" @click="oneOpen = false">Cancelar</Button>
          <Button type="submit" :loading="saving">Salvar</Button>
        </div>
      </form>
    </Modal>

    <!-- Nova conta recorrente -->
    <Modal
      v-model="recOpen"
      :title="recEditingId ? 'Editar conta recorrente' : 'Conta recorrente'"
      description="Emite todo mês num dia e você confirma o valor."
    >
      <form class="space-y-4" @submit.prevent="submitRecurring">
        <div class="space-y-2">
          <Label for="rec-name">Nome</Label>
          <Input id="rec-name" v-model="recName" required placeholder="Ex.: Água" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-2">
            <Label for="rec-nature">Tipo</Label>
            <Select id="rec-nature" v-model="recNature">
              <option value="saida">A pagar</option>
              <option value="entrada">A receber</option>
            </Select>
          </div>
          <div class="space-y-2">
            <Label for="rec-period">Periodicidade</Label>
            <Select id="rec-period" v-model="recPeriodicity">
              <option value="mensal">Mensal</option>
              <option value="bimestral">Bimestral</option>
              <option value="trimestral">Trimestral</option>
              <option value="anual">Anual</option>
            </Select>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-2">
            <Label for="rec-emission">Dia de emissão</Label>
            <Input id="rec-emission" v-model.number="recEmissionDay" type="number" min="1" max="31" />
          </div>
          <div class="space-y-2">
            <Label for="rec-due">Dia de vencimento</Label>
            <Input id="rec-due" v-model.number="recDueDay" type="number" min="1" max="31" />
          </div>
        </div>
        <label class="flex items-center gap-2 text-sm font-bold">
          <input v-model="recVariable" type="checkbox" class="h-4 w-4" />
          Valor variável (confirmo depois de emitida)
        </label>
        <div class="space-y-2">
          <Label for="rec-amount">
            {{ recVariable ? "Valor de referência (opcional)" : "Valor" }}
          </Label>
          <Input id="rec-amount" v-model="recAmount" inputmode="decimal" placeholder="0,00" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-2">
            <Label for="rec-category">Categoria</Label>
            <Select id="rec-category" v-model="recCategory">
              <option value="">Sem categoria</option>
              <option v-for="item in categories" :key="item.id" :value="item.id">{{ item.name }}</option>
            </Select>
          </div>
          <div class="space-y-2">
            <Label for="rec-attr">Atribuição</Label>
            <Select id="rec-attr" v-model="recAttribution">
              <option value="meu">Eu</option>
              <option value="dela">Ela</option>
              <option value="ambos">Ambos</option>
            </Select>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-2">
            <Label for="rec-duration">Duração</Label>
            <Select id="rec-duration" v-model="recDuration">
              <option value="sempre">Para sempre (até excluir)</option>
              <option value="meses">Por X meses</option>
            </Select>
          </div>
          <div v-if="recDuration === 'meses'" class="space-y-2">
            <Label for="rec-months">Meses</Label>
            <Input id="rec-months" v-model.number="recMonths" type="number" min="1" max="120" />
          </div>
        </div>
        <div class="flex justify-end gap-2 pt-1">
          <Button variant="ghost" type="button" @click="recOpen = false">Cancelar</Button>
          <Button type="submit" :loading="recSaving">
            {{ recEditingId ? "Salvar alterações" : "Criar recorrente" }}
          </Button>
        </div>
      </form>
    </Modal>

    <!-- Confirmar valor -->
    <Modal
      v-model="confirmOpen"
      title="Confirmar valor"
      :description="
        confirmEarly ? 'Confirmação antecipada — informe o valor previsto.' : 'Informe o valor correto desta emissão.'
      "
    >
      <form class="space-y-4" @submit.prevent="confirmValue">
        <p v-if="confirmEarly" class="rounded-2xl bg-sun/25 px-3 py-2 text-xs font-bold text-accent-foreground">
          Confirmação antecipada: a emissão está prevista para
          {{ confirming ? formatDate(confirming.emission_date ?? confirming.due_date) : "" }}.
        </p>
        <p class="text-sm font-bold">{{ confirming?.title }}</p>
        <div class="space-y-2">
          <Label for="confirm-amount">Valor (R$)</Label>
          <Input id="confirm-amount" v-model="confirmAmount" inputmode="decimal" placeholder="0,00" autofocus />
        </div>
        <div class="flex justify-end gap-2 pt-1">
          <Button variant="ghost" type="button" @click="confirmOpen = false">Cancelar</Button>
          <Button type="submit">Confirmar</Button>
        </div>
      </form>
    </Modal>

    <!-- Pagar -->
    <Modal
      v-model="payOpen"
      :title="payingBill?.nature === 'entrada' ? 'Receber conta' : 'Pagar conta'"
      description="Escolha por onde o valor entra ou sai."
    >
      <form class="space-y-4" @submit.prevent="confirmPay">
        <div class="flex items-center justify-between rounded-2xl bg-muted p-3">
          <span class="text-sm font-bold">{{ payingBill?.title }}</span>
          <span class="font-display text-lg font-bold">
            {{ payingBill ? formatBRL(payingBill.amount_cents) : "" }}
          </span>
        </div>
        <div v-if="payingBill?.nature !== 'entrada'" class="grid grid-cols-2 gap-2 rounded-full bg-muted p-1">
          <button
            type="button"
            class="flex items-center justify-center gap-1 rounded-full py-2 text-sm font-extrabold transition"
            :class="payMode === 'conta' ? 'bg-card text-foreground shadow-soft' : 'text-muted-foreground'"
            @click="payMode = 'conta'"
          >
            <Wallet class="h-4 w-4" /> Conta
          </button>
          <button
            type="button"
            class="flex items-center justify-center gap-1 rounded-full py-2 text-sm font-extrabold transition"
            :class="payMode === 'cartao' ? 'bg-card text-foreground shadow-soft' : 'text-muted-foreground'"
            @click="payMode = 'cartao'"
          >
            <CreditCard class="h-4 w-4" /> Cartão
          </button>
        </div>
        <div class="space-y-2">
          <Label for="pay-date">Data do lançamento</Label>
          <Input id="pay-date" v-model="payDate" type="date" />
        </div>
        <div v-if="payMode === 'conta' || payingBill?.nature === 'entrada'" class="space-y-2">
          <Label for="pay-account">Conta</Label>
          <Select id="pay-account" v-model="payAccount" required>
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
        <div v-else class="space-y-2">
          <Label for="pay-card">Cartão</Label>
          <Select id="pay-card" v-model="payCard" required>
            <option value="">Selecione</option>
            <option v-for="item in cardsStore.cards" :key="item.id" :value="item.id">
              {{ item.bank || "Cartão" }} •••• {{ item.closing_day }}/{{ item.due_day }}
            </option>
          </Select>
        </div>
        <div class="flex justify-end gap-2 pt-1">
          <Button variant="ghost" type="button" @click="payOpen = false">Cancelar</Button>
          <Button type="submit" :loading="paying">
            {{ payingBill?.nature === "entrada" ? "Receber" : "Pagar" }}
          </Button>
        </div>
      </form>
    </Modal>
  </div>
</template>
