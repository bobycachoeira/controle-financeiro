<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import type { BillNature, BillType } from "@cf/shared";
import { computeBillsTotals, todayISO } from "@cf/shared";
import { Check, Pencil, Plus, Receipt, RotateCcw } from "lucide-vue-next";
import { db, type LocalBill } from "@/db/schema";
import { createLocal, newSyncId, newLocalId, updateLocal } from "@/db/repositories";
import { useSessionStore } from "@/stores/session";
import { useSyncStore } from "@/stores/sync";
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
const toast = useToast();

const bills = ref<LocalBill[]>([]);
const open = ref(false);
const editingId = ref<string | null>(null);
const title = ref("");
const amount = ref("");
const nature = ref<BillNature>("saida");
const type = ref<BillType>("fixa");
const dueDate = ref(todayISO());
const saving = ref(false);

const month = ref(todayISO().slice(0, 7));
const totals = computed(() => computeBillsTotals(bills.value, month.value));

async function load(): Promise<void> {
  if (!session.currentHouseholdId) return;
  bills.value = (
    await db.bills.where("household").equals(session.currentHouseholdId).toArray()
  )
    .filter((bill) => !bill.deleted_at)
    .sort((a, b) => (a.due_date < b.due_date ? 1 : -1));
}

function openCreate(): void {
  editingId.value = null;
  title.value = "";
  amount.value = "";
  nature.value = "saida";
  type.value = "fixa";
  dueDate.value = todayISO();
  open.value = true;
}

function openEdit(bill: LocalBill): void {
  editingId.value = bill.id;
  title.value = bill.title;
  amount.value = formatCentsToInput(bill.amount_cents);
  nature.value = bill.nature;
  type.value = bill.type;
  dueDate.value = bill.due_date.slice(0, 10);
  open.value = true;
}

async function submit(): Promise<void> {
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
        updated_by: session.user?.id ?? null,
        deleted_at: null,
      });
      toast.success("Conta adicionada.");
    }
    open.value = false;
    await load();
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Falha ao salvar.");
  } finally {
    saving.value = false;
  }
}

async function setStatus(bill: LocalBill, status: LocalBill["status"]): Promise<void> {
  await updateLocal("bills", { ...bill, status });
  await load();
}

onMounted(load);
watch(() => sync.dataVersion, load);
</script>

<template>
  <div class="space-y-5">
    <div class="flex items-end justify-between gap-3">
      <div>
        <p class="text-xs font-extrabold uppercase tracking-wider text-primary">Compromissos</p>
        <h1 class="font-display text-3xl font-black tracking-tight">Contas</h1>
      </div>
      <Button size="sm" @click="openCreate"><Plus class="h-4 w-4" /> Nova</Button>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <Card class="overflow-hidden">
        <CardContent class="flex items-center gap-3 p-4">
          <IconChip name="receipt" color="#E4572E" size="md" />
          <div>
            <p class="text-[0.62rem] font-extrabold uppercase tracking-wider text-muted-foreground">
              A pagar
            </p>
            <p class="font-display text-lg font-bold">{{ formatBRL(totals.pendenteCents) }}</p>
          </div>
        </CardContent>
      </Card>
      <Card class="overflow-hidden">
        <CardContent class="flex items-center gap-3 p-4">
          <IconChip name="banknote" color="#3F9A6A" size="md" />
          <div>
            <p class="text-[0.62rem] font-extrabold uppercase tracking-wider text-muted-foreground">
              Pago
            </p>
            <p class="font-display text-lg font-bold">{{ formatBRL(totals.pagoCents) }}</p>
          </div>
        </CardContent>
      </Card>
    </div>

    <Card>
      <CardContent class="p-2">
        <p
          v-if="bills.length === 0"
          class="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-muted-foreground"
        >
          <Receipt class="h-8 w-8 text-muted-foreground/50" />
          Nenhuma conta cadastrada.
        </p>
        <ul v-else class="stagger">
          <li
            v-for="bill in bills"
            :key="bill.id"
            class="group flex items-center gap-3 rounded-[1.3rem] px-2 py-3 transition hover:bg-muted/70"
          >
            <IconChip
              :name="bill.nature === 'entrada' ? 'hand-coins' : 'receipt'"
              :color="bill.nature === 'entrada' ? '#3F9A6A' : (bill.status === 'pago' ? '#3F9A6A' : '#E4572E')"
              size="md"
            />
            <button class="min-w-0 flex-1 text-left" @click="openEdit(bill)">
              <p class="truncate font-bold">{{ bill.title }}</p>
              <p class="truncate text-xs font-semibold text-muted-foreground">
                {{ bill.type }} · vence {{ formatDate(bill.due_date) }}
              </p>
            </button>
            <div class="flex flex-col items-end gap-1">
              <span class="font-display font-bold">{{ formatBRL(bill.amount_cents) }}</span>
              <Badge
                :variant="bill.status === 'pago' ? 'success' : bill.status === 'cancelado' ? 'destructive' : 'warning'"
              >
                {{ bill.status }}
              </Badge>
            </div>
            <div class="flex gap-1 opacity-0 transition group-hover:opacity-100">
              <button
                v-if="bill.status === 'pendente'"
                class="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:bg-card hover:text-leaf"
                aria-label="Marcar como pago"
                @click="setStatus(bill, 'pago')"
              >
                <Check class="h-4 w-4" />
              </button>
              <button
                v-else
                class="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:bg-card hover:text-foreground"
                aria-label="Reabrir conta"
                @click="setStatus(bill, 'pendente')"
              >
                <RotateCcw class="h-3.5 w-3.5" />
              </button>
              <button
                class="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:bg-card hover:text-primary"
                aria-label="Editar conta"
                @click="openEdit(bill)"
              >
                <Pencil class="h-3.5 w-3.5" />
              </button>
            </div>
          </li>
        </ul>
      </CardContent>
    </Card>

    <Modal v-model="open" :title="editingId ? 'Editar conta' : 'Nova conta'">
      <form class="space-y-4" @submit.prevent="submit">
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
            <Label for="bill-type">Recorrência</Label>
            <Select id="bill-type" v-model="type">
              <option value="fixa">Fixa</option>
              <option value="variavel">Variável</option>
            </Select>
          </div>
        </div>
        <div class="flex justify-end gap-2 pt-1">
          <Button variant="ghost" type="button" @click="open = false">Cancelar</Button>
          <Button type="submit" :loading="saving">Salvar</Button>
        </div>
      </form>
    </Modal>
  </div>
</template>
